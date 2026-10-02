// ==========================================
// ShrinkNest Local File Store (IndexedDB)
// File: js/localstore.js
// Stores compressed blobs locally in the browser.
// Files persist until browser data is cleared.
// ==========================================

const DB_NAME    = "ShrinkNestFiles";
const STORE_NAME = "compressed";
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

/** Save a Blob/File to IndexedDB under `key`. */
export async function saveFileLocally(key, blob) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx  = db.transaction(STORE_NAME, "readwrite");
            const req = tx.objectStore(STORE_NAME).put(blob, key);
            req.onsuccess = () => resolve(true);
            req.onerror   = (e) => reject(e.target.error);
        });
    } catch (err) {
        console.warn("IndexedDB save failed:", err);
        return false;
    }
}

/** Retrieve a Blob from IndexedDB by `key`. Returns null if not found. */
export async function getFileLocally(key) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx  = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = (e) => resolve(e.target.result || null);
            req.onerror   = (e) => reject(e.target.error);
        });
    } catch (err) {
        console.warn("IndexedDB get failed:", err);
        return null;
    }
}

/** Delete a stored file by `key`. */
export async function deleteFileLocally(key) {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = () => resolve(true);
        });
    } catch (err) {
        return false;
    }
}
