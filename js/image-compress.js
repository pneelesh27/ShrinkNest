// ==========================================
// SHRINKNEST IMAGE COMPRESSOR
// File: js/image-compress.js
// ==========================================

import { auth, db } from "./firebase-config.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const uploadInput = document.getElementById("imageFile");
const qualitySlider = document.getElementById("qualitySlider");
const compressBtn = document.getElementById("compressBtn");
const downloadBtn = document.getElementById("downloadBtn");

const beforePreview = document.getElementById("beforePreview");
const afterPreview = document.getElementById("afterPreview");

const originalSize = document.getElementById("originalSize");
const compressedSize = document.getElementById("compressedSize");
const savedPercent = document.getElementById("savedPercent");

let selectedFile = null;
let compressedFile = null;

// ==========================================
// IMAGE SELECT
// ==========================================

uploadInput.addEventListener("change", (e) => {

    selectedFile = e.target.files[0];

    if (!selectedFile) return;

    beforePreview.src = URL.createObjectURL(selectedFile);

    originalSize.textContent =
        (selectedFile.size / 1024).toFixed(2) + " KB";

});

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

        const quality =
            Number(qualitySlider.value) / 100;

        const options = {

            maxSizeMB: 5,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            initialQuality: quality

        };

        compressedFile =
            await imageCompression(
                selectedFile,
                options
            );

        afterPreview.src =
            URL.createObjectURL(compressedFile);

        compressedSize.textContent =
            (compressedFile.size / 1024).toFixed(2) + " KB";

        const saved = (
            (
                (selectedFile.size - compressedFile.size) /
                selectedFile.size
            ) * 100
        ).toFixed(1);

        savedPercent.textContent = saved + "%";
                // Enable Download Button
        downloadBtn.style.display = "inline-block";

        // Save History (if user is logged in)
        if (auth.currentUser) {

            await addDoc(collection(db, "history"), {

                uid: auth.currentUser.uid,
                filename: selectedFile.name,
                originalSize: (selectedFile.size / 1024).toFixed(2) + " KB",
                compressedSize: (compressedFile.size / 1024).toFixed(2) + " KB",
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