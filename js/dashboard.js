// ==========================================
// SHRINKNEST DASHBOARD
// File: js/dashboard.js
// ==========================================

import { db, auth } from "./firebase-config.js";
import { getFileLocally } from "./localstore.js";

import {
    collection,
    query,
    where,
    orderBy,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

// ==========================================
// LOAD DASHBOARD
// ==========================================

export async function loadDashboard() {

    onAuthStateChanged(auth, async (user) => {

        if (!user) return;

        const historyBody = document.getElementById("historyBody");
        const emptyState  = document.getElementById("emptyState");

        historyBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:24px;opacity:0.6;">
                    <i class="fas fa-spinner fa-spin"></i> Loading history...
                </td>
            </tr>`;

        try {

            const historyRef = collection(db, "history");

            const q = query(
                historyRef,
                where("uid", "==", user.uid),
                orderBy("timestamp", "desc")
            );

            const snapshot = await getDocs(q);

            historyBody.innerHTML = "";

            if (snapshot.empty) {
                emptyState.style.display = "block";
                return;
            }

            emptyState.style.display = "none";

            for (const docSnap of snapshot.docs) {

                const item = docSnap.data();
                const row  = document.createElement("tr");

                // Try to get the file from IndexedDB (only works on same browser/device)
                let downloadCell = `
                    <span class="history-unavailable" title="File is only available on the device where it was compressed">
                        <i class="fas fa-info-circle"></i> Re-compress to download
                    </span>`;

                if (item.localKey) {
                    const blob = await getFileLocally(item.localKey);
                    if (blob) {
                        const ext = item.filename.includes(".")
                            ? item.filename.substring(item.filename.lastIndexOf("."))
                            : "";
                        const downloadName = `compressed_${item.filename.replace(/\.[^/.]+$/, "")}${ext}`;
                        const objectURL = URL.createObjectURL(blob);

                        downloadCell = `
                            <a href="${objectURL}"
                               download="${downloadName}"
                               class="history-download-btn"
                               title="Download compressed file">
                                <i class="fas fa-download"></i> Download
                            </a>`;
                    }
                }

                const shortName = item.filename.length > 22
                    ? item.filename.substring(0, 20) + "…"
                    : item.filename;

                row.innerHTML = `
                    <td title="${item.filename}">${shortName}</td>
                    <td>${item.originalSize}</td>
                    <td>${item.compressedSize}</td>
                    <td><strong style="color:#48cfad">${item.saved}%</strong></td>
                    <td>${item.date}</td>
                    <td>
                        <span class="badge badge-${item.type}">
                            ${item.type.toUpperCase()}
                        </span>
                    </td>
                    <td>${downloadCell}</td>
                `;

                historyBody.appendChild(row);

            }

        } catch (error) {

            console.error("Dashboard Error:", error);
            historyBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:24px;color:#ef4444;">
                        Failed to load history. Please refresh.
                    </td>
                </tr>`;

        }

    });

}

// ==========================================
// FORMAT FILE SIZE
// ==========================================

export function formatFileSize(bytes) {

    if (bytes < 1024) return bytes + " B";

    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(2) + " KB";

    if (bytes < 1024 * 1024 * 1024)
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";

    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";

}

// ==========================================
// REFRESH HISTORY
// ==========================================

export function refreshDashboard() {

    loadDashboard();

}

// ==========================================
// CLEAR TABLE
// ==========================================

export function clearDashboardTable() {

    const body = document.getElementById("historyBody");

    if (body) {

        body.innerHTML = "";

    }

}

// ==========================================
// DASHBOARD INITIALIZER
// ==========================================

export function initializeDashboard() {

    loadDashboard();

}

// ==========================================
// AUTO INITIALIZE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    initializeDashboard();

});

// ==========================================
// END OF FILE
// ==========================================