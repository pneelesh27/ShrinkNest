// ==========================================
// SHRINKNEST VIDEO COMPRESSOR
// File: js/video-compress.js
// ==========================================

import { auth, db } from "./firebase-config.js";
import { calculateSavedPercentage } from "./utils.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const uploadInput = document.getElementById("videoFile");
const compressBtn = document.getElementById("compressBtn");
const qualitySelect = document.getElementById("qualitySelect");
const progressBar = document.getElementById("progressBar");
const progressContainer = document.getElementById("progressContainer");
const downloadBtn = document.getElementById("downloadBtn");

const fileName = document.getElementById("fileName");
const originalSize = document.getElementById("originalSize");
const durationText = document.getElementById("duration");
const compressedSize = document.getElementById("compressedSize");
const savedPercent = document.getElementById("savedPercent");

const compressMethodRadios = document.getElementsByName("compressMethod");
const qualityControlGroup = document.getElementById("qualityControlGroup");
const sizeControlGroup = document.getElementById("sizeControlGroup");
const targetSizeInput = document.getElementById("targetSizeInput");

let selectedFile = null;
let compressedBlob = null;
let ffmpeg = null;

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

// Helper to load external scripts/wasm as local Blob URLs to bypass CORS on file:// protocol
async function toBlobURL(url, mimeType) {
    const response = await fetch(url);
    const blob = await response.blob();
    return URL.createObjectURL(new Blob([blob], { type: mimeType }));
}

// ==========================================
// LOAD FFMPEG (0.12.x Single-Threaded)
// ==========================================

async function loadFFmpeg() {

    if (ffmpeg) return ffmpeg;

    const { FFmpeg } = FFmpegWASM;
    ffmpeg = new FFmpeg();

    ffmpeg.on("log", ({ message }) => {
        console.log(message);
    });

    const coreURL = await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js', 'text/javascript');
    const wasmURL = await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm', 'application/wasm');

    await ffmpeg.load({
        coreURL,
        wasmURL
    });

    return ffmpeg;

}

// ==========================================
// FILE SELECT
// ==========================================

uploadInput.addEventListener("change", (e) => {

    selectedFile = e.target.files[0];

    if (!selectedFile) return;

    fileName.textContent = selectedFile.name;

    originalSize.textContent =
        (selectedFile.size / (1024 * 1024)).toFixed(2) + " MB";

    const video = document.createElement("video");

    video.preload = "metadata";

    video.onloadedmetadata = () => {

        durationText.textContent =
            video.duration.toFixed(2) + " sec";

        URL.revokeObjectURL(video.src);

    };

    video.src = URL.createObjectURL(selectedFile);

});

// ==========================================
// COMPRESS VIDEO
// ==========================================

compressBtn.addEventListener("click", async () => {

    if (!selectedFile) {

        alert("Please select a video.");

        return;

    }

    compressBtn.disabled = true;
    compressBtn.textContent = "Compressing...";

    progressContainer.style.display = "block";
    progressBar.style.width = "0%";

    try {

        const ff = await loadFFmpeg();

        ff.on("progress", ({ progress }) => {
            progressBar.style.width = `${Math.round(progress * 100)}%`;
        });

        // Convert file to Uint8Array for writeFile in 0.12.x
        const fileData = new Uint8Array(await selectedFile.arrayBuffer());
        await ff.writeFile(selectedFile.name, fileData);

        const method = Array.from(compressMethodRadios).find(r => r.checked).value;
        const outputFile = "compressed.mp4";
        let ffmpegArgs = ["-i", selectedFile.name, "-vcodec", "libx264"];

        if (method === "quality") {
            let crf = 28;
            switch (qualitySelect.value) {
                case "low":
                    crf = 34;
                    break;
                case "medium":
                    crf = 28;
                    break;
                case "high":
                    crf = 22;
                    break;
            }
            ffmpegArgs.push("-crf", String(crf), outputFile);
        } else {
            const targetSizeKB = Number(targetSizeInput.value) || 2000;
            // Parse duration
            const durationMatch = durationText.textContent.match(/([0-9.]+)/);
            const duration = durationMatch ? parseFloat(durationMatch[1]) : 10;
            
            // Map target size to video bitrate (accounting for audio/container overhead)
            const targetBitrateKbps = Math.max(100, Math.round((targetSizeKB * 8 * 0.85) / duration));
            ffmpegArgs.push(
                "-b:v", `${targetBitrateKbps}k`,
                "-maxrate", `${targetBitrateKbps * 1.2}k`,
                "-bufsize", `${targetBitrateKbps * 2}k`,
                outputFile
            );
        }

        // Run compression command
        await ff.exec(ffmpegArgs);

        // Read result in 0.12.x
        const data = await ff.readFile(outputFile);
        compressedBlob = new Blob(
            [data.buffer],
            {
                type: "video/mp4"
            }
        );

        if (compressedBlob.size >= selectedFile.size) {
            compressedBlob = selectedFile;
        }

        const finalSize = compressedBlob.size;

        compressedSize.textContent =
            (finalSize / (1024 * 1024)).toFixed(2) + " MB";

        const saved = calculateSavedPercentage(selectedFile.size, finalSize);

        savedPercent.textContent = saved + "%";

        // Enable download
        downloadBtn.style.display = "inline-block";

        // Show result card
        const resultCard = document.getElementById("resultCard");
        if (resultCard) {
            resultCard.style.display = "block";
        }

        // Save history to Firestore
        if (auth.currentUser) {

            await addDoc(collection(db, "history"), {

                uid: auth.currentUser.uid,
                filename: selectedFile.name,
                originalSize: (selectedFile.size / (1024 * 1024)).toFixed(2) + " MB",
                compressedSize: (finalSize / (1024 * 1024)).toFixed(2) + " MB",
                saved: saved,
                type: "video",
                date: new Date().toLocaleDateString(),
                timestamp: serverTimestamp()

            });

        }

        // Clean FFmpeg virtual filesystem
        try {
            await ff.deleteFile(selectedFile.name);
            await ff.deleteFile(outputFile);
        } catch (e) {
            console.log("Cleanup skipped:", e);
        }

    } catch (error) {

        console.error(error);
        alert("Video compression failed.");

    } finally {

        compressBtn.disabled = false;
        compressBtn.textContent = "Compress Video";
        progressBar.style.width = "100%";

    }

});

// ==========================================
// DOWNLOAD
// ==========================================

downloadBtn.addEventListener("click", () => {

    if (!compressedBlob) {

        alert("Please compress a video first.");
        return;

    }

    const url = URL.createObjectURL(compressedBlob);

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