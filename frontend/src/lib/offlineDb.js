const DB_NAME = "scanner-offline";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("registrants")) {
        db.createObjectStore("registrants", { keyPath: "ticketId" });
      }
      if (!db.objectStoreNames.contains("pendingSync")) {
        db.createObjectStore("pendingSync", { keyPath: "localId", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

// Replaces the entire cached registrant list (called after downloading a
// fresh copy while online).
export async function cacheRegistrants(eventId, records) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("registrants", "readwrite");
    const store = tx.objectStore("registrants");
    store.clear();
    for (const r of records) {
      store.put({ ...r, eventId });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedRegistrant(ticketId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("registrants", "readonly");
    const req = tx.objectStore("registrants").get(ticketId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function updateCachedStatus(ticketId, status) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("registrants", "readwrite");
    const store = tx.objectStore("registrants");
    const getReq = store.get(ticketId);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, currentStatus: status });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Queues a check-in/out performed while offline, to replay once back online.
export async function queuePendingSync(entry) {
  return withStore("pendingSync", "readwrite", (store) => {
    store.add({ ...entry, queuedAt: Date.now() });
  });
}

export async function getPendingSync() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pendingSync", "readonly");
    const req = tx.objectStore("pendingSync").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingSync(localId) {
  return withStore("pendingSync", "readwrite", (store) => {
    store.delete(localId);
  });
}

export async function pendingSyncCount() {
  const all = await getPendingSync();
  return all.length;
}