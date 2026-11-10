// ==========================================
// SHRINKNEST PDF COMPRESSOR - TARGET SIZE SEARCH
// File: js/targetSizeSearch.js
// ==========================================

/**
 * Standard DPI ladder for rasterization.
 * 72 points per inch is the PDF baseline (scale = DPI / 72).
 */
const DPI_LADDER = [200, 150, 130, 110, 96, 80, 72, 60, 50, 40];

/**
 * Render all pages of a PDF document to canvases for a given scale.
 * Canvases are cached so multiple quality iterations at the same scale
 * do not re-render the vector PDF content.
 */
async function renderPagesToCanvases(pdfDoc, scale, onPageRendered, shouldCancel) {
    const pages = [];
    const numPages = pdfDoc.numPages;

    for (let i = 1; i <= numPages; i++) {
        if (shouldCancel && shouldCancel()) {
            throw new Error("Compression cancelled by user.");
        }

        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));

        const ctx = canvas.getContext("2d", { alpha: false });
        // Fill pure white background to avoid black background on transparent PDF pages
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;

        pages.push({
            canvas,
            origWidth: viewport.width / scale,
            origHeight: viewport.height / scale,
            renderWidth: canvas.width,
            renderHeight: canvas.height
        });

        if (onPageRendered) {
            onPageRendered(i, numPages);
        }

        // Yield to allow UI updates
        await new Promise(r => setTimeout(r, 0));
    }

    return pages;
}

/**
 * Build a new PDFDocument from cached canvases at a specific JPEG quality
 * and return the serialized Uint8Array bytes.
 */
async function buildPdfFromCanvases(canvases, quality, PDFLib, shouldCancel) {
    if (shouldCancel && shouldCancel()) {
        throw new Error("Compression cancelled by user.");
    }

    const doc = await PDFLib.PDFDocument.create();

    for (const item of canvases) {
        if (shouldCancel && shouldCancel()) {
            throw new Error("Compression cancelled by user.");
        }

        const dataUrl = item.canvas.toDataURL("image/jpeg", quality);
        const img = await doc.embedJpg(dataUrl);

        const page = doc.addPage([item.origWidth, item.origHeight]);
        page.drawImage(img, {
            x: 0,
            y: 0,
            width: item.origWidth,
            height: item.origHeight
        });
    }

    // Save with object streams enabled for maximum byte efficiency
    const bytes = await doc.save({
        useObjectStreams: true,
        addDefaultPage: false
    });

    return bytes;
}

/**
 * Main search engine to compress a PDF to land as close as possible to targetSizeKB
 * (targetSizeKB * 1024 bytes) without exceeding it.
 */
export async function compressToTargetSize({
    arrayBuffer,
    targetSizeKB,
    pdfjsLib,
    PDFLib,
    onProgress,
    shouldCancel
}) {
    const startTime = performance.now();
    const originalBytes = arrayBuffer.byteLength;
    const targetBytes = Math.floor(targetSizeKB * 1024);

    // Rule 1 & 2: If original size <= target, do not recompress
    if (originalBytes <= targetBytes) {
        return {
            success: true,
            alreadySmaller: true,
            bytes: new Uint8Array(arrayBuffer),
            blob: new Blob([arrayBuffer], { type: "application/pdf" }),
            finalSize: originalBytes,
            targetSizeKB,
            iterations: 0,
            scaleDpi: null,
            quality: null,
            rasterized: false,
            message: `Your file is already smaller than the target (${(originalBytes / 1024).toFixed(1)} KB). No compression needed.`,
            note: "Original file preserved (no re-compression needed)."
        };
    }

    // Rule 4: Lossless pass first (stream optimization / metadata cleanup)
    if (onProgress) {
        onProgress({
            message: "Trying lossless optimization...",
            progress: 5,
            iteration: 0
        });
    }

    try {
        const losslessDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const losslessBytes = await losslessDoc.save({ useObjectStreams: true, addDefaultPage: false });

        if (losslessBytes.length <= targetBytes &&
            (losslessBytes.length >= targetBytes * 0.90 || originalBytes <= targetBytes * 1.05)) {
            return {
                success: true,
                alreadySmaller: false,
                bytes: losslessBytes,
                blob: new Blob([losslessBytes], { type: "application/pdf" }),
                finalSize: losslessBytes.length,
                targetSizeKB,
                iterations: 1,
                scaleDpi: null,
                quality: null,
                rasterized: false,
                message: null,
                note: "Original vector text and layouts preserved (lossless optimization)."
            };
        }
    } catch (e) {
        console.warn("[TargetSizeSearch] Lossless pass could not complete:", e);
    }

    // Load PDF with PDF.js for rendering
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    // Determine initial DPI index based on budget per page
    const budgetPerPage = targetBytes / totalPages;
    let dpiIndex = 0;
    if (budgetPerPage > 350 * 1024) {
        dpiIndex = 0; // 200 DPI
    } else if (budgetPerPage > 150 * 1024) {
        dpiIndex = 1; // 150 DPI
    } else if (budgetPerPage > 80 * 1024) {
        dpiIndex = 2; // 130 DPI
    } else if (budgetPerPage > 45 * 1024) {
        dpiIndex = 3; // 110 DPI
    } else if (budgetPerPage > 25 * 1024) {
        dpiIndex = 4; // 96 DPI
    } else if (budgetPerPage > 15 * 1024) {
        dpiIndex = 5; // 80 DPI
    } else {
        dpiIndex = 6; // 72 DPI
    }

    let bestValid = null; // { bytes, size, dpi, quality, iteration }
    let smallestCandidate = null; // In case target is impossible, track closest achievable
    let totalIterations = 0;
    const MAX_ITERATIONS = 40;
    const MAX_TIME_MS = 60000;

    let cachedCanvases = null;
    let cachedDpi = null;

    while (dpiIndex < DPI_LADDER.length) {
        const elapsed = performance.now() - startTime;
        if (totalIterations >= MAX_ITERATIONS || elapsed >= MAX_TIME_MS) {
            break;
        }
        if (shouldCancel && shouldCancel()) {
            throw new Error("Compression cancelled by user.");
        }

        const currentDpi = DPI_LADDER[dpiIndex];
        const scale = currentDpi / 72;

        // Render & cache canvases for this scale if not already cached
        if (cachedDpi !== currentDpi) {
            if (onProgress) {
                onProgress({
                    message: `Preparing pages at ${currentDpi} DPI...`,
                    progress: Math.min(85, 10 + Math.round((totalIterations / MAX_ITERATIONS) * 75)),
                    iteration: totalIterations
                });
            }

            cachedCanvases = await renderPagesToCanvases(
                pdfDoc,
                scale,
                (pageNum, total) => {
                    if (onProgress) {
                        onProgress({
                            message: `Rendering page ${pageNum}/${total} at ${currentDpi} DPI...`,
                            progress: Math.min(85, 10 + Math.round((pageNum / total) * 20)),
                            iteration: totalIterations
                        });
                    }
                },
                shouldCancel
            );
            cachedDpi = currentDpi;
        }

        // Test highest quality (0.95) at this DPI
        if (onProgress) {
            onProgress({
                message: `Trying quality 95% at ${currentDpi} DPI...`,
                progress: Math.min(92, 15 + Math.round((totalIterations / MAX_ITERATIONS) * 75)),
                iteration: totalIterations + 1,
                dpi: currentDpi,
                quality: 0.95
            });
        }

        await new Promise(r => setTimeout(r, 0));
        const bytesHigh = await buildPdfFromCanvases(cachedCanvases, 0.95, PDFLib, shouldCancel);
        const sizeHigh = bytesHigh.length;
        totalIterations++;

        // Track smallest overall candidate
        if (!smallestCandidate || sizeHigh < smallestCandidate.size) {
            smallestCandidate = { bytes: bytesHigh, size: sizeHigh, dpi: currentDpi, quality: 0.95 };
        }

        if (sizeHigh <= targetBytes) {
            // Quality 0.95 fits under the target!
            if (!bestValid || sizeHigh > bestValid.size) {
                bestValid = { bytes: bytesHigh, size: sizeHigh, dpi: currentDpi, quality: 0.95 };
            }

            // If already in 90%-100% bracket:
            if (sizeHigh >= targetBytes * 0.90) {
                // Perfect hit!
                break;
            }

            // If under 90% and higher DPI exists, attempt to step DPI up to consume available budget
            if (dpiIndex > 0) {
                dpiIndex--;
                continue;
            } else {
                // Already at max DPI (200 DPI) and max quality (0.95), can't make it larger
                break;
            }
        }

        // sizeHigh > targetBytes: test lowest floor quality (0.30)
        if (onProgress) {
            onProgress({
                message: `Trying quality 30% at ${currentDpi} DPI...`,
                progress: Math.min(92, 15 + Math.round((totalIterations / MAX_ITERATIONS) * 75)),
                iteration: totalIterations + 1,
                dpi: currentDpi,
                quality: 0.30
            });
        }

        await new Promise(r => setTimeout(r, 0));
        const bytesLow = await buildPdfFromCanvases(cachedCanvases, 0.30, PDFLib, shouldCancel);
        const sizeLow = bytesLow.length;
        totalIterations++;

        if (!smallestCandidate || sizeLow < smallestCandidate.size) {
            smallestCandidate = { bytes: bytesLow, size: sizeLow, dpi: currentDpi, quality: 0.30 };
        }

        if (sizeLow > targetBytes) {
            // Even floor quality is too large at this DPI! Must step scale down
            dpiIndex++;
            continue;
        }

        // sizeLow <= targetBytes: Target is achievable between [0.30, 0.95] at currentDpi!
        if (!bestValid || sizeLow > bestValid.size) {
            bestValid = { bytes: bytesLow, size: sizeLow, dpi: currentDpi, quality: 0.30 };
        }

        // Binary search quality in [minQ, maxQ]
        let minQ = 0.30;
        let maxQ = 0.95;

        for (let b = 0; b < 10; b++) {
            const timePassed = performance.now() - startTime;
            if (totalIterations >= MAX_ITERATIONS || timePassed >= MAX_TIME_MS) {
                break;
            }
            if (shouldCancel && shouldCancel()) {
                throw new Error("Compression cancelled by user.");
            }
            if (maxQ - minQ < 0.02) {
                break;
            }

            const midQ = Number(((minQ + maxQ) / 2).toFixed(3));

            if (onProgress) {
                onProgress({
                    message: `Trying quality ${Math.round(midQ * 100)}% at ${currentDpi} DPI...`,
                    progress: Math.min(94, 20 + Math.round((totalIterations / MAX_ITERATIONS) * 75)),
                    iteration: totalIterations + 1,
                    dpi: currentDpi,
                    quality: midQ
                });
            }

            await new Promise(r => setTimeout(r, 0));
            const bytesMid = await buildPdfFromCanvases(cachedCanvases, midQ, PDFLib, shouldCancel);
            const sizeMid = bytesMid.length;
            totalIterations++;

            if (!smallestCandidate || sizeMid < smallestCandidate.size) {
                smallestCandidate = { bytes: bytesMid, size: sizeMid, dpi: currentDpi, quality: midQ };
            }

            if (sizeMid <= targetBytes) {
                if (!bestValid || sizeMid > bestValid.size) {
                    bestValid = { bytes: bytesMid, size: sizeMid, dpi: currentDpi, quality: midQ };
                }
                minQ = midQ;

                // If within 95%-100%, we are close enough to stop early
                if (sizeMid >= targetBytes * 0.95) {
                    break;
                }
            } else {
                maxQ = midQ;
            }
        }

        // Fine tuning pass: try a couple small increments if still below 90%
        if (bestValid && bestValid.size < targetBytes * 0.90 && maxQ > minQ) {
            for (let f = 0; f < 2; f++) {
                if (totalIterations >= MAX_ITERATIONS || performance.now() - startTime >= MAX_TIME_MS) break;
                const nudgeQ = Number((minQ + (maxQ - minQ) * 0.5).toFixed(3));
                if (nudgeQ <= minQ || nudgeQ >= maxQ) break;

                const bytesNudge = await buildPdfFromCanvases(cachedCanvases, nudgeQ, PDFLib, shouldCancel);
                totalIterations++;
                if (bytesNudge.length <= targetBytes) {
                    if (bytesNudge.length > bestValid.size) {
                        bestValid = { bytes: bytesNudge, size: bytesNudge.length, dpi: currentDpi, quality: nudgeQ };
                    }
                    minQ = nudgeQ;
                } else {
                    maxQ = nudgeQ;
                }
            }
        }

        // Stop search because we successfully found a valid candidate at this resolution
        break;
    }

    // Determine result
    let finalCandidate = bestValid;
    let targetImpossible = false;
    let impossibleMessage = null;

    if (!finalCandidate) {
        // Target was too small to hit even at the lowest settings
        finalCandidate = smallestCandidate;
        targetImpossible = true;
        const closestKB = (finalCandidate.size / 1024).toFixed(1);
        impossibleMessage = `This PDF can't go below ${closestKB} KB without becoming unreadable. Closest we could get: ${closestKB} KB.`;
    }

    // Rule 6: Verify final PDF integrity
    try {
        const verifyDoc = await PDFLib.PDFDocument.load(finalCandidate.bytes);
        if (verifyDoc.getPageCount() !== totalPages) {
            console.error(`Page count mismatch: expected ${totalPages}, verified ${verifyDoc.getPageCount()}`);
        }
    } catch (verr) {
        console.error("[TargetSizeSearch] Integrity verification error:", verr);
    }

    const finalSize = finalCandidate.bytes.length;
    const finalBlob = new Blob([finalCandidate.bytes], { type: "application/pdf" });
    const durationMs = Math.round(performance.now() - startTime);

    return {
        success: true,
        alreadySmaller: false,
        bytes: finalCandidate.bytes,
        blob: finalBlob,
        finalSize,
        targetSizeKB,
        targetImpossible,
        message: impossibleMessage,
        iterations: totalIterations,
        timeMs: durationMs,
        scaleDpi: finalCandidate.dpi,
        quality: finalCandidate.quality,
        rasterized: true,
        note: "Note: Document pages were rasterized for compression; text may not be selectable."
    };
}
