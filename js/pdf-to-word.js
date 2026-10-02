// ==========================================
// ShrinkNest — PDF to Word Converter
// File: js/pdf-to-word.js
// Client-side high fidelity PDF to .docx converter
// ==========================================

import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    ImageRun,
    BorderStyle
} from "https://cdn.jsdelivr.net/npm/docx@8.5.0/+esm";

import { saveCompressionHistory } from "./history.js";

// Initialize PDF.js worker
if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
}

// ── DOM Elements ──
const dropZone          = document.getElementById("dropZone");
const uploadWrapper     = document.getElementById("uploadWrapper");
const fileInput         = document.getElementById("pdfFileInput");
const previewPanel      = document.getElementById("previewPanel");
const previewFileName   = document.getElementById("previewFileName");
const previewFileSize   = document.getElementById("previewFileSize");
const previewPageCount  = document.getElementById("previewPageCount");
const previewCanvas     = document.getElementById("previewCanvas");
const removeFileBtn     = document.getElementById("removeFileBtn");

const optionsCard       = document.getElementById("optionsCard");
const pagesAllRadio     = document.getElementById("pagesAllRadio");
const pagesCustomRadio  = document.getElementById("pagesCustomRadio");
const customRangeWrap   = document.getElementById("customRangeWrap");
const customRangeInput  = document.getElementById("customRangeInput");
const pagesCountLabel   = document.getElementById("pagesCountLabel");

const optPreserveLayout = document.getElementById("optPreserveLayout");
const optKeepImages     = document.getElementById("optKeepImages");
const optPreserveTables = document.getElementById("optPreserveTables");
const convertBtn        = document.getElementById("convertBtn");

const progressCard      = document.getElementById("progressCard");
const progressFill      = document.getElementById("progressFill");
const progressPctText   = document.getElementById("progressPctText");
const progressStageTitle= document.getElementById("progressStageTitle");
const stage1            = document.getElementById("stage1");
const stage2            = document.getElementById("stage2");
const stage3            = document.getElementById("stage3");
const stage4            = document.getElementById("stage4");
const stage1Sub         = document.getElementById("stage1Sub");
const stage2Sub         = document.getElementById("stage2Sub");
const stage3Sub         = document.getElementById("stage3Sub");
const stage4Sub         = document.getElementById("stage4Sub");

const successPanel      = document.getElementById("successPanel");
const successOriginalName = document.getElementById("successOriginalName");
const successPagesCount = document.getElementById("successPagesCount");
const successDocxSize   = document.getElementById("successDocxSize");
const downloadDocxBtn   = document.getElementById("downloadDocxBtn");
const convertAnotherBtn = document.getElementById("convertAnotherBtn");

const errorAlert        = document.getElementById("errorAlert");
const errorAlertTitle   = document.getElementById("errorAlertTitle");
const errorAlertMsg     = document.getElementById("errorAlertMsg");
const ocrWarningAlert   = document.getElementById("ocrWarningAlert");

// ── State ──
let currentFile         = null;
let currentPdfDoc       = null;
let currentPdfData      = null;
let currentObjectUrl    = null;
let totalPages          = 0;
let isConverting        = false;

// ── Helpers ──
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function showError(title, msg) {
    if (errorAlert) {
        errorAlertTitle.textContent = title || "Error";
        errorAlertMsg.textContent = msg || "An unexpected error occurred.";
        errorAlert.style.display = "flex";
        errorAlert.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

function hideError() {
    if (errorAlert) errorAlert.style.display = "none";
}

function showOcrWarning(msg) {
    if (ocrWarningAlert) {
        if (msg) document.getElementById("ocrWarningMsg").textContent = msg;
        ocrWarningAlert.style.display = "flex";
    }
}

function hideOcrWarning() {
    if (ocrWarningAlert) ocrWarningAlert.style.display = "none";
}

function resetUI() {
    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
    }
    currentFile = null;
    currentPdfDoc = null;
    currentPdfData = null;
    totalPages = 0;
    isConverting = false;

    if (fileInput) fileInput.value = "";
    if (customRangeInput) customRangeInput.value = "";
    if (pagesAllRadio) pagesAllRadio.checked = true;
    if (customRangeWrap) customRangeWrap.style.display = "none";

    hideError();
    hideOcrWarning();

    if (previewPanel) previewPanel.style.display = "none";
    if (optionsCard) optionsCard.style.display = "none";
    if (progressCard) progressCard.style.display = "none";
    if (successPanel) successPanel.style.display = "none";
    if (uploadWrapper) uploadWrapper.style.display = "block";

    // Clear preview canvas
    if (previewCanvas) {
        const ctx = previewCanvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
}

// ── Drag & Drop Listeners ──
if (dropZone) {
    ["dragenter", "dragover"].forEach(evt => {
        dropZone.addEventListener(evt, e => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach(evt => {
        dropZone.addEventListener(evt, e => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove("dragover");
        });
    });

    dropZone.addEventListener("drop", e => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleSelectedFile(files[0]);
        }
    });
}

if (fileInput) {
    fileInput.addEventListener("change", e => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleSelectedFile(files[0]);
        }
    });
}

if (removeFileBtn) {
    removeFileBtn.addEventListener("click", () => {
        resetUI();
    });
}

if (convertAnotherBtn) {
    convertAnotherBtn.addEventListener("click", () => {
        resetUI();
    });
}

// ── Page Selection Toggle ──
if (pagesAllRadio && pagesCustomRadio) {
    pagesAllRadio.addEventListener("change", () => {
        if (customRangeWrap) customRangeWrap.style.display = "none";
    });
    pagesCustomRadio.addEventListener("change", () => {
        if (customRangeWrap) customRangeWrap.style.display = "block";
        if (customRangeInput) customRangeInput.focus();
    });
}

// ── Process Uploaded File ──
async function handleSelectedFile(file) {
    hideError();
    hideOcrWarning();

    if (!file) return;

    // Validate type
    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    if (!isPdf) {
        showError("Invalid File Type", "Please select a valid PDF document (.pdf).");
        return;
    }

    // Check size (> 60 MB warning/limit)
    if (file.size > 60 * 1024 * 1024) {
        showError("File Too Large", "The selected file exceeds the 60 MB browser limit. Please compress or split the PDF first.");
        return;
    }

    currentFile = file;

    // Update initial UI
    if (previewFileName) previewFileName.textContent = file.name;
    if (previewFileSize) previewFileSize.textContent = formatBytes(file.size);
    if (previewPageCount) previewPageCount.textContent = "Loading...";

    try {
        const arrayBuffer = await file.arrayBuffer();
        currentPdfData = arrayBuffer;

        // Load with PDF.js
        const loadingTask = window.pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer)
        });

        currentPdfDoc = await loadingTask.promise;
        totalPages = currentPdfDoc.numPages;

        if (totalPages === 0) {
            throw new Error("This PDF document does not contain any pages.");
        }

        if (previewPageCount) {
            previewPageCount.textContent = `${totalPages} page${totalPages > 1 ? "s" : ""}`;
        }
        if (pagesCountLabel) {
            pagesCountLabel.textContent = `(1 - ${totalPages})`;
        }

        // Render first page preview
        await renderPagePreview(currentPdfDoc, 1);

        // Show preview and options
        if (uploadWrapper) uploadWrapper.style.display = "none";
        if (previewPanel) previewPanel.style.display = "block";
        if (optionsCard) optionsCard.style.display = "block";

    } catch (err) {
        console.error("PDF load error:", err);
        resetUI();

        if (err.name === "PasswordException") {
            showError("Password Protected PDF", "This PDF is encrypted or password-protected. Please remove the password and try again.");
        } else if (err.message && err.message.toLowerCase().includes("invalid or corrupted")) {
            showError("Corrupted PDF", "The selected file appears to be corrupted or is not a valid PDF document.");
        } else {
            showError("Unable to Open PDF", err.message || "Failed to read the PDF file. Please ensure it is a valid document.");
        }
    }
}

// ── Render First Page Preview onto Canvas ──
async function renderPagePreview(pdfDoc, pageNum) {
    try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });

        // Calculate responsive scale for thumbnail
        const maxDisplayWidth = 420;
        const scale = Math.min(1.5, maxDisplayWidth / viewport.width);
        const scaledViewport = page.getViewport({ scale });

        previewCanvas.width = scaledViewport.width;
        previewCanvas.height = scaledViewport.height;

        const ctx = previewCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

        await page.render({
            canvasContext: ctx,
            viewport: scaledViewport
        }).promise;

    } catch (err) {
        console.warn("Failed to render page preview:", err);
    }
}

// ── Parse Custom Page Range ──
function parsePageRange(rangeStr, maxPages) {
    if (!rangeStr || !rangeStr.trim()) {
        throw new Error("Please enter a page range (e.g. 1-3, 5).");
    }

    const pages = new Set();
    const parts = rangeStr.split(",");

    for (let part of parts) {
        part = part.trim();
        if (!part) continue;

        if (part.includes("-")) {
            const [startStr, endStr] = part.split("-");
            const start = parseInt(startStr, 10);
            const end   = parseInt(endStr, 10);

            if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
                throw new Error(`Invalid page range segment: "${part}". Format: e.g. 1-3, 5`);
            }
            for (let i = start; i <= end; i++) {
                if (i <= maxPages) pages.add(i);
            }
        } else {
            const pageNum = parseInt(part, 10);
            if (isNaN(pageNum) || pageNum < 1) {
                throw new Error(`Invalid page number: "${part}". Must be between 1 and ${maxPages}.`);
            }
            if (pageNum <= maxPages) {
                pages.add(pageNum);
            }
        }
    }

    const result = Array.from(pages).sort((a, b) => a - b);
    if (result.length === 0) {
        throw new Error(`No valid pages selected. Document has ${maxPages} pages.`);
    }
    return result;
}

// ── Progress UI Controllers ──
function updateProgress(pct, stageNum, stageTitle, subText) {
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressPctText) progressPctText.textContent = `${pct}%`;
    if (progressStageTitle && stageTitle) progressStageTitle.textContent = stageTitle;

    const stages = [stage1, stage2, stage3, stage4];
    stages.forEach((st, idx) => {
        if (!st) return;
        const num = idx + 1;
        if (num < stageNum) {
            st.className = "stage-item completed";
        } else if (num === stageNum) {
            st.className = "stage-item active";
        } else {
            st.className = "stage-item";
        }
    });

    if (stageNum === 1 && stage1Sub && subText) stage1Sub.textContent = subText;
    if (stageNum === 2 && stage2Sub && subText) stage2Sub.textContent = subText;
    if (stageNum === 3 && stage3Sub && subText) stage3Sub.textContent = subText;
    if (stageNum === 4 && stage4Sub && subText) stage4Sub.textContent = subText;
}

// ── Helper: Convert Canvas to Uint8Array ──
function canvasToUint8Array(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) return reject(new Error("Canvas to blob conversion failed"));
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(new Uint8Array(reader.result));
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        }, "image/jpeg", 0.85);
    });
}

// ── Main Conversion Handler ──
if (convertBtn) {
    convertBtn.addEventListener("click", async () => {
        if (isConverting || !currentPdfDoc || !currentFile) return;

        hideError();
        hideOcrWarning();

        // 1. Determine pages to convert
        let targetPages = [];
        try {
            if (pagesCustomRadio && pagesCustomRadio.checked) {
                targetPages = parsePageRange(customRangeInput ? customRangeInput.value : "", totalPages);
            } else {
                for (let i = 1; i <= totalPages; i++) {
                    targetPages.push(i);
                }
            }
        } catch (err) {
            showError("Page Range Error", err.message);
            return;
        }

        isConverting = true;
        if (optionsCard) optionsCard.style.display = "none";
        if (progressCard) progressCard.style.display = "block";

        const preserveLayout = optPreserveLayout ? optPreserveLayout.checked : true;
        const keepImages     = optKeepImages ? optKeepImages.checked : true;
        const preserveTables = optPreserveTables ? optPreserveTables.checked : true;

        try {
            // Stage 1: Reading PDF
            updateProgress(10, 1, "Reading PDF Structure...", `Checking ${targetPages.length} pages`);
            await new Promise(r => setTimeout(r, 200));

            // Stage 2: Extracting Content
            updateProgress(20, 2, "Extracting PDF Content...", "Analyzing text & structure");

            const docChildren = [];
            let totalExtractedChars = 0;
            let totalImagesFound = 0;

            for (let idx = 0; idx < targetPages.length; idx++) {
                const pageNum = targetPages[idx];
                const pagePct = Math.round(20 + ((idx + 1) / targetPages.length) * 45);
                updateProgress(pagePct, 2, "Extracting PDF Content...", `Page ${pageNum} of ${totalPages} (${idx + 1}/${targetPages.length})`);

                const page = await currentPdfDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                const viewport = page.getViewport({ scale: 1.0 });

                let pageCharCount = 0;
                textContent.items.forEach(it => {
                    pageCharCount += (it.str || "").length;
                });
                totalExtractedChars += pageCharCount;

                // Add page break before subsequent pages
                if (idx > 0) {
                    docChildren.push(new Paragraph({
                        pageBreakBefore: true,
                        children: []
                    }));
                }

                // If page has virtually no text and keepImages is true -> Scanned page / Image PDF!
                if (pageCharCount < 15 && keepImages) {
                    // Render page to high-res canvas and insert as ImageRun
                    const scanScale = 1.6;
                    const scanViewport = page.getViewport({ scale: scanScale });
                    const offCanvas = document.createElement("canvas");
                    offCanvas.width = scanViewport.width;
                    offCanvas.height = scanViewport.height;
                    const offCtx = offCanvas.getContext("2d");
                    offCtx.fillStyle = "#ffffff";
                    offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

                    await page.render({
                        canvasContext: offCtx,
                        viewport: scanViewport
                    }).promise;

                    const imgBytes = await canvasToUint8Array(offCanvas);

                    // Word width: ~ 560 max width for 0.75" margins
                    const docImgWidth = Math.min(560, Math.round(scanViewport.width * 0.5));
                    const docImgHeight = Math.round((scanViewport.height / scanViewport.width) * docImgWidth);

                    docChildren.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 },
                        children: [
                            new ImageRun({
                                data: imgBytes,
                                transformation: {
                                    width: docImgWidth,
                                    height: docImgHeight
                                }
                            })
                        ]
                    }));

                    totalImagesFound++;
                    continue;
                }

                // Parse structured text on page
                const pageElements = parsePageContent(textContent.items, viewport, {
                    preserveLayout,
                    preserveTables
                });

                docChildren.push(...pageElements);

                // If keepImages is true and the page contains graphics/canvas elements, embed high-res page graphic if needed
                if (keepImages && pageCharCount < 100) {
                    try {
                        const offCanvas = document.createElement("canvas");
                        const scaleFactor = 1.4;
                        const v = page.getViewport({ scale: scaleFactor });
                        offCanvas.width = v.width;
                        offCanvas.height = v.height;
                        const ctx = offCanvas.getContext("2d");
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, v.width, v.height);
                        await page.render({ canvasContext: ctx, viewport: v }).promise;
                        const imgBytes = await canvasToUint8Array(offCanvas);

                        const docImgWidth = Math.min(540, Math.round(v.width * 0.5));
                        const docImgHeight = Math.round((v.height / v.width) * docImgWidth);

                        docChildren.push(new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 200, after: 200 },
                            children: [
                                new ImageRun({
                                    data: imgBytes,
                                    transformation: {
                                        width: docImgWidth,
                                        height: docImgHeight
                                    }
                                })
                            ]
                        }));
                    } catch (e) {
                        console.warn("Graphic extract note:", e);
                    }
                }
            }

            // Scanned PDF detection notice
            if (totalExtractedChars < 30 * targetPages.length) {
                showOcrWarning("Notice: This PDF contains predominantly scanned or raster image pages. Editable text extraction was limited. High-resolution page images were embedded into the Word document to preserve exact visual fidelity.");
            }

            // Stage 3: Creating DOCX
            updateProgress(75, 3, "Creating Word Document Structure...", "Formatting paragraphs & tables");
            await new Promise(r => setTimeout(r, 200));

            const doc = new Document({
                creator: "ShrinkNest PDF to Word Converter",
                title: currentFile.name.replace(/\.[^/.]+$/, ""),
                description: "Converted from PDF with ShrinkNest",
                sections: [{
                    properties: {
                        page: {
                            margin: {
                                top: 1000,
                                bottom: 1000,
                                left: 1000,
                                right: 1000
                            }
                        }
                    },
                    children: docChildren.length > 0 ? docChildren : [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "Converted document (no selectable text found on selected pages).",
                                    italics: true
                                })
                            ]
                        })
                    ]
                }]
            });

            // Stage 4: Finalizing
            updateProgress(90, 4, "Finalizing .docx File...", "Packing open XML format");
            await new Promise(r => setTimeout(r, 200));

            const docxBlob = await Packer.toBlob(doc);
            updateProgress(100, 4, "Conversion Complete!", "Ready to download");
            await new Promise(r => setTimeout(r, 200));

            // Setup Success Screen
            const docxFileName = currentFile.name.replace(/\.[^/.]+$/, "") + ".docx";
            if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = URL.createObjectURL(docxBlob);

            if (downloadDocxBtn) {
                downloadDocxBtn.href = currentObjectUrl;
                downloadDocxBtn.download = docxFileName;
            }

            if (successOriginalName) successOriginalName.textContent = currentFile.name;
            if (successPagesCount) successPagesCount.textContent = `${targetPages.length}`;
            if (successDocxSize) successDocxSize.textContent = formatBytes(docxBlob.size);

            if (progressCard) progressCard.style.display = "none";
            if (successPanel) successPanel.style.display = "block";
            successPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

            // Record in History if user is authenticated
            try {
                await saveCompressionHistory({
                    filename: docxFileName,
                    originalSize: formatBytes(currentFile.size),
                    compressedSize: formatBytes(docxBlob.size),
                    saved: 0,
                    type: "word",
                    compressedFile: docxBlob
                });
            } catch (histErr) {
                console.warn("History save ignored:", histErr);
            }

        } catch (convErr) {
            console.error("Conversion error:", convErr);
            if (progressCard) progressCard.style.display = "none";
            if (optionsCard) optionsCard.style.display = "block";
            showError("Conversion Failed", convErr.message || "An error occurred while building the Word document.");
        } finally {
            isConverting = false;
        }
    });
}

// ── Smart PDF Text & Table Parser ──
function parsePageContent(items, viewport, options) {
    const { preserveLayout, preserveTables } = options;
    const elements = [];

    if (!items || items.length === 0) return elements;

    // Filter valid items
    const validItems = items.filter(it => it.str && it.str.trim().length > 0);
    if (validItems.length === 0) return elements;

    // Normalize positions
    const cleanItems = validItems.map(it => {
        const x = it.transform[4];
        const y = it.transform[5];
        const height = Math.abs(it.transform[0] || it.height || 12);
        const fontName = (it.fontName || "").toLowerCase();
        const isBold = fontName.includes("bold") || fontName.includes("black") || fontName.includes("heavy") || fontName.includes("bld");
        const isItalic = fontName.includes("italic") || fontName.includes("oblique");

        return {
            str: it.str,
            x,
            y,
            height,
            isBold,
            isItalic,
            width: it.width || 0
        };
    });

    // Group items into lines by Y coordinate
    // PDF Y coordinates: origin is at bottom left, higher Y is higher up on page
    cleanItems.sort((a, b) => b.y - a.y);

    const lineTolerance = 3.5;
    const lines = [];
    let currentLine = [];
    let currentLineY = null;

    cleanItems.forEach(item => {
        if (currentLineY === null) {
            currentLine.push(item);
            currentLineY = item.y;
        } else if (Math.abs(item.y - currentLineY) <= lineTolerance) {
            currentLine.push(item);
        } else {
            // Sort items in line from left to right (increasing X)
            currentLine.sort((a, b) => a.x - b.x);
            lines.push(currentLine);
            currentLine = [item];
            currentLineY = item.y;
        }
    });

    if (currentLine.length > 0) {
        currentLine.sort((a, b) => a.x - b.x);
        lines.push(currentLine);
    }

    // Determine document median font size for heading classification
    const fontSizes = cleanItems.map(it => it.height).sort((a, b) => a - b);
    const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 12;

    // Analyze lines for Tables vs Regular Paragraphs
    let lineIdx = 0;
    while (lineIdx < lines.length) {
        const line = lines[lineIdx];

        // Check for Table detection if preserveTables is enabled
        // A line is candidate table row if it has 2+ columns separated by significant horizontal gaps
        const isTableRowCandidate = line.length >= 2 && hasColumnGaps(line);

        if (preserveTables && isTableRowCandidate) {
            // Look ahead to see if consecutive lines also form a table
            const tableRows = [];
            let rIdx = lineIdx;

            while (rIdx < lines.length && (lines[rIdx].length >= 2 && hasColumnGaps(lines[rIdx]))) {
                tableRows.push(lines[rIdx]);
                rIdx++;
                // Limit table size per scan
                if (rIdx - lineIdx > 50) break;
            }

            // If we found 2 or more consecutive rows with tabular columns -> build docx Table!
            if (tableRows.length >= 2) {
                const docxTable = buildDocxTable(tableRows);
                if (docxTable) {
                    elements.push(docxTable);
                    elements.push(new Paragraph({ spacing: { after: 140 } }));
                    lineIdx = rIdx;
                    continue;
                }
            }
        }

        // Render as standard Paragraph or Heading
        const fullLineText = line.map(it => it.str).join(" ").trim();
        const maxFontInLine = Math.max(...line.map(it => it.height));
        const isAnyBold = line.some(it => it.isBold);

        // Heading detection
        const isHeading1 = maxFontInLine >= medianFontSize * 1.5 && fullLineText.length < 90;
        const isHeading2 = maxFontInLine >= medianFontSize * 1.25 && fullLineText.length < 120;

        const textRuns = [];
        for (let i = 0; i < line.length; i++) {
            const item = line[i];
            const textToAdd = (i === 0 ? item.str : " " + item.str);

            textRuns.push(new TextRun({
                text: textToAdd,
                bold: isHeading1 || isHeading2 || item.isBold,
                italics: item.isItalic,
                size: Math.round(Math.min(36, Math.max(18, item.height * 2))) // docx sizes are in half-points
            }));
        }

        if (isHeading1) {
            elements.push(new Paragraph({
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 240, after: 120 },
                children: textRuns
            }));
        } else if (isHeading2) {
            elements.push(new Paragraph({
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 180, after: 100 },
                children: textRuns
            }));
        } else {
            elements.push(new Paragraph({
                spacing: { after: preserveLayout ? 120 : 80 },
                children: textRuns
            }));
        }

        lineIdx++;
    }

    return elements;
}

// Check if items in a line have significant horizontal spacing (column-like)
function hasColumnGaps(line) {
    if (line.length < 2) return false;
    for (let i = 0; i < line.length - 1; i++) {
        const gap = line[i + 1].x - (line[i].x + (line[i].width || 20));
        if (gap >= 25) return true;
    }
    return false;
}

// Build real docx Table from detected rows
function buildDocxTable(rowsData) {
    try {
        // Find max columns count
        let maxCols = 0;
        rowsData.forEach(r => {
            if (r.length > maxCols) maxCols = r.length;
        });

        if (maxCols < 2) return null;

        const tableRows = rowsData.map((rowItems, rowIndex) => {
            const cells = [];
            const isHeaderRow = rowIndex === 0;

            for (let c = 0; c < maxCols; c++) {
                const item = rowItems[c];
                const cellText = item ? item.str.trim() : "";

                cells.push(new TableCell({
                    width: {
                        size: Math.floor(9000 / maxCols),
                        type: WidthType.DXA
                    },
                    shading: isHeaderRow ? { fill: "F1F5F9" } : undefined,
                    margins: {
                        top: 100,
                        bottom: 100,
                        left: 120,
                        right: 120
                    },
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.LEFT,
                            children: [
                                new TextRun({
                                    text: cellText,
                                    bold: isHeaderRow || (item && item.isBold),
                                    size: isHeaderRow ? 22 : 20
                                })
                            ]
                        })
                    ]
                }));
            }

            return new TableRow({
                tableHeader: isHeaderRow,
                children: cells
            });
        });

        return new Table({
            width: {
                size: 9000,
                type: WidthType.DXA
            },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" }
            },
            rows: tableRows
        });
    } catch (e) {
        console.warn("Table build failed, falling back to text:", e);
        return null;
    }
}
