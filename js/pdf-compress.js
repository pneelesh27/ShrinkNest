// ==========================================
// SHRINKNEST PDF COMPRESSOR
// File: js/pdf-compress.js
// ==========================================

import { auth } from "./firebase-config.js";
import { calculateSavedPercentage, formatFileSize } from "./utils.js";
import { saveCompressionHistory } from "./history.js";
import { compressToTargetSize } from "./targetSizeSearch.js";

const uploadInput = document.getElementById("pdfFile");
const compressBtn = document.getElementById("compressBtn");
const levelSelect = document.getElementById("compressionLevel");

const fileName = document.getElementById("fileName");
const originalSize = document.getElementById("originalSize");
const compressedSize = document.getElementById("compressedSize");
const savedPercent = document.getElementById("savedPercent");

const downloadBtn = document.getElementById("downloadBtn");
const cancelCompressBtn = document.getElementById("cancelCompressBtn");
const progressStatus = document.getElementById("progressStatus");
const targetSizeError = document.getElementById("targetSizeError");

const resultSummary = document.getElementById("resultSummary");
const resultMessage = document.getElementById("resultMessage");
const rasterizeNote = document.getElementById("rasterizeNote");

const compressMethodRadios = document.getElementsByName("compressMethod");
const levelControlGroup = document.getElementById("levelControlGroup");
const sizeControlGroup = document.getElementById("sizeControlGroup");
const targetSizeInput = document.getElementById("targetSizeInput");

let selectedFile = null;
let compressedBlob = null;
let isCancelled = false;

// Ensure pdf.js worker is always configured
if (window.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
}

function showTargetError(msg) {
    if (targetSizeError) {
        targetSizeError.textContent = msg;
        targetSizeError.style.display = "block";
    }
}

function hideTargetError() {
    if (targetSizeError) {
        targetSizeError.textContent = "";
        targetSizeError.style.display = "none";
    }
}

if (targetSizeInput) {
    targetSizeInput.addEventListener("input", () => {
        const val = Number(targetSizeInput.value);
        if (val && val < 20) {
            showTargetError("Please enter a target size of at least 20 KB.");
        } else {
            hideTargetError();
        }
    });
}

// Toggle options visibility
compressMethodRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
        if (e.target.value === "level") {
            levelControlGroup.style.display = "flex";
            sizeControlGroup.style.display = "none";
            hideTargetError();
        } else {
            levelControlGroup.style.display = "none";
            sizeControlGroup.style.display = "flex";
        }
    });
});

// ==========================================
// FILE SELECT
// ==========================================

uploadInput.addEventListener("change", (e) => {
    selectedFile = e.target.files[0];

    if (!selectedFile) return;

    fileName.textContent = selectedFile.name;
    originalSize.textContent = formatFileSize(selectedFile.size);

    // Reset previous compression results
    compressedBlob = null;
    if (downloadBtn) downloadBtn.style.display = "none";
    const resultCard = document.getElementById("resultCard");
    if (resultCard) resultCard.style.display = "none";
    if (resultSummary) resultSummary.style.display = "none";
    if (resultMessage) resultMessage.style.display = "none";
    if (rasterizeNote) rasterizeNote.style.display = "none";
    if (progressStatus) progressStatus.style.display = "none";
    hideTargetError();
});

// ==========================================
// PDF COMPRESS
// ==========================================

compressBtn.addEventListener("click", async () => {
    if (!selectedFile) {
        alert("Please select a PDF file.");
        return;
    }

    const method = Array.from(compressMethodRadios).find(r => r.checked).value;

    // Validate target size mode input before starting
    if (method === "size") {
        const targetVal = Number(targetSizeInput.value);
        if (!targetVal || targetVal <= 0) {
            showTargetError("Please enter a positive target size (in KB).");
            return;
        }
        if (targetVal < 20) {
            showTargetError("Please enter a target size of at least 20 KB.");
            return;
        }
        hideTargetError();
    }

    compressBtn.disabled = true;
    compressBtn.textContent = "Compressing...";
    isCancelled = false;

    if (cancelCompressBtn && method === "size") {
        cancelCompressBtn.style.display = "inline-block";
        cancelCompressBtn.disabled = false;
        cancelCompressBtn.textContent = "Cancel";
        cancelCompressBtn.onclick = () => {
            isCancelled = true;
            cancelCompressBtn.disabled = true;
            cancelCompressBtn.textContent = "Cancelling...";
        };
    }

    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");

    if (progressContainer) {
        progressContainer.style.display = "block";
    }
    if (progressBar) {
        progressBar.style.width = "0%";
    }
    if (progressStatus) {
        progressStatus.textContent = "Loading PDF...";
        progressStatus.style.display = "block";
    }

    // Reset result elements
    if (resultSummary) resultSummary.style.display = "none";
    if (resultMessage) resultMessage.style.display = "none";
    if (rasterizeNote) rasterizeNote.style.display = "none";

    try {
        const arrayBuffer = await selectedFile.arrayBuffer();

        // Ensure PDF.js worker is ready
        if (window.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
        }

        let newSize = 0;
        let saved = "0.0";

        if (method === "level") {
            // ==========================================
            // "BY LEVEL" MODE (100% UNTOUCHED BEHAVIOR)
            // ==========================================
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            const totalPages = pdf.numPages;

            const newPdfDoc = await PDFLib.PDFDocument.create();

            const level = levelSelect.value; // "low", "medium", "high"
            let scale = 1.0;
            let quality = 0.6;

            if (level === "low") {
                scale = 1.5;
                quality = 0.85;
            } else if (level === "medium") {
                scale = 1.0;
                quality = 0.60;
            } else if (level === "high") {
                scale = 0.8;
                quality = 0.35;
            }

            for (let i = 1; i <= totalPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: scale });

                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                await page.render(renderContext).promise;

                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                const img = await newPdfDoc.embedJpg(dataUrl);

                const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
                newPage.drawImage(img, {
                    x: 0,
                    y: 0,
                    width: viewport.width,
                    height: viewport.height
                });

                if (progressBar) {
                    progressBar.style.width = `${Math.round((i / totalPages) * 100)}%`;
                }
            }

            const pdfBytes = await newPdfDoc.save();
            compressedBlob = new Blob([pdfBytes], { type: "application/pdf" });
            newSize = compressedBlob.size;

            compressedSize.textContent = formatFileSize(newSize);
            saved = calculateSavedPercentage(selectedFile.size, newSize);
            savedPercent.textContent = saved + "%";

        } else {
            // ==========================================
            // "BY TARGET SIZE" MODE (ACCURATE SEARCH)
            // ==========================================
            const targetSizeKB = Number(targetSizeInput.value) || 150;

            const result = await compressToTargetSize({
                arrayBuffer,
                targetSizeKB,
                pdfjsLib: window.pdfjsLib,
                PDFLib: window.PDFLib,
                onProgress: ({ message, progress }) => {
                    if (progressStatus) {
                        progressStatus.textContent = message;
                    }
                    if (progressBar) {
                        progressBar.style.width = `${progress}%`;
                    }
                },
                shouldCancel: () => isCancelled
            });

            compressedBlob = result.blob;
            newSize = result.finalSize;

            compressedSize.textContent = formatFileSize(newSize);
            saved = calculateSavedPercentage(selectedFile.size, newSize);
            savedPercent.textContent = saved + "%";

            // Format clean result summary: "Target: 2000 KB | Result: 1,962 KB | Saved 61%"
            const targetKBStr = targetSizeKB.toLocaleString();
            const resultKBStr = Math.round(newSize / 1024).toLocaleString();

            if (resultSummary) {
                resultSummary.textContent = `Target: ${targetKBStr} KB | Result: ${resultKBStr} KB | Saved ${saved}%`;
                resultSummary.style.display = "block";
            }

            if (result.message && resultMessage) {
                resultMessage.textContent = result.message;
                resultMessage.style.display = "block";
            }

            if (result.rasterized && rasterizeNote) {
                rasterizeNote.textContent = result.note;
                rasterizeNote.style.display = "block";
            }
        }

        // Enable Download Button
        downloadBtn.style.display = "inline-block";

        // Show Result Card
        const resultCard = document.getElementById("resultCard");
        if (resultCard) {
            resultCard.style.display = "block";
        }

        if (progressStatus) {
            progressStatus.textContent = "Compression complete!";
        }

        // Save History (if logged in)
        if (auth.currentUser) {
            saveCompressionHistory({
                filename: selectedFile.name,
                originalSize: formatFileSize(selectedFile.size),
                compressedSize: formatFileSize(newSize),
                saved: saved,
                type: "pdf",
                compressedFile: compressedBlob
            });
        }

    } catch (error) {
        console.error("PDF Compression failed:", error);

        let userMsg = "Failed to compress PDF.";
        if (error.name === "PasswordException" || (error.message && error.message.toLowerCase().includes("password"))) {
            userMsg = "This PDF is password-protected. Please remove the password before compressing.";
        } else if (error.message && error.message.toLowerCase().includes("cancelled")) {
            userMsg = "Compression cancelled.";
        } else if (error.message && (error.message.toLowerCase().includes("memory") || error.name === "RangeError")) {
            userMsg = "Out of memory: this PDF is too large for browser memory. Try compressing a smaller file or splitting it.";
        } else if (error.message && (error.message.toLowerCase().includes("corrupt") || error.message.toLowerCase().includes("invalid"))) {
            userMsg = "This PDF file appears to be corrupted or invalid.";
        } else if (error.message) {
            userMsg = error.message;
        }

        if (progressStatus) {
            progressStatus.textContent = userMsg;
            progressStatus.style.color = "#dc2626";
        }

        alert(userMsg);

    } finally {
        compressBtn.disabled = false;
        compressBtn.textContent = "Compress PDF";
        if (cancelCompressBtn) {
            cancelCompressBtn.style.display = "none";
            cancelCompressBtn.disabled = false;
            cancelCompressBtn.textContent = "Cancel";
        }
        if (progressBar) {
            progressBar.style.width = "100%";
        }
    }
});

// ==========================================
// DOWNLOAD
// ==========================================

downloadBtn.addEventListener("click", () => {
    if (!compressedBlob) {
        alert("Please compress the PDF first.");
        return;
    }

    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile.name.replace(".pdf", "-compressed.pdf");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// ==========================================
// DRAG & DROP SUPPORT
// ==========================================

const uploadBox = document.querySelector(".upload-box");

if (uploadBox) {
    uploadBox.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadBox.classList.add("dragover");
    });

    uploadBox.addEventListener("dragleave", () => {
        uploadBox.classList.remove("dragover");
    });

    uploadBox.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadBox.classList.remove("dragover");

        if (e.dataTransfer.files.length) {
            uploadInput.files = e.dataTransfer.files;
            uploadInput.dispatchEvent(new Event("change"));
        }
    });
}
