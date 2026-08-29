import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, Wifi, WifiOff, RefreshCw, CheckCircle2, XCircle, Clock, Search } from "lucide-react";
import client from "../api/client";
import { cacheRegistrants, getCachedRegistrant, updateCachedStatus, queuePendingSync, getPendingSync, removePendingSync, pendingSyncCount } from "../lib/offlineDb";

// One persistent AudioContext, reused for every beep — creating a brand
// new context on every single call (the old approach) is unreliable:
// some browsers throttle/suspend rapidly-created contexts, and it's
// wasteful. This one is created lazily on first use and resumed if the
// browser auto-suspended it (which mobile Safari/Chrome do until a user
// gesture unlocks audio — camera permission itself counts as that gesture
// here, but resuming defensively costs nothing).
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Distinct 3-beep vocabulary the whole flow uses:
//   scanned  — QR successfully decoded (before details even load)
//   fetched  — details resolved and shown on screen
//   checkIn  — check-in completed
//   checkOut — check-out completed
// Each is its own frequency/pattern so they're distinguishable by ear,
// and loud enough to hear over ambient noise at an entry gate.
const SOUNDS = {
  scanned: [{ freq: 1046, dur: 90 }],
  fetched: [{ freq: 1318, dur: 90 }, { freq: 1568, dur: 110 }],
  checkIn: [{ freq: 784, dur: 90 }, { freq: 1046, dur: 90 }, { freq: 1568, dur: 160 }],
  checkOut: [{ freq: 1046, dur: 90 }, { freq: 622, dur: 180 }],
};

function playSound(name) {
  try {
    const ctx = getAudioCtx();
    const notes = SOUNDS[name] || SOUNDS.scanned;
    let t = ctx.currentTime;
    for (const { freq, dur } of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square"; // sharper, more piercing/audible than the default sine
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.5, t); // loud
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur / 1000);
      osc.start(t);
      osc.stop(t + dur / 1000);
      t += dur / 1000 + 0.03; // tiny gap between notes
    }
  } catch (err) {
    console.warn("[scanner] couldn't play sound:", err);
  }
}

export default function Scanner() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [gates, setGates] = useState([]);
  const [gateId, setGateId] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [record, setRecord] = useState(null);
  const [lastDecoded, setLastDecoded] = useState(""); // raw text read from the last QR scan — shown for debugging misreads
  const [notFoundMsg, setNotFoundMsg] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null); // { totalRegistrations, totalCheckedIn, attendanceRate }
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncCount, setSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [cacheStatus, setCacheStatus] = useState(""); // "", "caching", "ready"

  const containerId = "qr-reader";
  const scannerRef = useRef(null);
  const lastScannedRef = useRef("");
  const isRunningRef = useRef(false);

  // --- online/offline detection ---
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      flushPendingSync();
      refreshStats();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    client.get(`/api/events/${eventId}/gates`).then(({ data }) => setGates(data.data)).catch(() => {});
    refreshStats();
    downloadOfflineCache();
    updatePendingCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const refreshStats = () => {
    client
      .get(`/api/events/${eventId}/analytics`)
      .then(({ data }) => setStats(data.data))
      .catch(() => {});
  };

  const updatePendingCount = async () => {
    setSyncCount(await pendingSyncCount());
  };

  const downloadOfflineCache = async () => {
    if (!navigator.onLine) return;
    setCacheStatus("caching");
    try {
      const { data } = await client.get(`/api/events/${eventId}/scan/offline-cache`);
      await cacheRegistrants(eventId, data.data);
      setCacheStatus("ready");
    } catch {
      setCacheStatus("");
    }
  };

  const flushPendingSync = async () => {
    const pending = await getPendingSync();
    if (pending.length === 0) return;
    setSyncing(true);
    for (const item of pending) {
      try {
        await client.post(`/api/events/${eventId}/scan/mark`, {
          manualValue: item.ticketId,
          action: item.action,
          gateId: item.gateId,
        });
        await removePendingSync(item.localId);
      } catch {
        // leave it queued, try again next time
      }
    }
    setSyncing(false);
    updatePendingCount();
    refreshStats();
    downloadOfflineCache();
  };

  // --- camera lifecycle ---
  const safeStopScanner = async () => {
    if (!isRunningRef.current || !scannerRef.current) return;
    isRunningRef.current = false;
    try {
      await scannerRef.current.stop();
    } catch {
      /* already stopped */
    }
    try {
      await scannerRef.current.clear();
    } catch {
      /* nothing to clear */
    }
  };

  useEffect(() => {
    if (!cameraOn) return;

    const html5Qr = new Html5Qrcode(containerId);
    scannerRef.current = html5Qr;
    let cancelled = false;

    const startScanner = () => {
      if (cancelled) return;
      html5Qr
        .start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 280, height: 280 },
            // uses the browser's native, hardware-accelerated barcode
            // detector where available (most modern Android Chrome) —
            // significantly more reliable/faster than the pure-JS
            // decoder html5-qrcode falls back to otherwise
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          },
          (decodedText) => {
            const trimmed = decodedText.trim();
            if (trimmed === lastScannedRef.current) return;
            lastScannedRef.current = trimmed;
            setLastDecoded(trimmed);
            playSound("scanned");
            handleScanSuccess(trimmed);
          },
          () => {}
        )
        .then(() => {
          if (!cancelled) isRunningRef.current = true;
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("[scanner] start() failed:", err);
          setNotFoundMsg("Couldn't access the camera. Use manual search below, or try Start scanning again.");
          setCameraOn(false);
        });
    };

    const raf = requestAnimationFrame(startScanner);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      safeStopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn]);

  const handleScanSuccess = async (decodedText) => {
    await safeStopScanner();
    setCameraOn(false);
    resolveScan({ manualValue: decodedText });
  };

  const stopCamera = async () => {
    await safeStopScanner();
    setCameraOn(false);
    lastScannedRef.current = "";
  };

  // --- resolve (lookup details, no state change) ---
  const resolveScan = async (payload) => {
    setBusy(true);
    setNotFoundMsg("");
    setRecord(null);

    if (isOnline) {
      try {
        const { data } = await client.post(`/api/events/${eventId}/scan/resolve`, payload);
        setRecord({ ...data.data, ...payload });
        playSound("fetched");
      } catch (err) {
        setNotFoundMsg(err.response?.data?.message || "No matching registration found");
      } finally {
        setBusy(false);
      }
      return;
    }

    // offline — resolve from the local cache instead (manualValue is
    // either the scanned ticketId or a typed email/phone/ticketId)
    const ticketId = payload.manualValue;

    const cached = await getCachedRegistrant(ticketId);
    if (!cached) {
      setNotFoundMsg("Not found in the offline cache. Reconnect to search the full list.");
    } else {
      setRecord({ ...payload, ticketId: cached.ticketId, customFields: { name: cached.name }, currentStatus: cached.currentStatus, history: [], offline: true });
      playSound("fetched");
    }
    setBusy(false);
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!manualValue.trim()) return;
    resolveScan({ manualValue: manualValue.trim() });
    setManualValue("");
  };

  // --- mark check-in / check-out ---
  const mark = async (action) => {
    if (!record) return;
    setBusy(true);

    if (isOnline) {
      try {
        const { data } = await client.post(`/api/events/${eventId}/scan/mark`, {
          manualValue: record.ticketId || record.manualValue,
          action,
          gateId,
        });
        playSound(action === "IN" ? "checkIn" : "checkOut");
        setRecord({ ...record, ...data.data });
        updateCachedStatus(record.ticketId, action).catch(() => {});
        refreshStats();
      } catch (err) {
        const body = err.response?.data;
        if (body?.data) setRecord({ ...record, ...body.data });
        alert(body?.message || "Couldn't update status");
      } finally {
        setBusy(false);
      }
      return;
    }

    // offline — update locally, queue the actual sync for later
    playSound(action === "IN" ? "checkIn" : "checkOut");
    await updateCachedStatus(record.ticketId, action);
    await queuePendingSync({ ticketId: record.ticketId, action, gateId });
    setRecord({ ...record, currentStatus: action, offline: true });
    updatePendingCount();
    setBusy(false);
  };

  const scanNext = () => {
    setRecord(null);
    setNotFoundMsg("");
    setCameraOn(true);
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      {/* top bar */}
      <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-bg/95 backdrop-blur z-10">
        <div>
          <p className="text-[11px] text-muted uppercase tracking-wide">Scanner</p>
          <p className="font-semibold text-sm">{gates.find((g) => g._id === gateId)?.name || "No gate selected"}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={gateId} onChange={(e) => setGateId(e.target.value)} className="input w-auto text-xs py-1.5">
            <option value="">No gate</option>
            {gates.map((g) => (
              <option key={g._id} value={g._id}>
                {g.name}
              </option>
            ))}
          </select>
          <button onClick={() => navigate("/admin/events")} className="text-xs text-muted underline">
            Exit
          </button>
        </div>
      </div>

      {/* status strip */}
      <div className="px-4 py-2 flex items-center gap-3 text-xs border-b border-border/60 bg-surface/50">
        <span className={`flex items-center gap-1.5 font-medium ${isOnline ? "text-success" : "text-warn"}`}>
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          {isOnline ? "Online" : "Offline mode"}
        </span>
        {syncCount > 0 && (
          <span className="flex items-center gap-1.5 text-warn">
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : `${syncCount} pending sync`}
          </span>
        )}
        {cacheStatus === "caching" && <span className="text-muted">Preparing offline cache…</span>}
        {cacheStatus === "ready" && !syncCount && <span className="text-muted">Offline-ready</span>}
      </div>

      <div className="flex-1 p-4 max-w-md mx-auto w-full">
        {/* live mini analytics */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <StatPill label="Registered" value={stats.totalRegistrations} />
            <StatPill label="Checked in" value={stats.totalCheckedIn} accent />
            <StatPill label="Rate" value={`${stats.attendanceRate}%`} />
          </div>
        )}

        {!record && (
          <div className="animate-fade-in">
            {cameraOn ? (
              <>
                <div className="rounded-2xl overflow-hidden bg-black mb-4 relative" style={{ height: 360, width: "100%" }}>
                  <div id={containerId} style={{ width: "100%", height: "100%" }} />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-56 border-2 border-primary/70 rounded-2xl animate-pulse-slow" />
                  </div>
                </div>
                <button
                  onClick={stopCamera}
                  className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-sm font-medium rounded-xl py-3.5 mb-4 transition"
                >
                  <CameraOff size={16} /> Stop camera
                </button>
              </>
            ) : (
              <>
                {busy && lastDecoded && (
                  <div className="mb-4 rounded-xl border border-border bg-surface p-3 animate-fade-in">
                    <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Scanned — looking up…</p>
                    <p className="text-xs font-mono break-all">{lastDecoded}</p>
                  </div>
                )}
                <button
                  onClick={() => {
                    setNotFoundMsg("");
                    setCameraOn(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl py-5 mb-4 transition shadow-lg shadow-primary/20 active:scale-[0.98]"
                >
                  <Camera size={20} /> Start scanning
                </button>
              </>
            )}
          </div>
        )}

        {notFoundMsg && (
          <div className="border-2 border-danger bg-danger/10 rounded-2xl p-6 text-center mb-4 animate-scale-in">
            <XCircle size={32} className="text-danger mx-auto mb-2" />
            <p className="font-bold text-danger mb-1">Not found</p>
            <p className="text-sm">{notFoundMsg}</p>
            {lastDecoded && (
              <p className="text-xs text-muted font-mono break-all mt-3 pt-3 border-t border-danger/20">
                Scanned text: {lastDecoded}
              </p>
            )}
          </div>
        )}

        {record && (
          <div className="space-y-4 animate-scale-in">
            <div
              className={`border-2 rounded-2xl p-6 transition-colors ${
                record.currentStatus === "IN" ? "border-success bg-success/10" : "border-border bg-surface"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted font-mono">{record.ticketId || "—"}</p>
                {record.offline && (
                  <span className="text-[10px] bg-warn/20 text-warn px-2 py-0.5 rounded-full font-medium">OFFLINE</span>
                )}
              </div>
              {Object.entries(record.customFields || {}).map(([k, v]) => (
                <p key={k} className="text-sm">
                  <span className="text-muted">{k}:</span> <span className="font-medium">{String(v)}</span>
                </p>
              ))}

              {record.currentStatus === "IN" && (
                <p className="text-success font-semibold mt-3 flex items-center gap-1.5 animate-fade-in">
                  <CheckCircle2 size={16} /> Currently checked in
                </p>
              )}

              {record.history?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted mb-1 flex items-center gap-1"><Clock size={11} /> History</p>
                  {record.history.map((h, i) => (
                    <p key={i} className="text-xs text-muted">
                      {h.type === "IN" ? "In" : "Out"} — {new Date(h.at).toLocaleString()}
                      {h.gate ? ` · ${h.gate}` : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {record.currentStatus !== "IN" && (
                <button
                  onClick={() => mark("IN")}
                  disabled={busy}
                  className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 transition active:scale-[0.98]"
                >
                  Check In
                </button>
              )}
              {record.currentStatus === "IN" && (
                <button
                  onClick={() => mark("OUT")}
                  disabled={busy}
                  className="flex-1 bg-warn/20 hover:bg-warn/30 text-warn disabled:opacity-50 font-semibold rounded-xl py-3.5 transition active:scale-[0.98]"
                >
                  Check Out
                </button>
              )}
            </div>

            <button onClick={scanNext} className="w-full bg-white/5 hover:bg-white/10 text-sm rounded-xl py-3 transition">
              Scan next
            </button>
          </div>
        )}

        <div className="mt-6">
          <p className="text-xs text-muted mb-2 flex items-center gap-1.5"><Search size={12} /> Search by ticket ID, email, or phone</p>
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <input
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="e.g. name@email.com, 9999999999, or TKT-..."
              className="input"
            />
            <button disabled={busy} className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm px-5 rounded-xl shrink-0 font-medium transition">
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted">
        <span>Gate scanning</span>
        <span>{isOnline ? "Live" : "Working offline"}</span>
      </div>
    </div>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div className={`rounded-xl p-3 text-center border ${accent ? "border-success/40 bg-success/10" : "border-border bg-surface"}`}>
      <p className={`text-lg font-bold ${accent ? "text-success" : "text-text"}`}>{value}</p>
      <p className="text-[10px] text-muted uppercase tracking-wide">{label}</p>
    </div>
  );
}