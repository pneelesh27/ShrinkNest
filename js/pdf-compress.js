// ==========================================
// SHRINKNEST PDF COMPRESSOR
// File: js/pdf-compress.js
// ==========================================

import { auth } from "./firebase-config.js";
import { calculateSavedPercentage, formatFileSize } from "./utils.js";
import { saveCompressionHistory } from "./history.js";

const uploadInput = document.getElementById("pdfFile");
const compressBtn = document.getElementById("compressBtn");
const levelSelect = document.getElementById("compressionLevel");

const fileName = document.getElementById("fileName");
const originalSize = document.getElementById("originalSize");
const compressedSize = document.getElementById("compressedSize");
const savedPercent = document.getElementById("savedPercent");

const downloadBtn = document.getElementById("downloadBtn");

const compressMethodRadios = document.getElementsByName("compressMethod");
const levelControlGroup = document.getElementById("levelControlGroup");
const sizeControlGroup = document.getElementById("sizeControlGroup");
const targetSizeInput = document.getElementById("targetSizeInput");

let selectedFile = null;
let compressedBlob = null;

// Toggle options visibility
compressMethodRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
        if (e.target.value === "level") {
            levelControlGroup.style.display = "flex";
            sizeControlGroup.style.display = "none";
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

});

// ==========================================
// PDF COMPRESS
// ==========================================

compressBtn.addEventListener("click", async () => {

    if (!selectedFile) {

        alert("Please select a PDF file.");

        return;

    }

    compressBtn.disabled = true;
    compressBtn.textContent = "Compressing...";

    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");

    if (progressContainer) {
        progressContainer.style.display = "block";
    }
    if (progressBar) {
        progressBar.style.width = "0%";
    }

    try {

        const arrayBuffer = await selectedFile.arrayBuffer();

        // Initialize PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        // Initialize pdf-lib for output
        const newPdfDoc = await PDFLib.PDFDocument.create();

        const method = Array.from(compressMethodRadios).find(r => r.checked).value;
        let scale = 1.0;
        let quality = 0.6;

        if (method === "level") {
            const level = levelSelect.value; // "low", "medium", "high"
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
        } else {
            const targetSizeKB = Number(targetSizeInput.value) || 150;
            const originalKB = selectedFile.size / 1024;
            const ratio = targetSizeKB / originalKB;

            if (ratio >= 0.8) {
                scale = 1.3;
                quality = 0.80;
            } else if (ratio >= 0.5) {
                scale = 1.0;
                quality = 0.60;
            } else if (ratio >= 0.3) {
                scale = 0.8;
                quality = 0.45;
            } else {
                scale = 0.6;
                quality = 0.30;
            }
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

            // Compress page canvas to JPEG Data URL
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

        const newSize = compressedBlob.size;

        compressedSize.textContent = formatFileSize(newSize);

        const saved = calculateSavedPercentage(selectedFile.size, newSize);
        savedPercent.textContent = saved + "%";

        // Enable Download Button
        downloadBtn.style.display = "inline-block";

        // Show Result Card
        const resultCard = document.getElementById("resultCard");
        if (resultCard) {
            resultCard.style.display = "block";
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

        console.error(error);

        alert("Failed to compress PDF.");

    } finally {

        compressBtn.disabled = false;
        compressBtn.textContent = "Compress PDF";
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

    a.download = selectedFile.name.replace(
        ".pdf",
        "-compressed.pdf"
    );

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

// ==========================================
// END OF FILE
// ==========================================