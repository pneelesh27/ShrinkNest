// ==========================================
// SHRINKNEST VIDEO COMPRESSOR
// File: js/video-compress.js
// ==========================================

import { auth, db } from "./firebase-config.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

let selectedFile = null;
let compressedBlob = null;
let ffmpeg = null;

// ==========================================
// LOAD FFMPEG
// ==========================================

async function loadFFmpeg() {

    if (ffmpeg) return ffmpeg;

    ffmpeg = FFmpeg.createFFmpeg({
        log: true
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

        ff.setProgress(({ ratio }) => {

            progressBar.style.width =
                `${Math.round(ratio * 100)}%`;

        });

        ff.FS(
            "writeFile",
            selectedFile.name,
            await FFmpeg.fetchFile(selectedFile)
        );

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

        const outputFile = "compressed.mp4";

        await ff.run(
            "-i",
            selectedFile.name,
            "-vcodec",
            "libx264",
            "-crf",
            String(crf),
            outputFile
        );

        const data =
            ff.FS("readFile", outputFile);

        compressedBlob = new Blob(
            [data.buffer],
            {
                type: "video/mp4"
            }
        );

        const newSize = compressedBlob.size;

        compressedSize.textContent =
            (newSize / (1024 * 1024)).toFixed(2) + " MB";

        const saved = (
            (
                (selectedFile.size - newSize) /
                selectedFile.size
            ) * 100
        ).toFixed(1);

        savedPercent.textContent = saved + "%";

                // Enable download
        downloadBtn.style.display = "inline-block";

        // Save history to Firestore
        if (auth.currentUser) {

            await addDoc(collection(db, "history"), {

                uid: auth.currentUser.uid,
                filename: selectedFile.name,
                originalSize: (selectedFile.size / (1024 * 1024)).toFixed(2) + " MB",
                compressedSize: (newSize / (1024 * 1024)).toFixed(2) + " MB",
                saved: saved,
                type: "video",
                date: new Date().toLocaleDateString(),
                timestamp: serverTimestamp()

            });

        }

        // Clean FFmpeg virtual filesystem
        try {

            ff.unlink(selectedFile.name);
            ff.unlink(outputFile);

        } catch (e) {

            console.log("Cleanup skipped.");

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