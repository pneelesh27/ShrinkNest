// ==========================================
// SHRINKNEST VIDEO COMPRESSOR
// File: js/video-compress.js
// ==========================================

import { auth } from "./firebase-config.js";
import { calculateSavedPercentage, formatFileSize } from "./utils.js";
import { saveCompressionHistory } from "./history.js";

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

const beforePreview = document.getElementById("beforePreview");
const afterPreview = document.getElementById("afterPreview");
const previewGrid = document.getElementById("previewGrid");
const statusMessage = document.getElementById("statusMessage");
const progressPercent = document.getElementById("progressPercent");

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

// Use FFmpeg v0.11.6 API
const { createFFmpeg, fetchFile } = window.FFmpeg;

// ==========================================
// LOAD FFMPEG (0.11.x Single-Threaded)
// ==========================================

async function loadFFmpeg() {
    if (ffmpeg && ffmpeg.isLoaded()) return ffmpeg;

    ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    });

    ffmpeg.setProgress(({ ratio }) => {
        const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
        if (progressBar && progressPercent) {
            progressBar.style.width = `${percent}%`;
            progressPercent.textContent = `${percent}%`;
        }
    });

    await ffmpeg.load();
    return ffmpeg;
}

// ==========================================
// FILE SELECT
// ==========================================

uploadInput.addEventListener("change", (e) => {
    selectedFile = e.target.files[0];

    if (!selectedFile) return;

    // Validate file type
    const allowedExtensions = ["mp4", "mov", "avi", "mkv", "webm", "mpeg"];
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
        alert("Unsupported video format. Please upload MP4, MOV, AVI, MKV, WEBM, or MPEG.");
        uploadInput.value = "";
        selectedFile = null;
        return;
    }

    // Reset UI State for a new session
    compressedBlob = null;
    downloadBtn.style.display = "none";
    resultCard.style.display = "none";
    progressContainer.style.display = "none";
    progressPercent.style.display = "none";
    statusMessage.style.display = "none";
    afterPreview.src = "";

    const fileInfo = document.getElementById("fileInfo");
    if (fileInfo) fileInfo.style.display = "block";

    fileName.textContent = selectedFile.name;
    originalSize.textContent = formatFileSize(selectedFile.size);

    const objectURL = URL.createObjectURL(selectedFile);
    beforePreview.src = objectURL;

    if (previewGrid) previewGrid.style.display = "grid";

    // Read metadata duration
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
        durationText.textContent = video.duration.toFixed(2) + " sec";
        URL.revokeObjectURL(video.src);
    };
    video.src = objectURL;
});

// ==========================================
// COMPRESS VIDEO
// ==========================================

compressBtn.addEventListener("click", async () => {
    if (!selectedFile) {
        alert("Please select a video first.");
        return;
    }

    compressBtn.disabled = true;
    compressBtn.textContent = "Processing...";

    progressContainer.style.display = "block";
    progressBar.style.width = "0%";
    progressPercent.style.display = "block";
    progressPercent.textContent = "0%";

    statusMessage.style.display = "block";
    statusMessage.style.color = "var(--primary)";
    statusMessage.textContent = "Loading FFmpeg...";

    try {
        const ff = await loadFFmpeg();

        statusMessage.textContent = "Uploading...";
        
        const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.'));
        const inputName = "input_video" + ext;
        const outputName = "output_video.mp4";
        
        ff.FS('writeFile', inputName, await fetchFile(selectedFile));

        statusMessage.textContent = "Compressing...";

        const method = Array.from(compressMethodRadios).find(r => r.checked).value;
        
        // Setup base options (use libx264, preset superfast, aac audio)
        let ffmpegArgs = ["-i", inputName, "-c:v", "libx264"];

        if (method === "quality") {
            let crf = 28;
            switch (qualitySelect.value) {
                case "low":
                    crf = 32;
                    break;
                case "medium":
                    crf = 28;
                    break;
                case "high":
                    crf = 24;
                    break;
            }
            ffmpegArgs.push(
                "-crf", String(crf),
                "-preset", "superfast",
                "-c:a", "aac",
                "-b:a", "128k",
                "-pix_fmt", "yuv420p",
                "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", // Fix odd dimensions error
                "-movflags", "+faststart",
                outputName
            );
        } else {
            const targetSizeKB = Number(targetSizeInput.value) || 2000;
            // Parse duration safely
            const durationMatch = durationText.textContent.match(/([0-9.]+)/);
            let duration = durationMatch ? parseFloat(durationMatch[1]) : 10;
            if (isNaN(duration) || duration <= 0) duration = 10;
            
            // Map target size to video bitrate (accounting for audio/container overhead)
            const targetBitrateKbps = Math.max(100, Math.round((targetSizeKB * 8 * 0.85) / duration));
            ffmpegArgs.push(
                "-b:v", `${targetBitrateKbps}k`,
                "-maxrate", `${targetBitrateKbps * 1.2}k`,
                "-bufsize", `${targetBitrateKbps * 2}k`,
                "-preset", "superfast",
                "-c:a", "aac",
                "-b:a", "128k",
                "-pix_fmt", "yuv420p",
                "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", // Fix odd dimensions error
                "-movflags", "+faststart",
                outputName
            );
        }

        // Run compression command
        await ff.run(...ffmpegArgs);

        statusMessage.textContent = "Finalizing...";
        progressBar.style.width = "95%";
        progressPercent.textContent = "95%";

        // Read result in 0.11.x
        const data = ff.FS('readFile', outputName);
        compressedBlob = new Blob([data.buffer], { type: "video/mp4" });

        let finalSize = compressedBlob.size;
        let isOriginalUsed = false;

        // Fallback to original if output is somehow larger
        if (compressedBlob.size >= selectedFile.size) {
            compressedBlob = selectedFile;
            finalSize = selectedFile.size;
            isOriginalUsed = true;
        }

        // Display results
        document.getElementById("resultOriginalSize").textContent = formatFileSize(selectedFile.size);
        compressedSize.textContent = formatFileSize(finalSize);

        const saved = calculateSavedPercentage(selectedFile.size, finalSize);
        savedPercent.textContent = saved + "%";

        const compressedObjectURL = URL.createObjectURL(compressedBlob);
        afterPreview.src = compressedObjectURL;

        // Enable download button and results card
        downloadBtn.style.display = "inline-block";
        resultCard.style.display = "block";

        statusMessage.textContent = isOriginalUsed ? "Compression Complete (Original Kept)" : "Compression Complete!";
        progressBar.style.width = "100%";
        progressPercent.textContent = "100%";

        // Save history to Firestore if logged in
        if (auth.currentUser) {
            saveCompressionHistory({
                filename: selectedFile.name,
                originalSize: formatFileSize(selectedFile.size),
                compressedSize: formatFileSize(finalSize),
                saved: saved,
                type: "video",
                compressedFile: compressedBlob
            });
        }

        // Clean FFmpeg virtual filesystem
        try {
            ff.FS('unlink', inputName);
            ff.FS('unlink', outputName);
        } catch (e) {
            console.log("Cleanup skipped:", e);
        }

    } catch (error) {
        console.error(error);
        statusMessage.textContent = "Failed to compress video.";
        statusMessage.style.color = "#ef4444";
        alert("Video compression failed. Error: " + (error.message || error.toString()));
    } finally {
        compressBtn.disabled = false;
        compressBtn.textContent = "Compress Video";
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

    const outputFileName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) + "_compressed.mp4";
    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement("a");

    a.href = url;
    a.download = outputFileName;

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