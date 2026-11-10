// ==========================================
// SHRINKNEST DASHBOARD
// File: js/dashboard.js
// Handles Compression History loading, rendering,
// filtering, pagination, deletion, and summary.
// ==========================================

import { db, auth } from "./firebase-config.js";
import { getFileLocally } from "./localstore.js";
import {
    deleteHistoryRecord,
    clearAllUserHistory,
    formatBytes,
    parseSizeToBytes
} from "./history.js";

import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

// State
let allRecords = [];
let filteredRecords = [];
let activeFilter = "all";
let visibleCount = 10;
let pendingAction = null; // { type: 'single', record } or { type: 'clear' }
let isInitialized = false;

// ── Toast Notification ───────────────────────
function showToast(message, isError = false) {
    const toast = document.getElementById("historyToast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = `history-toast ${isError ? "error" : "success"}`;
    toast.style.display = "block";
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.display = "none";
    }, 3500);
}

// ── Date Formatter ───────────────────────────
// Formats timestamps into "10 Nov 2026, 3:45 PM"
function formatHistoryDate(item) {
    let dateObj = null;

    if (item.timestamp && typeof item.timestamp.toDate === "function") {
        dateObj = item.timestamp.toDate();
    } else if (item.timestamp && item.timestamp.seconds) {
        dateObj = new Date(item.timestamp.seconds * 1000);
    } else if (item.createdAt) {
        dateObj = new Date(item.createdAt);
    } else if (item.date) {
        // Fallback if only string date exists
        return item.date;
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
        return item.date || "Recent";
    }

    const datePart = dateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
    const timePart = dateObj.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
    return `${datePart}, ${timePart}`;
}

// ── Shimmer Skeleton Rows ────────────────────
function renderSkeletonRows(historyBody, count = 5) {
    let rowsHtml = "";
    for (let i = 0; i < count; i++) {
        rowsHtml += `
            <tr class="skeleton-row" role="row">
                <td data-label="Filename"><span class="skeleton-pill w-lg"></span></td>
                <td data-label="Original Size"><span class="skeleton-pill w-sm"></span></td>
                <td data-label="Compressed Size"><span class="skeleton-pill w-sm"></span></td>
                <td data-label="Saved"><span class="skeleton-pill w-xs"></span></td>
                <td data-label="Date"><span class="skeleton-pill w-md"></span></td>
                <td data-label="Type"><span class="skeleton-badge"></span></td>
                <td data-label="Action"><span class="skeleton-pill w-xs"></span></td>
            </tr>`;
    }
    historyBody.innerHTML = rowsHtml;
}

// ── Fetch History with Timeout & Auto-retry ──
async function fetchUserHistory(uid, attempt = 1) {
    const historyRef = collection(db, "history");
    const q = query(historyRef, where("uid", "==", uid));

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out. Please check your network.")), 8000);
    });

    try {
        const snapshot = await Promise.race([getDocs(q), timeoutPromise]);
        const records = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        // Client-side sort descending by timestamp / createdAt (index-free & reliable)
        records.sort((a, b) => {
            const timeA = a.timestamp?.toMillis
                ? a.timestamp.toMillis()
                : (a.timestamp?.seconds
                    ? a.timestamp.seconds * 1000
                    : (a.createdAt ? new Date(a.createdAt).getTime() : 0));
            const timeB = b.timestamp?.toMillis
                ? b.timestamp.toMillis()
                : (b.timestamp?.seconds
                    ? b.timestamp.seconds * 1000
                    : (b.createdAt ? new Date(b.createdAt).getTime() : 0));
            return timeB - timeA;
        });

        return records;
    } catch (err) {
        if (attempt === 1 && !err.message?.includes("timed out")) {
            console.warn("First attempt failed, retrying history fetch in 1s...", err);
            await new Promise(r => setTimeout(r, 1000));
            return fetchUserHistory(uid, 2);
        }
        throw err;
    }
}

// ── Update Summary Line ──────────────────────
function updateSummary(records) {
    const summaryEl = document.getElementById("historySummary");
    const clearBtn = document.getElementById("clearHistoryBtn");
    if (!summaryEl) return;

    if (!records.length) {
        summaryEl.style.display = "none";
        if (clearBtn) clearBtn.style.display = "none";
        return;
    }

    let totalBytesSaved = 0;
    records.forEach(item => {
        const orig = typeof item.originalSizeBytes === "number" && item.originalSizeBytes > 0
            ? item.originalSizeBytes
            : parseSizeToBytes(item.originalSize);
        const comp = typeof item.compressedSizeBytes === "number" && item.compressedSizeBytes > 0
            ? item.compressedSizeBytes
            : parseSizeToBytes(item.compressedSize);
        if (orig > comp) {
            totalBytesSaved += (orig - comp);
        }
    });

    const fileWord = records.length === 1 ? "file" : "files";
    summaryEl.textContent = `${records.length} ${fileWord} compressed • ${formatBytes(totalBytesSaved)} saved`;
    summaryEl.style.display = "block";

    if (clearBtn) clearBtn.style.display = "inline-flex";
}

// ── Render History Rows ──────────────────────
async function renderCurrentView() {
    const historyBody     = document.getElementById("historyBody");
    const historyTable    = document.getElementById("historyTable");
    const emptyState      = document.getElementById("emptyState");
    const filterBar       = document.getElementById("historyFilterBar");
    const paginationWrap  = document.getElementById("historyPagination");
    const loadMoreCount   = document.getElementById("loadMoreCount");
    const errorState      = document.getElementById("historyErrorState");

    if (errorState) errorState.style.display = "none";

    // 1. Total empty (no records at all)
    if (allRecords.length === 0) {
        historyTable.style.display = "none";
        if (filterBar) filterBar.style.display = "none";
        if (paginationWrap) paginationWrap.style.display = "none";
        updateSummary([]);
        if (emptyState) {
            emptyState.style.display = "block";
            const emptyTitle = document.getElementById("emptyStateTitle");
            const emptyText  = document.getElementById("emptyStateText");
            if (emptyTitle) emptyTitle.textContent = "No compressions yet.";
            if (emptyText) emptyText.textContent = "Start compressing your files to see history here.";
        }
        return;
    }

    // Records exist: show table and filter toolbar
    if (emptyState) emptyState.style.display = "none";
    historyTable.style.display = "table";
    if (filterBar) filterBar.style.display = "block";
    updateSummary(allRecords);

    // Apply active filter
    if (activeFilter === "all") {
        filteredRecords = [...allRecords];
    } else {
        filteredRecords = allRecords.filter(r => (r.type || "").toLowerCase() === activeFilter);
    }

    // 2. Filter result empty
    if (filteredRecords.length === 0) {
        historyBody.innerHTML = `
            <tr role="row">
                <td colspan="7" class="filter-empty-cell">
                    <i class="fas fa-filter" style="margin-right:8px;opacity:0.6;"></i>
                    No ${activeFilter.toUpperCase()} compression records found.
                </td>
            </tr>`;
        if (paginationWrap) paginationWrap.style.display = "none";
        return;
    }

    // 3. Slice for pagination
    const visibleRecords = filteredRecords.slice(0, visibleCount);
    historyBody.innerHTML = "";

    for (const item of visibleRecords) {
        const row = document.createElement("tr");
        row.dataset.id = item.id;
        row.setAttribute("role", "row");

        // Filename truncation
        const rawName = item.filename || "Untitled";
        const shortName = rawName.length > 24
            ? rawName.substring(0, 22) + "…"
            : rawName;

        // Size formatting
        const origBytes = typeof item.originalSizeBytes === "number" && item.originalSizeBytes > 0
            ? item.originalSizeBytes
            : parseSizeToBytes(item.originalSize);
        const compBytes = typeof item.compressedSizeBytes === "number" && item.compressedSizeBytes > 0
            ? item.compressedSizeBytes
            : parseSizeToBytes(item.compressedSize);

        const displayOrig = formatBytes(origBytes);
        const displayComp = formatBytes(compBytes);

        // Saved % formatting
        const savedVal = typeof item.saved === "number" ? item.saved : parseInt(item.saved, 10) || 0;
        const savedHtml = savedVal > 0
            ? `<strong class="saved-positive">+${savedVal}%</strong>`
            : `<span class="saved-neutral">${savedVal}%</span>`;

        // Date
        const displayDate = formatHistoryDate(item);

        // Badge
        const typeNorm = (item.type || "file").toLowerCase();
        const typeLabels = {
            pdf: "PDF",
            image: "IMAGE",
            video: "VIDEO",
            audio: "AUDIO",
            archive: "ARCHIVE",
            word: "WORD"
        };
        const badgeLabel = typeLabels[typeNorm] || typeNorm.toUpperCase();

        // Local file download check (optional, only if cached in this browser)
        let downloadBtnHtml = "";
        if (item.localKey) {
            try {
                const blob = await getFileLocally(item.localKey);
                if (blob) {
                    const ext = rawName.includes(".") ? rawName.substring(rawName.lastIndexOf(".")) : "";
                    const downloadName = `compressed_${rawName.replace(/\.[^/.]+$/, "")}${ext}`;
                    const objectURL = URL.createObjectURL(blob);
                    downloadBtnHtml = `
                        <a href="${objectURL}" download="${downloadName}" class="history-action-download" title="Download compressed file" aria-label="Download ${rawName}">
                            <i class="fas fa-download"></i>
                        </a>`;
                }
            } catch {
                // Ignore IndexedDB read errors
            }
        }

        // Delete button
        const deleteBtnHtml = `
            <button type="button" class="history-action-delete" title="Delete record" aria-label="Delete ${rawName} record" data-id="${item.id}">
                <i class="fas fa-trash-alt"></i>
            </button>`;

        row.innerHTML = `
            <td data-label="Filename" title="${rawName}">
                <div class="filename-cell">
                    <i class="fas fa-file filename-icon"></i>
                    <span class="filename-text">${shortName}</span>
                </div>
            </td>
            <td data-label="Original Size">${displayOrig}</td>
            <td data-label="Compressed Size">${displayComp}</td>
            <td data-label="Saved">${savedHtml}</td>
            <td data-label="Date">${displayDate}</td>
            <td data-label="Type">
                <span class="badge badge-${typeNorm}">
                    ${badgeLabel}
                </span>
            </td>
            <td data-label="Action">
                <div class="action-cell">
                    ${downloadBtnHtml}
                    ${deleteBtnHtml}
                </div>
            </td>
        `;

        // Attach delete listener
        const delBtn = row.querySelector(".history-action-delete");
        if (delBtn) {
            delBtn.addEventListener("click", () => {
                promptDeleteSingle(item);
            });
        }

        historyBody.appendChild(row);
    }

    // Update pagination controls
    if (paginationWrap && loadMoreCount) {
        const remaining = filteredRecords.length - visibleRecords.length;
        if (remaining > 0) {
            paginationWrap.style.display = "block";
            loadMoreCount.textContent = remaining;
        } else {
            paginationWrap.style.display = "none";
        }
    }
}

// ── Modals & Confirmation ────────────────────
function openConfirmModal(title, desc, confirmLabel, actionType, payload) {
    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("modalTitle");
    const descEl = document.getElementById("modalDesc");
    const confirmBtn = document.getElementById("modalConfirmBtn");

    if (!modal) return;
    titleEl.textContent = title;
    descEl.textContent = desc;
    confirmBtn.textContent = confirmLabel;
    pendingAction = { type: actionType, payload };

    modal.style.display = "flex";
    confirmBtn.focus();
}

function closeConfirmModal() {
    const modal = document.getElementById("confirmModal");
    if (modal) modal.style.display = "none";
    pendingAction = null;
}

function promptDeleteSingle(record) {
    openConfirmModal(
        "Delete Record?",
        `Are you sure you want to delete "${record.filename || 'this record'}"? This cannot be undone.`,
        "Delete",
        "single",
        record
    );
}

function promptClearAll() {
    openConfirmModal(
        "Clear All History?",
        `Are you sure you want to delete all ${allRecords.length} compression records? This cannot be undone.`,
        "Clear All",
        "clear",
        null
    );
}

// Optimistic single record deletion
async function executeDeleteSingle(record) {
    closeConfirmModal();
    const backupAll = [...allRecords];

    // Optimistic UI update
    allRecords = allRecords.filter(r => r.id !== record.id);
    await renderCurrentView();
    showToast("Record deleted");

    try {
        await deleteHistoryRecord(record.id, record.localKey);
    } catch (err) {
        console.error("Delete failed on server:", err);
        // Rollback
        allRecords = backupAll;
        await renderCurrentView();
        showToast("Failed to delete record. Rolled back.", true);
    }
}

// Optimistic clear all history
async function executeClearAll() {
    closeConfirmModal();
    const backupAll = [...allRecords];

    // Optimistic UI update
    allRecords = [];
    await renderCurrentView();
    showToast("History cleared");

    try {
        await clearAllUserHistory(backupAll);
    } catch (err) {
        console.error("Clear all failed on server:", err);
        // Rollback
        allRecords = backupAll;
        await renderCurrentView();
        showToast("Failed to clear history. Rolled back.", true);
    }
}

// ── Setup Event Listeners Once ───────────────
function initDashboardListeners(uid) {
    if (isInitialized) return;
    isInitialized = true;

    // Filter Chips
    const chips = document.querySelectorAll(".filter-chips .chip");
    chips.forEach(chip => {
        chip.addEventListener("click", () => {
            chips.forEach(c => {
                c.classList.remove("active");
                c.setAttribute("aria-checked", "false");
            });
            chip.classList.add("active");
            chip.setAttribute("aria-checked", "true");
            activeFilter = chip.dataset.filter || "all";
            visibleCount = 10;
            renderCurrentView();
        });
    });

    // Pagination Load More
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", () => {
            visibleCount += 10;
            renderCurrentView();
        });
    }

    // Clear All Button
    const clearBtn = document.getElementById("clearHistoryBtn");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (allRecords.length > 0) promptClearAll();
        });
    }

    // Modal Action Buttons
    const cancelBtn = document.getElementById("modalCancelBtn");
    const confirmBtn = document.getElementById("modalConfirmBtn");
    const modalOverlay = document.getElementById("confirmModal");

    if (cancelBtn) cancelBtn.addEventListener("click", closeConfirmModal);
    if (confirmBtn) {
        confirmBtn.addEventListener("click", () => {
            if (!pendingAction) return;
            if (pendingAction.type === "single") {
                executeDeleteSingle(pendingAction.payload);
            } else if (pendingAction.type === "clear") {
                executeClearAll();
            }
        });
    }

    if (modalOverlay) {
        modalOverlay.addEventListener("click", (e) => {
            if (e.target === modalOverlay) closeConfirmModal();
        });
    }

    // Close on Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modalOverlay && modalOverlay.style.display === "flex") {
            closeConfirmModal();
        }
    });

    // Error State Retry Button
    const retryBtn = document.getElementById("historyRetryBtn");
    if (retryBtn) {
        retryBtn.addEventListener("click", () => {
            loadDashboard();
        });
    }
}

// ==========================================
// MAIN: LOAD DASHBOARD
// ==========================================
export async function loadDashboard() {
    const historyBody    = document.getElementById("historyBody");
    const historyTable   = document.getElementById("historyTable");
    const emptyState     = document.getElementById("emptyState");
    const filterBar      = document.getElementById("historyFilterBar");
    const paginationWrap = document.getElementById("historyPagination");
    const errorState     = document.getElementById("historyErrorState");

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Session expired / unauthenticated state
            if (historyTable) historyTable.style.display = "none";
            if (filterBar) filterBar.style.display = "none";
            if (paginationWrap) paginationWrap.style.display = "none";
            if (emptyState) {
                emptyState.style.display = "block";
                const emptyTitle = document.getElementById("emptyStateTitle");
                const emptyText  = document.getElementById("emptyStateText");
                const emptyBtn   = document.getElementById("emptyStateAction");
                if (emptyTitle) emptyTitle.textContent = "Session Expired";
                if (emptyText) emptyText.textContent = "Please log in to access your compression history.";
                if (emptyBtn) {
                    emptyBtn.href = "login.html";
                    emptyBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Log In';
                }
            }
            return;
        }

        initDashboardListeners(user.uid);

        // Show Shimmer Skeleton Rows
        if (errorState) errorState.style.display = "none";
        if (emptyState) emptyState.style.display = "none";
        if (historyTable) historyTable.style.display = "table";
        renderSkeletonRows(historyBody, 5);

        try {
            allRecords = await fetchUserHistory(user.uid);
            visibleCount = 10;
            await renderCurrentView();
        } catch (error) {
            console.error("Dashboard History Error:", error);

            if (historyTable) historyTable.style.display = "none";
            if (filterBar) filterBar.style.display = "none";
            if (paginationWrap) paginationWrap.style.display = "none";
            if (emptyState) emptyState.style.display = "none";

            if (errorState) {
                errorState.style.display = "block";
                const errorMsg = document.getElementById("historyErrorMessage");
                if (errorMsg) {
                    errorMsg.textContent = error.message?.includes("timed out")
                        ? "Connection timed out. Please check your internet connection and try again."
                        : "Failed to retrieve your compression history. Please try again.";
                }
            }
        }
    });
}
