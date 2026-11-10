// ==========================================
// ShrinkNest History Utility
// File: js/history.js
// Saves metadata to Firestore for history display.
// Client-side only: never uploads raw file contents.
// ==========================================

import { auth, db } from "./firebase-config.js";
import { saveFileLocally, deleteFileLocally } from "./localstore.js";

import {
    collection,
    addDoc,
    doc,
    deleteDoc,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Helper: consistent 1 KB = 1024 bytes formatter
export function formatBytes(bytes) {
    if (typeof bytes !== "number" || isNaN(bytes) || bytes < 0) return "0 KB";
    if (bytes === 0) return "0 KB";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

// Helper: parse bytes from formatted string (e.g. "1.5 MB" -> bytes)
export function parseSizeToBytes(sizeInput) {
    if (typeof sizeInput === "number") return sizeInput;
    if (!sizeInput || typeof sizeInput !== "string") return 0;
    const str = sizeInput.trim();
    const match = str.match(/^([\d.]+)\s*([a-zA-Z]+)?$/);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = (match[2] || "KB").toUpperCase();
    const k = 1024;
    switch (unit) {
        case "B": return Math.round(val);
        case "KB": return Math.round(val * k);
        case "MB": return Math.round(val * k * k);
        case "GB": return Math.round(val * k * k * k);
        default: return Math.round(val * k);
    }
}

// In-memory cache to prevent duplicate saves (double-clicks, re-renders)
const recentSaves = new Map();

function getSaveFingerprint(uid, filename, type, compBytes) {
    return `${uid}_${filename}_${type}_${compBytes}`;
}

const PENDING_STORAGE_KEY = "sn_pending_history";

function getPendingQueue() {
    try {
        const raw = localStorage.getItem(PENDING_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function setPendingQueue(queue) {
    try {
        localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(queue));
    } catch {
        // storage quota or private browsing
    }
}

/**
 * Saves a compression result to history.
 * - Stores metadata in Firestore
 * - Optionally caches blob locally in IndexedDB (non-blocking)
 *
 * @param {object} opts
 * @param {string}        opts.filename           - Original filename
 * @param {string|number} [opts.originalSize]     - Formatted string or byte count
 * @param {string|number} [opts.compressedSize]   - Formatted string or byte count
 * @param {number}        [opts.originalSizeBytes]
 * @param {number}        [opts.compressedSizeBytes]
 * @param {number}        [opts.saved]            - Saved percentage
 * @param {string}        opts.type               - "pdf" | "image" | "video" | "audio" | "archive"
 * @param {File|Blob}     [opts.compressedFile]   - Optional client blob
 */
export async function saveCompressionHistory({
    filename,
    originalSize,
    compressedSize,
    originalSizeBytes,
    compressedSizeBytes,
    saved,
    type,
    compressedFile
}) {
    if (!auth.currentUser) return;

    const user = auth.currentUser;
    const now = Date.now();

    // Calculate numeric byte sizes
    const origBytes = typeof originalSizeBytes === "number"
        ? originalSizeBytes
        : parseSizeToBytes(originalSize);

    let compBytes = typeof compressedSizeBytes === "number"
        ? compressedSizeBytes
        : (compressedFile && compressedFile.size ? compressedFile.size : parseSizeToBytes(compressedSize));

    // Calculate percentage if not explicitly given
    let savedPct = typeof saved === "number" ? Math.round(saved) : 0;
    if (savedPct === 0 && origBytes > 0 && compBytes > 0 && origBytes >= compBytes) {
        savedPct = Math.round(((origBytes - compBytes) / origBytes) * 100);
    }

    // Deduplication check: prevent duplicate saves within 8 seconds
    const fp = getSaveFingerprint(user.uid, filename, type, compBytes);
    const lastSavedTime = recentSaves.get(fp);
    if (lastSavedTime && (now - lastSavedTime) < 8000) {
        console.log("Duplicate compression save ignored:", fp);
        return;
    }
    recentSaves.set(fp, now);

    // Prune cache if it grows
    if (recentSaves.size > 50) {
        for (const [k, t] of recentSaves.entries()) {
            if (now - t > 15000) recentSaves.delete(k);
        }
    }

    const localKey = `${user.uid}_${now}`;

    // Optionally save blob to IndexedDB non-blockingly without throwing
    if (compressedFile) {
        saveFileLocally(localKey, compressedFile).catch(err => {
            console.warn("IndexedDB local blob save skipped:", err);
        });
    }

    const docData = {
        uid: user.uid,
        filename: filename || "Untitled",
        compressedName: `compressed_${filename || "file"}`,
        originalSize: typeof originalSize === "string" ? originalSize : formatBytes(origBytes),
        compressedSize: typeof compressedSize === "string" ? compressedSize : formatBytes(compBytes),
        originalSizeBytes: origBytes,
        compressedSizeBytes: compBytes,
        saved: savedPct,
        type: (type || "file").toLowerCase(),
        date: new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }),
        createdAt: new Date().toISOString(), // UTC ISO representation
        timestamp: serverTimestamp(),
        localKey: localKey
    };

    try {
        await addDoc(collection(db, "history"), docData);
        console.log("History metadata saved to Firestore:", filename);
    } catch (err) {
        console.warn("Firestore history save failed, queuing for offline retry:", err);
        const queue = getPendingQueue();
        queue.push({
            ...docData,
            timestamp: null // serverTimestamp cannot be serialized to JSON
        });
        setPendingQueue(queue);
    }
}

/**
 * Flush any queued offline records when back online
 */
export async function syncPendingHistory() {
    if (!auth.currentUser || !navigator.onLine) return;
    const queue = getPendingQueue();
    if (!queue.length) return;

    setPendingQueue([]);
    for (const item of queue) {
        try {
            await addDoc(collection(db, "history"), {
                ...item,
                timestamp: serverTimestamp()
            });
        } catch (err) {
            console.warn("Failed to sync queued record, re-queuing:", err);
            const cur = getPendingQueue();
            cur.push(item);
            setPendingQueue(cur);
            break;
        }
    }
}

// Auto-sync when internet comes back
window.addEventListener("online", () => {
    syncPendingHistory().catch(() => {});
});

/**
 * Deletes a single history record from Firestore and IndexedDB
 */
export async function deleteHistoryRecord(id, localKey) {
    if (!auth.currentUser) throw new Error("Must be logged in to delete records.");

    // Delete from Firestore
    await deleteDoc(doc(db, "history", id));

    // Delete local cached blob if exists
    if (localKey) {
        await deleteFileLocally(localKey).catch(() => {});
    }
    return true;
}

/**
 * Deletes all history records for a user
 */
export async function clearAllUserHistory(records) {
    if (!auth.currentUser) throw new Error("Must be logged in to clear history.");

    const batch = writeBatch(db);
    const deletePromises = [];

    for (const record of records) {
        if (record.id) {
            batch.delete(doc(db, "history", record.id));
        }
        if (record.localKey) {
            deletePromises.push(deleteFileLocally(record.localKey).catch(() => {}));
        }
    }

    await batch.commit();
    await Promise.all(deletePromises);
    return true;
}
