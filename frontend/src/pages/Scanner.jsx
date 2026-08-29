import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import client from "../api/client";

// Simple beep via Web Audio API — no audio file needed. Two distinct
// tones: a quick high beep the instant a QR is decoded, and a slightly
// different confirmation tone once check-in/check-out actually completes.
function beep(frequency = 880, duration = 120) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
    osc.onended = () => ctx.close();
  } catch {
    // Web Audio not available — fail silently, not critical
  }
}

export default function Scanner() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [gates, setGates] = useState([]);
  const [gateId, setGateId] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [record, setRecord] = useState(null); // { ticketId, customFields, currentStatus, history }
  const [notFoundMsg, setNotFoundMsg] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [totalCheckedIn, setTotalCheckedIn] = useState(null);

  const containerId = "qr-reader";
  const scannerRef = useRef(null);
  const lastScannedRef = useRef("");
  const isRunningRef = useRef(false); // tracks whether the scanner is ACTUALLY running right now — calling
  // .stop() when it isn't throws synchronously (not a promise rejection),
  // so this flag is what stops us from ever calling it twice

  useEffect(() => {
    client.get(`/api/events/${eventId}/gates`).then(({ data }) => setGates(data.data));
    refreshCount();
  }, [eventId]);

  const refreshCount = () => {
    client
      .get(`/api/events/${eventId}/analytics`)
      .then(({ data }) => setTotalCheckedIn(data.data.totalCheckedIn))
      .catch(() => {});
  };

  // Safe, idempotent stop — checks isRunningRef first so it never calls
  // .stop() on an already-stopped instance (which throws synchronously in
  // this library, not as a rejected promise, so a plain .catch() chain
  // doesn't catch it — needs a real try/catch, which this provides).
  const safeStopScanner = async () => {
    if (!isRunningRef.current || !scannerRef.current) return;
    isRunningRef.current = false;
    try {
      await scannerRef.current.stop();
    } catch {
      // ignore — already stopped
    }
    try {
      await scannerRef.current.clear();
    } catch {
      // ignore — nothing to clear
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
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (decodedText === lastScannedRef.current) return;
            lastScannedRef.current = decodedText;
            beep(880, 100); // scan-detected beep
            handleScanSuccess(decodedText);
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

    // wait one paint so the container has its real (explicit-height)
    // dimensions before html5-qrcode measures it and sizes the video —
    // starting in the same tick the div was created can make it read a
    // 0-size container, which is what produced the black screen
    const raf = requestAnimationFrame(startScanner);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      safeStopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn]);

  // Called when a QR is decoded — stop the camera BEFORE removing it from
  // the DOM, since removing it out from under html5-qrcode while its own
  // stop()/clear() is still pending is what caused the crash-to-blank bug.
  const handleScanSuccess = async (decodedText) => {
    await safeStopScanner();
    setCameraOn(false);
    resolveScan({ qrToken: decodedText });
  };

  const stopCamera = async () => {
    await safeStopScanner();
    setCameraOn(false);
    lastScannedRef.current = "";
  };

  const resolveScan = async (payload) => {
    setBusy(true);
    setNotFoundMsg("");
    setRecord(null);
    try {
      const { data } = await client.post(`/api/events/${eventId}/scan/resolve`, payload);
      setRecord({ ...data.data, ...payload });
    } catch (err) {
      setNotFoundMsg(err.response?.data?.message || "No matching registration found");
    } finally {
      setBusy(false);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!manualValue.trim()) return;
    resolveScan({ manualValue: manualValue.trim() });
    setManualValue("");
  };

  const mark = async (action) => {
    if (!record) return;
    setBusy(true);
    try {
      const payload = record.qrToken ? { qrToken: record.qrToken } : { manualValue: record.manualValue };
      const { data } = await client.post(`/api/events/${eventId}/scan/mark`, { ...payload, action, gateId });
      beep(action === "IN" ? 1200 : 600, 150); // completion beep — different tone for in vs out
      setRecord({ ...record, ...data.data });
      refreshCount();
    } catch (err) {
      const body = err.response?.data;
      if (body?.data) {
        setRecord({ ...record, ...body.data });
      }
      alert(body?.message || "Couldn't update status");
    } finally {
      setBusy(false);
    }
  };

  const scanNext = () => {
    setRecord(null);
    setNotFoundMsg("");
    setCameraOn(true);
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-xs text-muted uppercase">Scanner</p>
          <p className="font-semibold">{gates.find((g) => g._id === gateId)?.name || "No gate selected"}</p>
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

      <div className="flex-1 p-4 max-w-md mx-auto w-full">
        {!record && (
          <>
            {cameraOn ? (
              <>
                <div className="rounded-2xl overflow-hidden bg-black mb-4 relative" style={{ height: 360, width: "100%" }}>
                  <div id={containerId} style={{ width: "100%", height: "100%" }} />
                </div>
                <button onClick={stopCamera} className="w-full bg-white/10 hover:bg-white/20 text-sm font-medium rounded-lg py-3 mb-4">
                  Stop camera
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setNotFoundMsg("");
                  setCameraOn(true);
                }}
                className="w-full bg-primary hover:bg-primary-dark text-white font-medium rounded-lg py-4 mb-4"
              >
                Start scanning
              </button>
            )}
          </>
        )}

        {notFoundMsg && (
          <div className="border-2 border-danger bg-danger/10 rounded-2xl p-6 text-center mb-4">
            <p className="font-bold text-danger mb-1">✕ NOT FOUND</p>
            <p className="text-sm">{notFoundMsg}</p>
          </div>
        )}

        {record && (
          <div className="space-y-4">
            <div
              className={`border-2 rounded-2xl p-6 ${
                record.currentStatus === "IN" ? "border-success bg-success/10" : "border-border bg-surface"
              }`}
            >
              <p className="text-xs text-muted mb-1">{record.ticketId || "—"}</p>
              {Object.entries(record.customFields || {}).map(([k, v]) => (
                <p key={k} className="text-sm">
                  <span className="text-muted">{k}:</span> <span className="font-medium">{String(v)}</span>
                </p>
              ))}

              {record.currentStatus === "IN" && (
                <p className="text-success font-semibold mt-3">✓ Currently checked in</p>
              )}

              {record.history?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted mb-1">History</p>
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
                  className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-medium rounded-lg py-3"
                >
                  Check In
                </button>
              )}
              {record.currentStatus === "IN" && (
                <button
                  onClick={() => mark("OUT")}
                  disabled={busy}
                  className="flex-1 bg-warn/20 hover:bg-warn/30 text-warn disabled:opacity-50 font-medium rounded-lg py-3"
                >
                  Check Out
                </button>
              )}
            </div>

            <button onClick={scanNext} className="w-full bg-white/5 hover:bg-white/10 text-sm rounded-lg py-3">
              Scan next
            </button>
          </div>
        )}

        <div className="mt-6">
          <p className="text-xs text-muted mb-2">Search by ticket ID, email, or phone</p>
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <input
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="e.g. name@email.com, 9999999999, or TKT-..."
              className="input"
            />
            <button disabled={busy} className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm px-5 rounded-lg shrink-0 font-medium">
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted">
        <span>✓ {totalCheckedIn ?? "…"} currently checked in</span>
        <span>⚡ Online</span>
      </div>
    </div>
  );
}