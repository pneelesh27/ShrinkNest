// ==========================================
// SHRINKNEST IMAGE COMPRESSOR
// File: js/image-compress.js
// ==========================================

import { auth, db } from "./firebase-config.js";
import { calculateSavedPercentage, formatFileSize } from "./utils.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const uploadInput = document.getElementById("imageFile");
const qualitySlider = document.getElementById("qualitySlider");
const compressBtn = document.getElementById("compressBtn");
const downloadBtn = document.getElementById("downloadBtn");

const beforePreview = document.getElementById("beforePreview");
const afterPreview = document.getElementById("afterPreview");

const originalSize = document.getElementById("originalSize");
const compressedSize = document.getElementById("compressedSize");
const savedPercent = document.getElementById("savedPercent");

const compressMethodRadios = document.getElementsByName("compressMethod");
const qualityControlGroup = document.getElementById("qualityControlGroup");
const sizeControlGroup = document.getElementById("sizeControlGroup");
const targetSizeInput = document.getElementById("targetSizeInput");

let selectedFile = null;
let compressedFile = null;

// Toggle options visibility
compressMethodRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
        if (e.target.value === "quality") {
            qualityControlGroup.style.display = "flex";
            sizeControlGroup.style.display = "none";
        } else {
            qualityControlGroup.style.display = "none";
            sizeControlGroup.style.display = "flex";
        }
    });
});

// ==========================================
// IMAGE SELECT
// ==========================================

uploadInput.addEventListener("change", (e) => {

    selectedFile = e.target.files[0];

    if (!selectedFile) return;

    beforePreview.src = URL.createObjectURL(selectedFile);

    originalSize.textContent = formatFileSize(selectedFile.size);

});

// ==========================================
// NATIVE COMPRESSION HELPER
// ==========================================

async function compressImageNative(file, quality, targetSizeKB = null) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            
            // Scale resolution if we want to hit a target size
            let scale = 1.0;
            if (targetSizeKB) {
                const estSizeKB = (file.size / 1024) * quality;
                if (estSizeKB > targetSizeKB) {
                    scale = Math.max(0.2, Math.sqrt(targetSizeKB / estSizeKB));
                }
            }
            
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const outputType = "image/jpeg";
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                        type: outputType,
                        lastModified: Date.now()
                    }));
                } else {
                    reject(new Error("toBlob failed"));
                }
            }, outputType, quality);
        };
        img.onerror = () => reject(new Error("Load image failed"));
        img.src = URL.createObjectURL(file);
    });
}

// ==========================================
// COMPRESS IMAGE
// ==========================================

compressBtn.addEventListener("click", async () => {

    if (!selectedFile) {

        alert("Please select an image first.");

        return;

    }

    compressBtn.disabled = true;
    compressBtn.textContent = "Compressing...";

    try {

        const method = Array.from(compressMethodRadios).find(r => r.checked).value;

        if (method === "quality") {
            const quality = Number(qualitySlider.value) / 100;
            if (quality === 1.0) {
                compressedFile = selectedFile;
            } else {
                compressedFile = await compressImageNative(selectedFile, quality);
            }
        } else {
            const targetSizeKB = Number(targetSizeInput.value) || 200;
            
            // Perform a bisection search on quality to find the best quality that fits target size
            let minQ = 0.05;
            let maxQ = 0.95;
            let bestFile = null;
            
            for (let i = 0; i < 5; i++) {
                const midQ = (minQ + maxQ) / 2;
                const tempFile = await compressImageNative(selectedFile, midQ, targetSizeKB);
                const tempSizeKB = tempFile.size / 1024;
                
                if (tempSizeKB <= targetSizeKB) {
                    bestFile = tempFile;
                    minQ = midQ;
                } else {
                    maxQ = midQ;
                }
            }
            
            compressedFile = bestFile || await compressImageNative(selectedFile, 0.05, targetSizeKB);
        }

        // Fallback to original if compressed version is somehow larger
        if (compressedFile && compressedFile.size >= selectedFile.size) {
            compressedFile = selectedFile;
        }

        afterPreview.src = URL.createObjectURL(compressedFile);
        compressedSize.textContent = formatFileSize(compressedFile.size);

        const saved = calculateSavedPercentage(selectedFile.size, compressedFile.size);
        savedPercent.textContent = saved + "%";

        // Enable Download Button
        downloadBtn.style.display = "inline-block";

        // Show Result Card
        const resultCard = document.getElementById("resultCard");
        if (resultCard) {
            resultCard.style.display = "block";
        }

        // Save History (if user is logged in)
        if (auth.currentUser) {

            await addDoc(collection(db, "history"), {

                uid: auth.currentUser.uid,
                filename: selectedFile.name,
                originalSize: formatFileSize(selectedFile.size),
                compressedSize: formatFileSize(compressedFile.size),
                saved: saved,
                type: "image",
                date: new Date().toLocaleDateString(),
                timestamp: serverTimestamp()

            });

        }

    } catch (error) {

        console.error(error);

        alert("Failed to compress image.");

    } finally {

        compressBtn.disabled = false;
        compressBtn.textContent = "Compress Image";

    }

});

// ==========================================
// DOWNLOAD COMPRESSED IMAGE
// ==========================================

downloadBtn.addEventListener("click", () => {

    if (!compressedFile) {

        alert("Please compress an image first.");

        return;

    }

    const url = URL.createObjectURL(compressedFile);

    const a = document.createElement("a");

    a.href = url;

    a.download = "compressed-" + selectedFile.name;

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