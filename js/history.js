// ==========================================
// ShrinkNest History Utility
// File: js/history.js
// Saves compressed file to IndexedDB (local)
// and metadata to Firestore for history display.
// ==========================================

import { auth, db } from "./firebase-config.js";
import { saveFileLocally } from "./localstore.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

/**
 * Saves a compression result to history.
 * - Stores the compressed file blob in IndexedDB (local, this device)
 * - Stores metadata + localKey in Firestore (synced across devices)
 *
 * @param {object} opts
 * @param {string}    opts.filename       - Original filename
 * @param {string}    opts.originalSize   - Formatted original size string
 * @param {string}    opts.compressedSize - Formatted compressed size string
 * @param {number}    opts.saved          - Percentage saved
 * @param {string}    opts.type           - "image" | "pdf" | "video"
 * @param {File|Blob} opts.compressedFile - The compressed file/blob
 */
export async function saveCompressionHistory({
    filename,
    originalSize,
    compressedSize,
    saved,
    type,
    compressedFile
}) {
    if (!auth.currentUser) return;

    const user      = auth.currentUser;
    const timestamp = Date.now();
    const localKey  = `${user.uid}_${timestamp}`;

    // 1. Save file blob to IndexedDB (browser-local, free, no size limit)
    await saveFileLocally(localKey, compressedFile);

    // 2. Save metadata to Firestore (so history shows on any device)
    try {
        await addDoc(collection(db, "history"), {
            uid:              user.uid,
            filename:         filename,
            compressedName:   `compressed_${filename}`,
            originalSize:     originalSize,
            compressedSize:   compressedSize,
            saved:            saved,
            type:             type,
            date:             new Date().toLocaleDateString("en-IN", {
                                  day:   "2-digit",
                                  month: "short",
                                  year:  "numeric"
                              }),
            timestamp:        serverTimestamp(),
            localKey:         localKey   // used to retrieve file from IndexedDB
        });

        console.log("History saved:", localKey);
    } catch (err) {
        console.error("Firestore history save failed:", err);
    }
}
