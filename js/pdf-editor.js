/**
 * ShrinkNest PDF Editor
 * File: js/pdf-editor.js
 * Uses: PDF.js (rendering) + PDF-lib (mutation) + SortableJS (smooth reordering)
 * 100% client-side — no server uploads
 */

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const state = {
    pages: [],          // [{ id, pdfIndex, pageIndex, rotation, annotations[], isBlank, blankWidth, blankHeight }]
    pdfDocs: [],        // loaded PDFLib documents
    pdfJsDocs: [],      // loaded PDF.js documents
    files: [],          // [{ id, name, size, pageCount, pdfIndex }]
    fileNames: [],      // array of loaded file names
    selected: new Set(),// Set of selected page indices (0-based)
    lastSelectedIdx: null, // For Shift+Click range selection
    undoStack: [],
    redoStack: [],
    splitMode: false,
    resultBlobs: [],
    zoom: 'md',         // 'sm' | 'md' | 'lg'
    view: 'grid',       // 'grid' | 'list'
};

/* Thumbnail Cache: key => canvas element or image data */
const thumbCache = new Map();
let thumbObserver = null;
let sortableInstance = null;
let pageIdCounter = 1;

/* ─────────────────────────────────────────
   PDF.js SETUP
───────────────────────────────────────── */
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

/* ─────────────────────────────────────────
   DOM REFS
───────────────────────────────────────── */
const uploadZone         = document.getElementById('uploadZone');
const fileInput          = document.getElementById('fileInput');
const addMoreInput       = document.getElementById('addMoreInput');
const windowDropOverlay  = document.getElementById('windowDropOverlay');
const editorWorkspace    = document.getElementById('editorWorkspace');
const pagesGrid          = document.getElementById('pagesGrid');
const pagesSection       = document.getElementById('pagesSection');
const pagesEmptyState    = document.getElementById('pagesEmptyState');
const pageCountEl        = document.getElementById('pageCount');

/* File Bar */
const fileBar            = document.getElementById('fileBar');
const fileLabel          = document.getElementById('fileLabel');
const fileMeta           = document.getElementById('fileMeta');
const btnToggleFiles     = document.getElementById('btnToggleFiles');
const filesCountText     = document.getElementById('filesCountText');
const filesChevron       = document.getElementById('filesChevron');
const filesListContainer = document.getElementById('filesListContainer');

/* Toolbar */
const editorToolbar      = document.getElementById('editorToolbar');
const btnSelectAll       = document.getElementById('btnSelectAll');
const btnDeselectAll     = document.getElementById('btnDeselectAll');
const tbRangeInput       = document.getElementById('tbRangeInput');
const btnRangeSelect     = document.getElementById('btnRangeSelect');
const tbSelectionPill    = document.getElementById('tbSelectionPill');

const btnRotL            = document.getElementById('btnRotL');
const btnRotR            = document.getElementById('btnRotR');
const btnDuplicate       = document.getElementById('btnDuplicate');
const btnInsertBlank     = document.getElementById('btnInsertBlank');
const btnExtract         = document.getElementById('btnExtract');
const btnRemove          = document.getElementById('btnRemove');

const btnMerge           = document.getElementById('btnMerge');
const btnSplit           = document.getElementById('btnSplit');
const btnUndo            = document.getElementById('btnUndo');
const btnRedo            = document.getElementById('btnRedo');

const btnZoomSm          = document.getElementById('btnZoomSm');
const btnZoomMd          = document.getElementById('btnZoomMd');
const btnZoomLg          = document.getElementById('btnZoomLg');
const btnViewToggle      = document.getElementById('btnViewToggle');
const btnShortcutsHelp   = document.getElementById('btnShortcutsHelp');

/* Split Panel */
const splitPanel         = document.getElementById('splitPanel');
const splitInput         = document.getElementById('splitInput');
const btnSplitGo         = document.getElementById('btnSplitGo');

/* Progress & Result */
const progressPanel      = document.getElementById('progressPanel');
const progressMsg        = document.getElementById('progressMsg');
const resultPanel        = document.getElementById('resultPanel');
const resultActions      = document.getElementById('resultActions');

/* Save Bar */
const saveBar            = document.getElementById('saveBar');
const saveBarInfo        = document.getElementById('saveBarInfo');
const btnSave            = document.getElementById('btnSave');

/* Error & Confirm */
const errorBanner        = document.getElementById('errorBanner');
const errorMsg           = document.getElementById('errorMsg');
const confirmModal       = document.getElementById('confirmModal');
const confirmMsg         = document.getElementById('confirmMsg');
const btnConfirmOk       = document.getElementById('btnConfirmOk');
const btnConfirmCancel   = document.getElementById('btnConfirmCancel');
const peToast            = document.getElementById('peToast');

/* Range Presets */
const btnRangePresets    = document.getElementById('btnRangePresets');
const rangePresetsMenu   = document.getElementById('rangePresetsMenu');
const presetEven         = document.getElementById('presetEven');
const presetOdd          = document.getElementById('presetOdd');
const presetInvert       = document.getElementById('presetInvert');

/* Page Numbers Modal */
const btnPageNumbers       = document.getElementById('btnPageNumbers');
const pageNumbersModal     = document.getElementById('pageNumbersModal');
const btnClosePageNumbers  = document.getElementById('btnClosePageNumbers');
const btnCancelPageNumbers = document.getElementById('btnCancelPageNumbers');
const btnApplyPageNumbers  = document.getElementById('btnApplyPageNumbers');
const btnRemovePageNumbers = document.getElementById('btnRemovePageNumbers');
const pnFormat             = document.getElementById('pnFormat');
const pnStartNum           = document.getElementById('pnStartNum');
const pnFontSize           = document.getElementById('pnFontSize');
const pnColor              = document.getElementById('pnColor');
const pnMargin             = document.getElementById('pnMargin');
const pnMarginVal          = document.getElementById('pnMarginVal');
const pnScopeSelected      = document.getElementById('pnScopeSelected');

/* Watermark Modal */
const btnWatermark         = document.getElementById('btnWatermark');
const watermarkModal       = document.getElementById('watermarkModal');
const btnCloseWatermark    = document.getElementById('btnCloseWatermark');
const btnCancelWatermark   = document.getElementById('btnCancelWatermark');
const btnApplyWatermark    = document.getElementById('btnApplyWatermark');
const btnRemoveWatermark   = document.getElementById('btnRemoveWatermark');
const wmTabBtnText         = document.getElementById('wmTabBtnText');
const wmTabBtnImage        = document.getElementById('wmTabBtnImage');
const wmSectionText        = document.getElementById('wmSectionText');
const wmSectionImage       = document.getElementById('wmSectionImage');
const wmText               = document.getElementById('wmText');
const wmFontSize           = document.getElementById('wmFontSize');
const wmFontSizeVal        = document.getElementById('wmFontSizeVal');
const wmColor              = document.getElementById('wmColor');
const wmImageInput         = document.getElementById('wmImageInput');
const wmImagePreview       = document.getElementById('wmImagePreview');
const wmScale              = document.getElementById('wmScale');
const wmScaleVal           = document.getElementById('wmScaleVal');
const wmOpacity            = document.getElementById('wmOpacity');
const wmOpacityVal         = document.getElementById('wmOpacityVal');
const wmRotation           = document.getElementById('wmRotation');
const wmRotationVal        = document.getElementById('wmRotationVal');
const wmScopeSelected      = document.getElementById('wmScopeSelected');

/* Blank Page Modal */
const blankPageModal       = document.getElementById('blankPageModal');
const btnCloseBlankPage    = document.getElementById('btnCloseBlankPage');
const btnCancelBlankPage   = document.getElementById('btnCancelBlankPage');
const btnConfirmInsertBlank= document.getElementById('btnConfirmInsertBlank');
const bpSize               = document.getElementById('bpSize');
const bpOrientation        = document.getElementById('bpOrientation');
const bpPosition           = document.getElementById('bpPosition');
const bpCount              = document.getElementById('bpCount');

/* Batch Crop Modal (Batch B) */
const btnCropModal         = document.getElementById('btnCropModal');
const cropModal            = document.getElementById('cropModal');
const btnCloseCropModal    = document.getElementById('btnCloseCropModal');
const btnCancelCropModal   = document.getElementById('btnCancelCropModal');
const btnApplyCropModal    = document.getElementById('btnApplyCropModal');
const btnResetCropModal    = document.getElementById('btnResetCropModal');
const cropTop              = document.getElementById('cropTop');
const cropBottom           = document.getElementById('cropBottom');
const cropLeft             = document.getElementById('cropLeft');
const cropRight            = document.getElementById('cropRight');
const cropScopeSelected    = document.getElementById('cropScopeSelected');

/* Resize & Margins Modal (Batch B) */
const btnResizeModal       = document.getElementById('btnResizeModal');
const resizeModal          = document.getElementById('resizeModal');
const btnCloseResizeModal  = document.getElementById('btnCloseResizeModal');
const btnCancelResizeModal = document.getElementById('btnCancelResizeModal');
const btnApplyResizeModal  = document.getElementById('btnApplyResizeModal');
const rsPageSize           = document.getElementById('rsPageSize');
const rsOrientation        = document.getElementById('rsOrientation');
const rsMarginPreset       = document.getElementById('rsMarginPreset');
const rsScaleContent       = document.getElementById('rsScaleContent');
const rsScopeSelected      = document.getElementById('rsScopeSelected');

/* Signature Modal (Batch B) */
const signatureModal       = document.getElementById('signatureModal');
const btnCloseSig          = document.getElementById('btnCloseSig');
const btnCancelSig         = document.getElementById('btnCancelSig');
const btnApplySig          = document.getElementById('btnApplySig');
const sigTabBtnDraw        = document.getElementById('sigTabBtnDraw');
const sigTabBtnType        = document.getElementById('sigTabBtnType');
const sigViewDraw          = document.getElementById('sigViewDraw');
const sigViewType          = document.getElementById('sigViewType');
const sigCanvas            = document.getElementById('sigCanvas');
const btnClearSig          = document.getElementById('btnClearSig');
const sigTextInput         = document.getElementById('sigTextInput');
const sigFontSelect        = document.getElementById('sigFontSelect');
const sigTypedPreview      = document.getElementById('sigTypedPreview');
const sigSaveCheck         = document.getElementById('sigSaveCheck');
const savedSigsSection     = document.getElementById('savedSigsSection');
const savedSigsList        = document.getElementById('savedSigsList');

/* Page Editor Extra Tools (Batch B) */
const peImageUploadInput   = document.getElementById('peImageUploadInput');
const peStrokeWidth        = document.getElementById('peStrokeWidth');
const peStrokeWidthVal     = document.getElementById('peStrokeWidthVal');
const peFillWrap           = document.getElementById('peFillWrap');
const peFillToggle         = document.getElementById('peFillToggle');

/* Shortcuts Modal */
const shortcutsModal     = document.getElementById('shortcutsModal');
const btnCloseShortcuts  = document.getElementById('btnCloseShortcuts');
const btnDoneShortcuts   = document.getElementById('btnDoneShortcuts');

/* Page Editor Modal */
const pageEditorModal    = document.getElementById('pageEditorModal');
const peCanvasWrap       = document.getElementById('peCanvasWrap');
const peCanvas           = document.getElementById('peCanvas');
const peAnnotCanvas      = document.getElementById('peAnnotCanvas');
const pePrevBtn          = document.getElementById('pePrevPage');
const peNextBtn          = document.getElementById('peNextPage');
const pePageIndicator    = document.getElementById('pePageIndicator');
const peCloseBtn         = document.getElementById('peClose');
const peCancelBtn        = document.getElementById('peCancelBtn');
const peDoneBtn          = document.getElementById('peDone');
const peToolBtns         = document.querySelectorAll('.pe-tool-btn');
const peTextColor        = document.getElementById('peTextColor');
const peTextSize         = document.getElementById('peTextSize');
const peFontFamily       = document.getElementById('peFontFamily');
const peDrawColor        = document.getElementById('peDrawColor');
const peCropConfirmBar   = document.getElementById('peCropConfirmBar');
const peCropApply        = document.getElementById('peCropApply');
const peCropCancel       = document.getElementById('peCropCancel');
const peAnnotList        = document.getElementById('peAnnotList');
const peUndoBtn          = document.getElementById('peUndo');
const peRedoBtn          = document.getElementById('peRedo');
const peRotLeftBtn       = document.getElementById('peRotLeft');
const peRotRightBtn      = document.getElementById('peRotRight');
const peDeletePageBtn    = document.getElementById('peDeletePage');
const peZoomIn           = document.getElementById('peZoomIn');
const peZoomOut          = document.getElementById('peZoomOut');
const peZoomLabel        = document.getElementById('peZoomLabel');

/* ─────────────────────────────────────────
   INITIALIZATION & DRAG-AND-DROP UPLOAD
───────────────────────────────────────── */

// Upload zone drag-drop
uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
});

fileInput.addEventListener('change', () => {
    handleFiles(Array.from(fileInput.files));
    fileInput.value = '';
});
addMoreInput.addEventListener('change', () => {
    handleFiles(Array.from(addMoreInput.files));
    addMoreInput.value = '';
});

// Full-Window Drag-and-Drop when workspace is visible
let windowDragCount = 0;
window.addEventListener('dragenter', e => {
    if (editorWorkspace.classList.contains('visible')) {
        windowDragCount++;
        windowDropOverlay.classList.add('active');
    }
});
window.addEventListener('dragleave', e => {
    if (editorWorkspace.classList.contains('visible')) {
        windowDragCount--;
        if (windowDragCount <= 0) {
            windowDragCount = 0;
            windowDropOverlay.classList.remove('active');
        }
    }
});
window.addEventListener('dragover', e => {
    if (editorWorkspace.classList.contains('visible')) {
        e.preventDefault();
    }
});
window.addEventListener('drop', e => {
    if (editorWorkspace.classList.contains('visible')) {
        e.preventDefault();
        windowDragCount = 0;
        windowDropOverlay.classList.remove('active');
        if (e.dataTransfer && e.dataTransfer.files.length) {
            handleFiles(Array.from(e.dataTransfer.files));
        }
    }
});

/* ─────────────────────────────────────────
   FILE LOADING LOGIC
───────────────────────────────────────── */
async function handleFiles(files) {
    const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) {
        showError('Please select valid PDF files.');
        return;
    }
    clearError();
    showProgress(`Loading ${pdfs.length} PDF file${pdfs.length > 1 ? 's' : ''}…`);

    let loadedCount = 0;
    for (const file of pdfs) {
        if (state.fileNames.includes(file.name)) {
            showToast(`"${file.name}" is already loaded.`);
            continue;
        }

        try {
            const arrayBuf = await file.arrayBuffer();
            let libDoc;
            try {
                libDoc = await PDFLib.PDFDocument.load(arrayBuf, { ignoreEncryption: false });
            } catch (encErr) {
                showError(`"${file.name}" is password-protected or corrupted.`);
                continue;
            }

            const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
            const pdfIdx = state.pdfDocs.length;
            state.pdfDocs.push(libDoc);
            state.pdfJsDocs.push(pdfJsDoc);
            state.fileNames.push(file.name);

            const pc = libDoc.getPageCount();
            const fileItem = {
                id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                name: file.name,
                size: file.size,
                pageCount: pc,
                pdfIndex: pdfIdx
            };
            state.files.push(fileItem);

            for (let p = 0; p < pc; p++) {
                state.pages.push({
                    id: `pg_${pageIdCounter++}`,
                    pdfIndex: pdfIdx,
                    pageIndex: p,
                    rotation: 0,
                    annotations: [],
                    isBlank: false
                });
            }
            loadedCount++;
        } catch (err) {
            console.error('PDF load error:', err);
            showError(`Failed to load "${file.name}". The file may be corrupted.`);
        }
    }

    hideProgress();
    if (state.pages.length === 0) return;

    pushUndo('Load PDFs');
    showWorkspace();
    await renderGrid();
    renderFilesList();
    if (loadedCount > 0) {
        showToast(`Loaded ${loadedCount} document${loadedCount > 1 ? 's' : ''} (${state.pages.length} total pages).`);
    }
}

/* Format file size helper */
function formatFileSize(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/* ─────────────────────────────────────────
   MULTI-FILE LIST VIEW
───────────────────────────────────────── */
function renderFilesList() {
    if (!filesListContainer) return;

    if (state.files.length > 1) {
        btnToggleFiles.style.display = 'inline-flex';
        filesCountText.textContent = `Files (${state.files.length})`;
    } else {
        btnToggleFiles.style.display = 'none';
        filesListContainer.classList.remove('open');
    }

    filesListContainer.innerHTML = '';
    state.files.forEach((f, idx) => {
        const item = document.createElement('div');
        item.className = 'file-item-card';
        item.innerHTML = `
            <div class="file-item-info">
                <i class="fas fa-file-pdf" style="color:var(--pe-purple);"></i>
                <div>
                    <div class="file-item-name" title="${f.name}">${f.name}</div>
                    <div class="file-item-meta">${f.pageCount} pages • ${formatFileSize(f.size)}</div>
                </div>
            </div>
            <button type="button" class="file-item-remove" data-fidx="${f.pdfIndex}" title="Remove this file and its pages">
                <i class="fas fa-trash-can"></i>
            </button>
        `;
        filesListContainer.appendChild(item);
    });

    filesListContainer.querySelectorAll('.file-item-remove').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const fidx = parseInt(btn.dataset.fidx);
            const targetFile = state.files.find(f => f.pdfIndex === fidx);
            if (!targetFile) return;

            showConfirm(`Remove "${targetFile.name}"?`, `All ${targetFile.pageCount} page(s) from this file will be removed.`, () => {
                pushUndo(`Remove file ${targetFile.name}`);
                // Remove pages originating from this pdfIndex
                state.pages = state.pages.filter(p => p.pdfIndex !== fidx);
                state.files = state.files.filter(f => f.pdfIndex !== fidx);
                state.fileNames = state.fileNames.filter(n => n !== targetFile.name);
                state.selected.clear();
                renderFilesList();
                renderGrid();
                showToast(`Removed "${targetFile.name}"`);
            });
        });
    });
}

btnToggleFiles.addEventListener('click', () => {
    const isOpen = filesListContainer.classList.toggle('open');
    filesChevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
});

/* ─────────────────────────────────────────
   GRID RENDERING WITH INTERSECTION OBSERVER (VIRTUALIZED)
───────────────────────────────────────── */
async function renderGrid() {
    pagesGrid.innerHTML = '';
    updatePageCount();
    updateFileLabel();
    updateToolbarState();

    if (state.pages.length === 0) {
        pagesEmptyState.style.display = 'block';
        return;
    } else {
        pagesEmptyState.style.display = 'none';
    }

    // Set up or reset IntersectionObserver
    if (thumbObserver) {
        thumbObserver.disconnect();
    }
    thumbObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                const idx = parseInt(card.dataset.idx);
                renderThumb(idx);
                observer.unobserve(card);
            }
        });
    }, {
        root: null,
        rootMargin: '250px 0px',
        threshold: 0.01
    });

    // Create skeleton cards
    for (let i = 0; i < state.pages.length; i++) {
        const card = createPageCard(i);
        pagesGrid.appendChild(card);
        thumbObserver.observe(card);
    }

    // Initialize SortableJS
    initSortable();
}

/* ─────────────────────────────────────────
   PAGE CARD DOM CREATION
───────────────────────────────────────── */
function createPageCard(idx) {
    const pg = state.pages[idx];
    const card = document.createElement('div');
    card.className = 'page-card';
    card.dataset.idx = idx;
    card.dataset.id = pg.id;
    card.dataset.rotation = pg.rotation;
    if (state.selected.has(idx)) card.classList.add('selected');

    const annotCount = (pg.annotations || []).length;

    card.innerHTML = `
        <div class="page-thumb-wrap page-thumb-loading" id="thumbWrap_${idx}">
            <div class="spin"></div>
        </div>
        <div class="page-rotation-badge" id="rotBadge_${idx}"></div>
        ${annotCount > 0 ? `<div class="page-annot-badge">${annotCount} edit${annotCount > 1 ? 's' : ''}</div>` : ''}

        <!-- Checkbox Badge (Top Right) -->
        <div class="page-check-badge" data-check="1" title="Select (Ctrl/Cmd+Click or Shift+Click)">
            ${state.selected.has(idx) ? '<i class="fas fa-check" style="font-size:11px;"></i>' : ''}
        </div>

        <!-- Floating Quick-Action Pill on Hover -->
        <div class="page-hover-actions">
            <button type="button" class="page-action-btn" data-action="rotL" title="Rotate Left">
                <i class="fas fa-rotate-left"></i>
            </button>
            <button type="button" class="page-action-btn" data-action="rotR" title="Rotate Right">
                <i class="fas fa-rotate-right"></i>
            </button>
            <button type="button" class="page-action-btn" data-action="dup" title="Duplicate Page">
                <i class="fas fa-copy"></i>
            </button>
            <button type="button" class="page-action-btn" data-action="edit" title="Open Page Editor">
                <i class="fas fa-pen-to-square"></i>
            </button>
            <button type="button" class="page-action-btn danger" data-action="del" title="Remove Page">
                <i class="fas fa-trash-can"></i>
            </button>
        </div>

        <!-- Card Footer -->
        <div class="page-footer">
            <span class="page-num">Page ${idx + 1}</span>
            <div class="page-footer-actions">
                ${idx > 0 ? `<button type="button" class="page-move-btn" data-action="movePrev" title="Move page earlier" aria-label="Move page earlier"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>` : ''}
                ${idx < state.pages.length - 1 ? `<button type="button" class="page-move-btn" data-action="moveNext" title="Move page later" aria-label="Move page later"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>` : ''}
                <button type="button" class="page-card-edit-btn" data-action="edit" title="Edit this page" aria-label="Edit this page">
                    <i class="fas fa-pen-to-square" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    `;

    updateRotationBadge(card, pg.rotation);
    bindCardInteractions(card, idx);
    return card;
}

/* ─────────────────────────────────────────
   CARD INTERACTIONS & SELECTION LOGIC
───────────────────────────────────────── */
function bindCardInteractions(card, idx) {
    card.addEventListener('click', e => {
        // Quick action buttons
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            e.stopPropagation();
            handleCardAction(actionBtn.dataset.action, idx);
            return;
        }

        // Checkbox click
        if (e.target.closest('[data-check]')) {
            e.stopPropagation();
            if (e.shiftKey && state.lastSelectedIdx !== null) {
                rangeSelect(state.lastSelectedIdx, idx);
            } else {
                toggleSelect(idx);
            }
            return;
        }

        // Shift+Click anywhere on card for range select
        if (e.shiftKey && state.lastSelectedIdx !== null) {
            rangeSelect(state.lastSelectedIdx, idx);
            return;
        }

        // Ctrl / Cmd + Click for multi-select
        if (e.ctrlKey || e.metaKey) {
            toggleSelect(idx);
            return;
        }

        // Default click: open page editor
        openPageEditor(idx);
    });

    card.addEventListener('dblclick', e => {
        if (!e.target.closest('[data-check]') && !e.target.closest('[data-action]')) {
            openPageEditor(idx);
        }
    });
}

function movePage(from, to) {
    if (from === to || from < 0 || to < 0 || from >= state.pages.length || to >= state.pages.length) return;
    pushUndo('Move Page');
    const moved = state.pages.splice(from, 1)[0];
    state.pages.splice(to, 0, moved);

    // Update selected indices
    const newSel = new Set();
    state.selected.forEach(s => {
        if (s === from) newSel.add(to);
        else if (from < to && s > from && s <= to) newSel.add(s - 1);
        else if (from > to && s >= to && s < from) newSel.add(s + 1);
        else newSel.add(s);
    });
    state.selected = newSel;
    renderGrid();
    showToast(`Page moved to position ${to + 1}`);
}

function handleCardAction(action, idx) {
    switch (action) {
        case 'movePrev':
            if (idx > 0) movePage(idx, idx - 1);
            break;
        case 'moveNext':
            if (idx < state.pages.length - 1) movePage(idx, idx + 1);
            break;
        case 'rotL':
            rotateSinglePage(idx, -90);
            break;
        case 'rotR':
            rotateSinglePage(idx, 90);
            break;
        case 'dup':
            duplicatePages([idx]);
            break;
        case 'edit':
            openPageEditor(idx);
            break;
        case 'del':
            showConfirm(`Remove Page ${idx + 1}?`, 'You can restore it anytime with Undo.', () => {
                removePages([idx]);
            });
            break;
    }
}

function toggleSelect(idx) {
    if (state.selected.has(idx)) {
        state.selected.delete(idx);
    } else {
        state.selected.add(idx);
    }
    state.lastSelectedIdx = idx;
    syncCardSelection(idx);
    updateToolbarState();
}

function rangeSelect(startIdx, endIdx) {
    const min = Math.min(startIdx, endIdx);
    const max = Math.max(startIdx, endIdx);
    for (let i = min; i <= max; i++) {
        state.selected.add(i);
        syncCardSelection(i);
    }
    state.lastSelectedIdx = endIdx;
    updateToolbarState();
    showToast(`Selected pages ${min + 1} to ${max + 1}`);
}

function syncCardSelection(idx) {
    const card = document.querySelector(`.page-card[data-idx="${idx}"]`);
    if (!card) return;
    const isSel = state.selected.has(idx);
    card.classList.toggle('selected', isSel);
    const chk = card.querySelector('[data-check]');
    if (chk) {
        chk.innerHTML = isSel ? '<i class="fas fa-check" style="font-size:11px;"></i>' : '';
    }
}

/* ─────────────────────────────────────────
   THUMBNAIL RENDERING & CACHING
───────────────────────────────────────── */
async function renderThumb(idx) {
    const pg = state.pages[idx];
    if (!pg) return;
    const wrap = document.getElementById(`thumbWrap_${idx}`);
    if (!wrap) return;

    // Cache key
    const annotHash = (pg.annotations || []).map(a => `${a.type}_${a.xPct || a.x1Pct}_${a.yPct || a.y1Pct}`).join('|');
    const pnHash = pg.pageNumber ? `${pg.pageNumber.format}_${pg.pageNumber.num}_${pg.pageNumber.position}` : '';
    const wmHash = pg.watermark ? `${pg.watermark.type}_${pg.watermark.text}_${pg.watermark.rotation}_${pg.watermark.opacity}` : '';
    const cacheKey = `${pg.isBlank ? 'blank' : pg.pdfIndex}_${pg.pageIndex}_${pg.rotation}_${annotHash}_${pnHash}_${wmHash}`;

    if (thumbCache.has(cacheKey)) {
        wrap.classList.remove('page-thumb-loading');
        wrap.innerHTML = '';
        wrap.appendChild(thumbCache.get(cacheKey).cloneNode(true));
        return;
    }

    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (pg.isBlank) {
            // Blank page render
            const scale = 0.35;
            canvas.width = (pg.blankWidth || 595.28) * scale;
            canvas.height = (pg.blankHeight || 841.89) * scale;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#E2E8F0';
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#94A3B8';
            ctx.font = '12px Poppins, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Blank Page', canvas.width / 2, canvas.height / 2);
        } else {
            // PDF Page Render via PDF.js
            const pdfJsDoc = state.pdfJsDocs[pg.pdfIndex];
            const page = await pdfJsDoc.getPage(pg.pageIndex + 1);
            const viewport = page.getViewport({ scale: 0.45, rotation: pg.rotation });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport }).promise;

            // Draw annotations preview
            const annots = pg.annotations || [];
            annots.filter(a => a.type === 'text').forEach(a => {
                ctx.save();
                ctx.font = `${Math.max(7, (a.fontSize || 16) * 0.45)}px ${a.fontFamily || 'Helvetica'}`;
                ctx.fillStyle = a.color || '#000000';
                ctx.globalAlpha = 0.9;
                ctx.fillText(a.text, a.xPct * canvas.width, a.yPct * canvas.height);
                ctx.restore();
            });

            annots.filter(a => a.type === 'crop').forEach(a => {
                ctx.save();
                ctx.strokeStyle = '#6C63FF';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 2]);
                ctx.strokeRect(
                    a.x1Pct * canvas.width, a.y1Pct * canvas.height,
                    (a.x2Pct - a.x1Pct) * canvas.width, (a.y2Pct - a.y1Pct) * canvas.height
                );
                ctx.restore();
            });

            annots.filter(a => a.type === 'rect').forEach(a => {
                ctx.save();
                ctx.strokeStyle = a.color || '#6C63FF';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(
                    a.x1Pct * canvas.width, a.y1Pct * canvas.height,
                    (a.x2Pct - a.x1Pct) * canvas.width, (a.y2Pct - a.y1Pct) * canvas.height
                );
                ctx.restore();
            });

            annots.filter(a => a.type === 'highlight').forEach(a => {
                ctx.save();
                ctx.fillStyle = a.color || 'rgba(255, 235, 0, 0.45)';
                ctx.fillRect(
                    a.x1Pct * canvas.width, a.y1Pct * canvas.height,
                    (a.x2Pct - a.x1Pct) * canvas.width, (a.y2Pct - a.y1Pct) * canvas.height
                );
                ctx.restore();
            });

            // Draw Pen annotations preview
            annots.filter(a => a.type === 'pen' && a.points && a.points.length > 1).forEach(a => {
                ctx.save();
                ctx.strokeStyle = a.color || '#6C63FF';
                ctx.lineWidth = Math.max(1, (a.width || 3) * 0.45);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(a.points[0].xPct * canvas.width, a.points[0].yPct * canvas.height);
                for (let p = 1; p < a.points.length; p++) {
                    ctx.lineTo(a.points[p].xPct * canvas.width, a.points[p].yPct * canvas.height);
                }
                ctx.stroke();
                ctx.restore();
            });

            // Draw Circle annotations preview
            annots.filter(a => a.type === 'circle').forEach(a => {
                ctx.save();
                const cx = (a.x1Pct + a.x2Pct) * canvas.width / 2;
                const cy = (a.y1Pct + a.y2Pct) * canvas.height / 2;
                const rx = Math.abs(a.x2Pct - a.x1Pct) * canvas.width / 2;
                const ry = Math.abs(a.y2Pct - a.y1Pct) * canvas.height / 2;
                ctx.beginPath();
                ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
                if (a.filled) {
                    ctx.fillStyle = a.color || '#6C63FF';
                    ctx.fill();
                }
                ctx.strokeStyle = a.color || '#6C63FF';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            });

            // Draw Arrow annotations preview
            annots.filter(a => a.type === 'arrow').forEach(a => {
                ctx.save();
                const x1 = a.x1Pct * canvas.width;
                const y1 = a.y1Pct * canvas.height;
                const x2 = a.x2Pct * canvas.width;
                const y2 = a.y2Pct * canvas.height;
                ctx.strokeStyle = a.color || '#6C63FF';
                ctx.fillStyle = a.color || '#6C63FF';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const head = 6;
                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            });

            // Draw Line annotations preview
            annots.filter(a => a.type === 'line').forEach(a => {
                ctx.save();
                ctx.strokeStyle = a.color || '#6C63FF';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(a.x1Pct * canvas.width, a.y1Pct * canvas.height);
                ctx.lineTo(a.x2Pct * canvas.width, a.y2Pct * canvas.height);
                ctx.stroke();
                ctx.restore();
            });

            // Draw Image / Signature annotations preview
            annots.filter(a => a.type === 'image' && a.imgData).forEach(a => {
                if (!a._thumbImg) {
                    a._thumbImg = new Image();
                    a._thumbImg.src = a.imgData;
                    a._thumbImg.onload = () => {
                        const w = a.widthPct * canvas.width;
                        const h = a.heightPct ? a.heightPct * canvas.height : w * (a._thumbImg.naturalHeight / (a._thumbImg.naturalWidth || 1));
                        ctx.drawImage(a._thumbImg, a.xPct * canvas.width, a.yPct * canvas.height, w, h);
                    };
                } else if (a._thumbImg.complete) {
                    const w = a.widthPct * canvas.width;
                    const h = a.heightPct ? a.heightPct * canvas.height : w * (a._thumbImg.naturalHeight / (a._thumbImg.naturalWidth || 1));
                    ctx.drawImage(a._thumbImg, a.xPct * canvas.width, a.yPct * canvas.height, w, h);
                }
            });
        }

        // Draw Watermark preview
        if (pg.watermark) {
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(((pg.watermark.rotation || 0) * Math.PI) / 180);
            ctx.globalAlpha = (pg.watermark.opacity !== undefined ? pg.watermark.opacity : 25) / 100;
            if (pg.watermark.type === 'text' && pg.watermark.text) {
                const fs = Math.max(9, (pg.watermark.fontSize || 48) * 0.4);
                ctx.font = `bold ${fs}px Helvetica, sans-serif`;
                ctx.fillStyle = pg.watermark.color || '#EF4444';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(pg.watermark.text, 0, 0);
            } else if (pg.watermark.type === 'image' && pg.watermark.imgEl) {
                const w = canvas.width * ((pg.watermark.scale || 50) / 100);
                const h = w * (pg.watermark.imgEl.naturalHeight / (pg.watermark.imgEl.naturalWidth || 1));
                ctx.drawImage(pg.watermark.imgEl, -w / 2, -h / 2, w, h);
            }
            ctx.restore();
        }

        // Draw Page Number preview
        if (pg.pageNumber) {
            ctx.save();
            const pn = pg.pageNumber;
            const text = formatPageNumberText(pn.format, pn.num, pn.total);
            const fs = Math.max(7, (pn.fontSize || 11) * 0.55);
            ctx.font = `${fs}px Helvetica, sans-serif`;
            ctx.fillStyle = pn.color || '#333333';
            const m = Math.max(5, (pn.margin || 24) * 0.4);

            let x = canvas.width / 2;
            let y = canvas.height - m;
            ctx.textAlign = 'center';

            if (pn.position.includes('left')) {
                x = m;
                ctx.textAlign = 'left';
            } else if (pn.position.includes('right')) {
                x = canvas.width - m;
                ctx.textAlign = 'right';
            }

            if (pn.position.includes('top')) {
                y = m + fs;
            }

            ctx.fillText(text, x, y);
            ctx.restore();
        }

        thumbCache.set(cacheKey, canvas);
        wrap.classList.remove('page-thumb-loading');
        wrap.innerHTML = '';
        wrap.appendChild(canvas);
    } catch (e) {
        console.warn('Render thumb error:', e);
        if (wrap) {
            wrap.classList.remove('page-thumb-loading');
            wrap.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px;">Preview unavailable</div>';
        }
    }
}

function updateRotationBadge(card, rotation) {
    const badge = card.querySelector('.page-rotation-badge');
    if (!badge) return;
    const norm = ((rotation % 360) + 360) % 360;
    card.dataset.rotation = norm;
    badge.style.display = norm === 0 ? 'none' : 'block';
    if (norm !== 0) badge.textContent = `${norm}°`;
}

/* ─────────────────────────────────────────
   SMOOTH DRAG-AND-DROP REORDER (SORTABLEJS)
───────────────────────────────────────── */
function initSortable() {
    if (sortableInstance) {
        sortableInstance.destroy();
    }
    if (typeof Sortable === 'undefined') return;

    sortableInstance = new Sortable(pagesGrid, {
        animation: 180,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        filter: '.page-check-badge, .page-hover-actions, .page-card-edit-btn',
        preventOnFilter: false,
        onEnd: evt => {
            if (evt.oldIndex === evt.newIndex) return;

            pushUndo('Reorder Pages');
            const moved = state.pages.splice(evt.oldIndex, 1)[0];
            state.pages.splice(evt.newIndex, 0, moved);

            // Re-map selected indices
            const newSel = new Set();
            state.selected.forEach(s => {
                if (s === evt.oldIndex) newSel.add(evt.newIndex);
                else if (evt.oldIndex < evt.newIndex && s > evt.oldIndex && s <= evt.newIndex) newSel.add(s - 1);
                else if (evt.oldIndex > evt.newIndex && s >= evt.newIndex && s < evt.oldIndex) newSel.add(s + 1);
                else newSel.add(s);
            });
            state.selected = newSel;

            renderGrid();
            showToast('Pages reordered');
        }
    });
}

/* ─────────────────────────────────────────
   PAGE MUTATION ACTIONS (Rotate, Duplicate, Blank, Remove)
───────────────────────────────────────── */
function rotateSinglePage(idx, deg) {
    pushUndo('Rotate Page');
    state.pages[idx].rotation = ((state.pages[idx].rotation + deg) % 360 + 360) % 360;
    renderThumb(idx);
    const card = document.querySelector(`.page-card[data-idx="${idx}"]`);
    if (card) updateRotationBadge(card, state.pages[idx].rotation);
    showToast(`Rotated page ${idx + 1}`);
}

function rotateSelected(deg) {
    if (state.selected.size === 0) {
        showToast('Select pages to rotate.');
        return;
    }
    pushUndo(`Rotate ${state.selected.size} page(s)`);
    state.selected.forEach(i => {
        state.pages[i].rotation = ((state.pages[i].rotation + deg) % 360 + 360) % 360;
        const card = document.querySelector(`.page-card[data-idx="${i}"]`);
        if (card) {
            updateRotationBadge(card, state.pages[i].rotation);
            renderThumb(i);
        }
    });
    showToast(`Rotated ${state.selected.size} page(s) ${deg > 0 ? 'right' : 'left'}`);
}

function duplicatePages(indices) {
    if (!indices || !indices.length) return;
    pushUndo(`Duplicate ${indices.length} page(s)`);

    const sorted = [...indices].sort((a, b) => b - a);
    const newSelected = new Set();

    sorted.forEach(idx => {
        const src = state.pages[idx];
        const clone = {
            id: `pg_${pageIdCounter++}`,
            pdfIndex: src.pdfIndex,
            pageIndex: src.pageIndex,
            rotation: src.rotation,
            annotations: JSON.parse(JSON.stringify(src.annotations || [])),
            isBlank: src.isBlank,
            blankWidth: src.blankWidth,
            blankHeight: src.blankHeight,
        };
        state.pages.splice(idx + 1, 0, clone);
        newSelected.add(idx + 1);
    });

    state.selected = newSelected;
    renderGrid();
    showToast(`Duplicated ${indices.length} page(s)`);
}

function formatPageNumberText(format, num, total) {
    switch (format) {
        case 'page_n_of_total':
            return `Page ${num} of ${total}`;
        case 'page_n':
            return `Page ${num}`;
        case 'dash_n_dash':
            return `- ${num} -`;
        case 'n':
        default:
            return `${num}`;
    }
}

function insertBlankPage() {
    blankPageModal.classList.add('open');
}

function removePages(indices) {
    if (!indices || !indices.length) return;
    pushUndo(`Remove ${indices.length} page(s)`);

    const toRemove = [...indices].sort((a, b) => b - a);
    toRemove.forEach(i => state.pages.splice(i, 1));
    state.selected.clear();
    renderGrid();
    showToast(`Removed ${toRemove.length} page(s). Use Undo to restore.`);
}

/* ─────────────────────────────────────────
   TOOLBAR EVENT HANDLERS
───────────────────────────────────────── */
btnSelectAll.addEventListener('click', () => {
    state.pages.forEach((_, i) => state.selected.add(i));
    document.querySelectorAll('.page-card').forEach(c => {
        c.classList.add('selected');
        const chk = c.querySelector('[data-check]');
        if (chk) chk.innerHTML = '<i class="fas fa-check" style="font-size:11px;"></i>';
    });
    updateToolbarState();
});

btnDeselectAll.addEventListener('click', () => {
    state.selected.clear();
    document.querySelectorAll('.page-card').forEach(c => {
        c.classList.remove('selected');
        const chk = c.querySelector('[data-check]');
        if (chk) chk.innerHTML = '';
    });
    updateToolbarState();
});

btnRangeSelect.addEventListener('click', applyRangeSelection);
tbRangeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') applyRangeSelection();
});

function applyRangeSelection() {
    const raw = tbRangeInput.value.trim();
    if (!raw) return;
    const ranges = parseRangeString(raw, state.pages.length);
    if (!ranges || !ranges.length) {
        showToast('Invalid page range (e.g. 1-3, 5, 8-10)');
        return;
    }

    state.selected.clear();
    ranges.forEach(idx => state.selected.add(idx));
    document.querySelectorAll('.page-card').forEach((c, i) => {
        const isSel = state.selected.has(i);
        c.classList.toggle('selected', isSel);
        const chk = c.querySelector('[data-check]');
        if (chk) chk.innerHTML = isSel ? '<i class="fas fa-check" style="font-size:11px;"></i>' : '';
    });
    updateToolbarState();
    showToast(`Selected ${state.selected.size} page(s) by range`);
}

function parseRangeString(raw, total) {
    const set = new Set();
    const parts = raw.split(',');
    for (const part of parts) {
        const t = part.trim();
        if (!t) continue;
        if (t.includes('-')) {
            const [a, b] = t.split('-').map(Number);
            if (isNaN(a) || isNaN(b) || a < 1 || b > total || a > b) return null;
            for (let i = a - 1; i <= b - 1; i++) set.add(i);
        } else {
            const n = Number(t);
            if (isNaN(n) || n < 1 || n > total) return null;
            set.add(n - 1);
        }
    }
    return Array.from(set).sort((a, b) => a - b);
}

btnRotL.addEventListener('click', () => rotateSelected(-90));
btnRotR.addEventListener('click', () => rotateSelected(90));
btnDuplicate.addEventListener('click', () => duplicatePages(Array.from(state.selected)));
btnInsertBlank.addEventListener('click', insertBlankPage);

// Contextual Action Bar Wiring
const cabClearBtn = document.getElementById('cabClearBtn');
const cabRotL = document.getElementById('cabRotL');
const cabRotR = document.getElementById('cabRotR');
const cabDup = document.getElementById('cabDup');
const cabExtract = document.getElementById('cabExtract');
const cabRemove = document.getElementById('cabRemove');

if (cabClearBtn) cabClearBtn.addEventListener('click', () => btnDeselectAll.click());
if (cabRotL) cabRotL.addEventListener('click', () => btnRotL.click());
if (cabRotR) cabRotR.addEventListener('click', () => btnRotR.click());
if (cabDup) cabDup.addEventListener('click', () => btnDuplicate.click());
if (cabExtract) cabExtract.addEventListener('click', () => btnExtract.click());
if (cabRemove) cabRemove.addEventListener('click', () => btnRemove.click());

// Companion Details Panel Wiring
const compRotL = document.getElementById('compRotL');
const compRotR = document.getElementById('compRotR');
const compEdit = document.getElementById('compEdit');
const compDelete = document.getElementById('compDelete');
const compAddBlank = document.getElementById('compAddBlank');

if (compRotL) compRotL.addEventListener('click', () => {
    const idx = state.selected.size > 0 ? Array.from(state.selected)[0] : 0;
    if (state.pages[idx]) rotateSinglePage(idx, -90);
});
if (compRotR) compRotR.addEventListener('click', () => {
    const idx = state.selected.size > 0 ? Array.from(state.selected)[0] : 0;
    if (state.pages[idx]) rotateSinglePage(idx, 90);
});
if (compEdit) compEdit.addEventListener('click', () => {
    const idx = state.selected.size > 0 ? Array.from(state.selected)[0] : 0;
    if (state.pages[idx]) openPageEditor(idx);
});
if (compDelete) compDelete.addEventListener('click', () => {
    const idx = state.selected.size > 0 ? Array.from(state.selected)[0] : 0;
    if (state.pages[idx]) {
        showConfirm(`Remove Page ${idx + 1}?`, 'You can restore it anytime with Undo.', () => {
            removePages([idx]);
        });
    }
});
if (compAddBlank) compAddBlank.addEventListener('click', insertBlankPage);

// File Bar Remove Current File
const btnRemoveCurrentFile = document.getElementById('btnRemoveCurrentFile');
if (btnRemoveCurrentFile) {
    btnRemoveCurrentFile.addEventListener('click', () => {
        if (state.pages.length === 0) return;
        showConfirm('Remove Document?', 'All loaded pages will be cleared from this editor session.', () => {
            pushUndo('Clear Document');
            state.pages = [];
            state.files = [];
            state.fileNames = [];
            state.selected.clear();
            thumbCache.clear();
            renderFilesList();
            renderGrid();
            showToast('Document cleared');
        });
    });
}

// Result Panel Close Button
const btnCloseResult = document.getElementById('btnCloseResult');
if (btnCloseResult) {
    btnCloseResult.addEventListener('click', () => {
        resultPanel.classList.remove('visible');
    });
}

btnRemove.addEventListener('click', () => {
    if (state.selected.size === 0) {
        showToast('Select pages to remove.');
        return;
    }
    showConfirm(`Remove ${state.selected.size} page(s)?`, 'This can be restored at any time with Undo.', () => {
        removePages(Array.from(state.selected));
    });
});

btnExtract.addEventListener('click', async () => {
    if (state.selected.size === 0) {
        showToast('Select pages to extract.');
        return;
    }
    const indices = Array.from(state.selected).sort((a, b) => a - b);
    await buildAndDownload(indices, 'extracted');
});

btnMerge.addEventListener('click', async () => {
    if (state.pages.length === 0) {
        showToast('No pages to merge.');
        return;
    }
    await buildAndDownload(state.pages.map((_, i) => i), 'merged');
});

btnSplit.addEventListener('click', () => {
    state.splitMode = !state.splitMode;
    splitPanel.classList.toggle('visible', state.splitMode);
    btnSplit.classList.toggle('active', state.splitMode);
});

btnSplitGo.addEventListener('click', async () => {
    const raw = splitInput.value.trim();
    if (!raw) { showToast('Enter page ranges (e.g. 1-3, 4-6)'); return; }
    const groups = parseRanges(raw, state.pages.length);
    if (!groups) { showError('Invalid range format. Use: 1-3, 4-6'); return; }
    clearError();
    showProgress(`Splitting into ${groups.length} PDF(s)…`);
    state.resultBlobs = [];
    for (let g = 0; g < groups.length; g++) {
        const blob = await buildBlob(groups[g]);
        if (blob) state.resultBlobs.push({ blob, name: `split_part${g + 1}.pdf` });
    }
    hideProgress();
    showResultMultiple(state.resultBlobs, 'Split complete!');
    splitPanel.classList.remove('visible');
    state.splitMode = false;
    btnSplit.classList.remove('active');
});

btnUndo.addEventListener('click', () => {
    if (state.undoStack.length <= 1) { showToast('Nothing to undo.'); return; }
    const cur = state.undoStack.pop();
    state.redoStack.push(cur);
    restoreState(state.undoStack[state.undoStack.length - 1]);
    showToast('Undone');
});

btnRedo.addEventListener('click', () => {
    if (state.redoStack.length === 0) { showToast('Nothing to redo.'); return; }
    const next = state.redoStack.pop();
    state.undoStack.push(next);
    restoreState(next);
    showToast('Redone');
});

/* ─────────────────────────────────────────
   ZOOM & VIEW CONTROLS
───────────────────────────────────────── */
[btnZoomSm, btnZoomMd, btnZoomLg].forEach(btn => {
    btn.addEventListener('click', () => {
        [btnZoomSm, btnZoomMd, btnZoomLg].forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.zoom = btn.dataset.zoom;
        pagesGrid.dataset.zoom = state.zoom;
    });
});

btnViewToggle.addEventListener('click', () => {
    state.view = state.view === 'grid' ? 'list' : 'grid';
    pagesGrid.dataset.view = state.view;
    btnViewToggle.innerHTML = state.view === 'grid' ? '<i class="fas fa-list-ul"></i>' : '<i class="fas fa-table-cells"></i>';
    btnViewToggle.title = state.view === 'grid' ? 'Toggle List View' : 'Toggle Grid View';
});

btnShortcutsHelp.addEventListener('click', () => {
    shortcutsModal.classList.add('open');
});
btnCloseShortcuts.addEventListener('click', () => shortcutsModal.classList.remove('open'));
btnDoneShortcuts.addEventListener('click', () => shortcutsModal.classList.remove('open'));
shortcutsModal.addEventListener('click', e => {
    if (e.target === shortcutsModal) shortcutsModal.classList.remove('open');
});

/* ─────────────────────────────────────────
   RANGE PRESETS MENU
───────────────────────────────────────── */
btnRangePresets.addEventListener('click', e => {
    e.stopPropagation();
    const isVisible = rangePresetsMenu.style.display === 'flex';
    rangePresetsMenu.style.display = isVisible ? 'none' : 'flex';
});

document.addEventListener('click', e => {
    if (!e.target.closest('#rangePresetsMenu') && !e.target.closest('#btnRangePresets')) {
        rangePresetsMenu.style.display = 'none';
    }
});

presetEven.addEventListener('click', () => {
    rangePresetsMenu.style.display = 'none';
    state.selected.clear();
    state.pages.forEach((_, i) => {
        if ((i + 1) % 2 === 0) state.selected.add(i);
    });
    syncAllCardSelections();
    updateToolbarState();
    showToast(`Selected ${state.selected.size} even page(s)`);
});

presetOdd.addEventListener('click', () => {
    rangePresetsMenu.style.display = 'none';
    state.selected.clear();
    state.pages.forEach((_, i) => {
        if ((i + 1) % 2 !== 0) state.selected.add(i);
    });
    syncAllCardSelections();
    updateToolbarState();
    showToast(`Selected ${state.selected.size} odd page(s)`);
});

presetInvert.addEventListener('click', () => {
    rangePresetsMenu.style.display = 'none';
    const newSel = new Set();
    state.pages.forEach((_, i) => {
        if (!state.selected.has(i)) newSel.add(i);
    });
    state.selected = newSel;
    syncAllCardSelections();
    updateToolbarState();
    showToast(`Inverted selection (${state.selected.size} selected)`);
});

function syncAllCardSelections() {
    document.querySelectorAll('.page-card').forEach((c, i) => {
        const isSel = state.selected.has(i);
        c.classList.toggle('selected', isSel);
        const chk = c.querySelector('[data-check]');
        if (chk) chk.innerHTML = isSel ? '<i class="fas fa-check" style="font-size:11px;"></i>' : '';
    });
}

/* ─────────────────────────────────────────
   BLANK PAGE MODAL
───────────────────────────────────────── */
btnCloseBlankPage.addEventListener('click', () => blankPageModal.classList.remove('open'));
btnCancelBlankPage.addEventListener('click', () => blankPageModal.classList.remove('open'));
blankPageModal.addEventListener('click', e => {
    if (e.target === blankPageModal) blankPageModal.classList.remove('open');
});

btnConfirmInsertBlank.addEventListener('click', () => {
    const sizeType = bpSize.value;
    const isLandscape = bpOrientation.value === 'landscape';
    const pos = bpPosition.value;
    const count = Math.max(1, Math.min(50, parseInt(bpCount.value) || 1));

    let baseW = sizeType === 'letter' ? 612 : 595.28;
    let baseH = sizeType === 'letter' ? 792 : 841.89;
    if (isLandscape) {
        const tmp = baseW; baseW = baseH; baseH = tmp;
    }

    pushUndo(`Insert ${count} blank page(s)`);

    let targetIdx = state.pages.length;
    if (pos === 'start') {
        targetIdx = 0;
    } else if (pos === 'end') {
        targetIdx = state.pages.length;
    } else if (state.selected.size > 0) {
        const selIndices = Array.from(state.selected).sort((a, b) => a - b);
        targetIdx = pos === 'before' ? selIndices[0] : selIndices[selIndices.length - 1] + 1;
    }

    const newIndices = new Set();
    for (let c = 0; c < count; c++) {
        const blank = {
            id: `pg_${pageIdCounter++}`,
            pdfIndex: -1,
            pageIndex: -1,
            rotation: 0,
            annotations: [],
            isBlank: true,
            blankWidth: baseW,
            blankHeight: baseH
        };
        state.pages.splice(targetIdx + c, 0, blank);
        newIndices.add(targetIdx + c);
    }

    state.selected = newIndices;
    blankPageModal.classList.remove('open');
    renderGrid();
    showToast(`Inserted ${count} blank page(s)`);
});

/* ─────────────────────────────────────────
   PAGE NUMBERS MODAL
───────────────────────────────────────── */
let selectedPnPosition = 'bottom-center';
document.querySelectorAll('.pe-pos-btn[data-pos]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.pe-pos-btn[data-pos]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPnPosition = btn.dataset.pos;
    });
});

pnMargin.addEventListener('input', () => {
    pnMarginVal.textContent = `${pnMargin.value} pt`;
});

btnPageNumbers.addEventListener('click', () => {
    if (state.pages.length === 0) {
        showToast('Load a PDF first.');
        return;
    }
    if (pnScopeSelected) {
        pnScopeSelected.disabled = state.selected.size === 0;
        if (state.selected.size === 0) {
            document.querySelector('input[name="pnScope"][value="all"]').checked = true;
        }
    }
    pageNumbersModal.classList.add('open');
});
btnClosePageNumbers.addEventListener('click', () => pageNumbersModal.classList.remove('open'));
btnCancelPageNumbers.addEventListener('click', () => pageNumbersModal.classList.remove('open'));
pageNumbersModal.addEventListener('click', e => {
    if (e.target === pageNumbersModal) pageNumbersModal.classList.remove('open');
});

btnApplyPageNumbers.addEventListener('click', () => {
    const format = pnFormat.value;
    const startNum = parseInt(pnStartNum.value) || 1;
    const fs = parseInt(pnFontSize.value) || 11;
    const col = pnColor.value || '#333333';
    const margin = parseInt(pnMargin.value) || 24;
    const scopeRadio = document.querySelector('input[name="pnScope"]:checked');
    const scope = scopeRadio ? scopeRadio.value : 'all';

    pushUndo('Apply Page Numbers');

    const targetIndices = scope === 'selected' && state.selected.size > 0
        ? Array.from(state.selected).sort((a, b) => a - b)
        : state.pages.map((_, i) => i);

    const totalCount = targetIndices.length;
    targetIndices.forEach((pi, idx) => {
        state.pages[pi].pageNumber = {
            format,
            num: startNum + idx,
            total: totalCount,
            position: selectedPnPosition,
            fontSize: fs,
            color: col,
            margin,
        };
    });

    pageNumbersModal.classList.remove('open');
    thumbCache.clear();
    renderGrid();
    showToast(`Page numbers added to ${targetIndices.length} page(s)`);
});

btnRemovePageNumbers.addEventListener('click', () => {
    pushUndo('Remove Page Numbers');
    state.pages.forEach(p => { delete p.pageNumber; });
    pageNumbersModal.classList.remove('open');
    thumbCache.clear();
    renderGrid();
    showToast('Page numbers removed');
});

/* ─────────────────────────────────────────
   WATERMARK MODAL
───────────────────────────────────────── */
let wmActiveTab = 'text';
let wmImageData = null;

wmTabBtnText.addEventListener('click', () => {
    wmActiveTab = 'text';
    wmTabBtnText.classList.add('active');
    wmTabBtnImage.classList.remove('active');
    wmSectionText.style.display = 'block';
    wmSectionImage.style.display = 'none';
});

wmTabBtnImage.addEventListener('click', () => {
    wmActiveTab = 'image';
    wmTabBtnImage.classList.add('active');
    wmTabBtnText.classList.remove('active');
    wmSectionText.style.display = 'none';
    wmSectionImage.style.display = 'block';
});

document.querySelectorAll('.wm-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        wmText.value = btn.textContent.trim();
    });
});

wmFontSize.addEventListener('input', () => { wmFontSizeVal.textContent = `${wmFontSize.value} pt`; });
wmScale.addEventListener('input', () => { wmScaleVal.textContent = `${wmScale.value}%`; });
wmOpacity.addEventListener('input', () => { wmOpacityVal.textContent = `${wmOpacity.value}%`; });
wmRotation.addEventListener('input', () => { wmRotationVal.textContent = `${wmRotation.value}°`; });

wmImageInput.addEventListener('change', async () => {
    const file = wmImageInput.files[0];
    if (!file) return;
    const type = file.type.includes('png') ? 'png' : 'jpg';
    const arrayBuf = await file.arrayBuffer();
    const dataUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
        wmImageData = {
            bytes: new Uint8Array(arrayBuf),
            type,
            imgEl: img
        };
        wmImagePreview.src = dataUrl;
        wmImagePreview.style.display = 'block';
    };
});

btnWatermark.addEventListener('click', () => {
    if (state.pages.length === 0) {
        showToast('Load a PDF first.');
        return;
    }
    if (wmScopeSelected) {
        wmScopeSelected.disabled = state.selected.size === 0;
        if (state.selected.size === 0) {
            document.querySelector('input[name="wmScope"][value="all"]').checked = true;
        }
    }
    watermarkModal.classList.add('open');
});
btnCloseWatermark.addEventListener('click', () => watermarkModal.classList.remove('open'));
btnCancelWatermark.addEventListener('click', () => watermarkModal.classList.remove('open'));
watermarkModal.addEventListener('click', e => {
    if (e.target === watermarkModal) watermarkModal.classList.remove('open');
});

btnApplyWatermark.addEventListener('click', () => {
    const scopeRadio = document.querySelector('input[name="wmScope"]:checked');
    const scope = scopeRadio ? scopeRadio.value : 'all';
    const opacity = parseInt(wmOpacity.value) || 25;
    const rotation = parseInt(wmRotation.value) || 45;

    const targetIndices = scope === 'selected' && state.selected.size > 0
        ? Array.from(state.selected)
        : state.pages.map((_, i) => i);

    pushUndo('Apply Watermark');

    if (wmActiveTab === 'text') {
        const text = wmText.value.trim() || 'CONFIDENTIAL';
        const fontSize = parseInt(wmFontSize.value) || 48;
        const color = wmColor.value || '#EF4444';

        targetIndices.forEach(pi => {
            state.pages[pi].watermark = {
                type: 'text',
                text,
                fontSize,
                color,
                opacity,
                rotation,
            };
        });
    } else {
        if (!wmImageData) {
            showToast('Please choose a watermark image first.');
            return;
        }
        const scale = parseInt(wmScale.value) || 50;
        targetIndices.forEach(pi => {
            state.pages[pi].watermark = {
                type: 'image',
                imageBytes: wmImageData.bytes,
                imageType: wmImageData.type,
                imgEl: wmImageData.imgEl,
                scale,
                opacity,
                rotation,
            };
        });
    }

    watermarkModal.classList.remove('open');
    thumbCache.clear();
    renderGrid();
    showToast(`Watermark applied to ${targetIndices.length} page(s)`);
});

btnRemoveWatermark.addEventListener('click', () => {
    pushUndo('Remove Watermarks');
    state.pages.forEach(p => { delete p.watermark; });
    watermarkModal.classList.remove('open');
    thumbCache.clear();
    renderGrid();
    showToast('Watermarks removed');
});

/* ─────────────────────────────────────────
   KEYBOARD SHORTCUTS
───────────────────────────────────────── */
window.addEventListener('keydown', e => {
    // Avoid intercepting input fields
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        if (e.key === 'Escape') active.blur();
        return;
    }

    const isCtrl = e.ctrlKey || e.metaKey;

    // Esc: close modals or deselect
    if (e.key === 'Escape') {
        if (shortcutsModal.classList.contains('open')) {
            shortcutsModal.classList.remove('open');
            return;
        }
        if (confirmModal.classList.contains('open')) {
            confirmModal.classList.remove('open');
            return;
        }
        if (pageEditorModal.classList.contains('open')) {
            closePageEditor();
            return;
        }
        if (state.selected.size > 0) {
            btnDeselectAll.click();
            return;
        }
    }

    // Ctrl + Z: Undo
    if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (!btnUndo.disabled) btnUndo.click();
        return;
    }

    // Ctrl + Shift + Z or Ctrl + Y: Redo
    if ((isCtrl && e.shiftKey && e.key.toLowerCase() === 'z') || (isCtrl && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        if (!btnRedo.disabled) btnRedo.click();
        return;
    }

    // Ctrl + A: Select All
    if (isCtrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        btnSelectAll.click();
        return;
    }

    // Delete or Backspace: Remove selected
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selected.size > 0 && !pageEditorModal.classList.contains('open')) {
            e.preventDefault();
            btnRemove.click();
            return;
        }
    }

    // R: Rotate Right (without Ctrl/Alt)
    if (!isCtrl && !e.altKey && e.key === 'r') {
        e.preventDefault();
        if (state.selected.size > 0) rotateSelected(90);
        return;
    }

    // Shift + R: Rotate Left
    if (!isCtrl && !e.altKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        if (state.selected.size > 0) rotateSelected(-90);
        return;
    }

    // Ctrl + S: Save & Download PDF
    if (isCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (state.pages.length > 0 && !btnSave.disabled) {
            btnSave.click();
        }
        return;
    }

    // ?: Open shortcuts cheat sheet
    if (e.key === '?') {
        shortcutsModal.classList.add('open');
    }
});

/* ─────────────────────────────────────────
   PAGE EDITOR MODAL (Interactive Canvas)
───────────────────────────────────────── */
let peState = {
    pageIdx: 0,
    activeTool: 'select',   // select | text | crop | rect | highlight
    zoom: 1.0,
    viewport: null,
    pdfJsPage: null,
    annotHistory: [],
    annotRedoStack: [],
    cropRect: null,
    isDragging: false,
    dragStart: null,
    textInputEl: null,
};

async function openPageEditor(pageIdx) {
    if (pageIdx < 0 || pageIdx >= state.pages.length) return;
    peState.pageIdx = pageIdx;
    peState.activeTool = 'select';
    peState.zoom = 1.0;
    peState.cropRect = null;
    peState.annotHistory = [JSON.parse(JSON.stringify(state.pages[pageIdx].annotations || []))];
    peState.annotRedoStack = [];

    pageEditorModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setActiveTool('select');
    await renderPageInEditor();
    updatePeNav();
    updatePeAnnotList();
    updatePeHistoryBtns();
}

function closePageEditor() {
    pageEditorModal.classList.remove('open');
    document.body.style.overflow = '';
    if (peState.textInputEl) {
        peState.textInputEl.remove();
        peState.textInputEl = null;
    }
    clearCropRect();
}

peCloseBtn.addEventListener('click', () => {
    closePageEditor();
    renderThumb(peState.pageIdx);
});
peCancelBtn.addEventListener('click', () => {
    // Revert annotations to initial state upon opening
    if (peState.annotHistory.length > 0) {
        state.pages[peState.pageIdx].annotations = JSON.parse(JSON.stringify(peState.annotHistory[0]));
    }
    closePageEditor();
    renderThumb(peState.pageIdx);
});
peDoneBtn.addEventListener('click', () => {
    pushUndo('Edit Page');
    closePageEditor();
    renderThumb(peState.pageIdx);
    renderGrid();
    showToast('Page edits saved');
});

/* Modal Navigation */
pePrevBtn.addEventListener('click', async () => {
    if (peState.pageIdx > 0) {
        renderThumb(peState.pageIdx);
        peState.pageIdx--;
        peState.annotHistory = [JSON.parse(JSON.stringify(state.pages[peState.pageIdx].annotations || []))];
        peState.annotRedoStack = [];
        peState.zoom = 1.0;
        clearCropRect();
        await renderPageInEditor();
        updatePeNav();
        updatePeAnnotList();
    }
});

peNextBtn.addEventListener('click', async () => {
    if (peState.pageIdx < state.pages.length - 1) {
        renderThumb(peState.pageIdx);
        peState.pageIdx++;
        peState.annotHistory = [JSON.parse(JSON.stringify(state.pages[peState.pageIdx].annotations || []))];
        peState.annotRedoStack = [];
        peState.zoom = 1.0;
        clearCropRect();
        await renderPageInEditor();
        updatePeNav();
        updatePeAnnotList();
    }
});

function updatePeNav() {
    pePageIndicator.textContent = `Page ${peState.pageIdx + 1} of ${state.pages.length}`;
    pePrevBtn.disabled = peState.pageIdx === 0;
    peNextBtn.disabled = peState.pageIdx === state.pages.length - 1;
}

/* Modal Zoom */
peZoomIn.addEventListener('click', async () => {
    if (peState.zoom < 3) { peState.zoom = Math.min(3, peState.zoom + 0.25); await renderPageInEditor(); }
});
peZoomOut.addEventListener('click', async () => {
    if (peState.zoom > 0.5) { peState.zoom = Math.max(0.5, peState.zoom - 0.25); await renderPageInEditor(); }
});

/* Rotate in Editor */
peRotLeftBtn.addEventListener('click', async () => {
    state.pages[peState.pageIdx].rotation = ((state.pages[peState.pageIdx].rotation - 90) % 360 + 360) % 360;
    await renderPageInEditor();
    showToast('Rotated left');
});
peRotRightBtn.addEventListener('click', async () => {
    state.pages[peState.pageIdx].rotation = ((state.pages[peState.pageIdx].rotation + 90) % 360 + 360) % 360;
    await renderPageInEditor();
    showToast('Rotated right');
});

/* Delete from Editor */
peDeletePageBtn.addEventListener('click', () => {
    showConfirm('Remove this page?', 'You can undo this with the Undo button.', () => {
        pushUndo('remove');
        state.pages.splice(peState.pageIdx, 1);
        state.selected.clear();
        closePageEditor();
        renderGrid();
        showToast('Page removed');
    });
});

/* Render current page in editor */
async function renderPageInEditor() {
    const pg = state.pages[peState.pageIdx];
    peCanvas.style.opacity = '0.35';

    if (pg.isBlank) {
        const scale = 1.4 * peState.zoom;
        const w = (pg.blankWidth || 595.28) * scale;
        const h = (pg.blankHeight || 841.89) * scale;
        peCanvas.width = w;
        peCanvas.height = h;
        peAnnotCanvas.width = w;
        peAnnotCanvas.height = h;
        const ctx = peCanvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
    } else {
        const pdfJsDoc = state.pdfJsDocs[pg.pdfIndex];
        peState.pdfJsPage = await pdfJsDoc.getPage(pg.pageIndex + 1);
        const viewport = peState.pdfJsPage.getViewport({ scale: 1.5 * peState.zoom, rotation: pg.rotation });
        peState.viewport = viewport;

        peCanvas.width = viewport.width;
        peCanvas.height = viewport.height;
        peAnnotCanvas.width = viewport.width;
        peAnnotCanvas.height = viewport.height;

        const ctx = peCanvas.getContext('2d');
        await peState.pdfJsPage.render({ canvasContext: ctx, viewport }).promise;
    }

    peCanvas.style.opacity = '1';
    peZoomLabel.textContent = `${Math.round(peState.zoom * 100)}%`;
    redrawAnnotations();
}

function redrawAnnotations() {
    const ctx = peAnnotCanvas.getContext('2d');
    ctx.clearRect(0, 0, peAnnotCanvas.width, peAnnotCanvas.height);

    const pg = state.pages[peState.pageIdx];
    (pg.annotations || []).forEach(a => {
        if (a.type === 'text') {
            ctx.save();
            ctx.font = `${(a.fontSize || 16) * peState.zoom}px ${a.fontFamily || 'Helvetica'}`;
            ctx.fillStyle = a.color || '#000000';
            ctx.globalAlpha = 0.95;
            ctx.fillText(a.text, a.xPct * peAnnotCanvas.width, a.yPct * peAnnotCanvas.height);
            ctx.strokeStyle = 'rgba(108, 99, 255, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            const m = ctx.measureText(a.text);
            ctx.strokeRect(
                a.xPct * peAnnotCanvas.width - 2,
                a.yPct * peAnnotCanvas.height - (a.fontSize || 16) * peState.zoom,
                m.width + 4,
                (a.fontSize || 16) * peState.zoom + 4
            );
            ctx.restore();
        }
        if (a.type === 'crop') {
            ctx.save();
            ctx.strokeStyle = '#6C63FF';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(
                a.x1Pct * peAnnotCanvas.width, a.y1Pct * peAnnotCanvas.height,
                (a.x2Pct - a.x1Pct) * peAnnotCanvas.width, (a.y2Pct - a.y1Pct) * peAnnotCanvas.height
            );
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, 0, peAnnotCanvas.width, a.y1Pct * peAnnotCanvas.height);
            ctx.fillRect(0, a.y2Pct * peAnnotCanvas.height, peAnnotCanvas.width, peAnnotCanvas.height);
            ctx.fillRect(0, a.y1Pct * peAnnotCanvas.height, a.x1Pct * peAnnotCanvas.width, (a.y2Pct - a.y1Pct) * peAnnotCanvas.height);
            ctx.fillRect(a.x2Pct * peAnnotCanvas.width, a.y1Pct * peAnnotCanvas.height, (1 - a.x2Pct) * peAnnotCanvas.width, (a.y2Pct - a.y1Pct) * peAnnotCanvas.height);
            ctx.restore();
        }
        if (a.type === 'rect') {
            ctx.save();
            ctx.strokeStyle = a.color || '#6C63FF';
            ctx.lineWidth = (a.width || 2.5) * peState.zoom;
            const rx = a.x1Pct * peAnnotCanvas.width;
            const ry = a.y1Pct * peAnnotCanvas.height;
            const rw = (a.x2Pct - a.x1Pct) * peAnnotCanvas.width;
            const rh = (a.y2Pct - a.y1Pct) * peAnnotCanvas.height;
            if (a.filled) {
                ctx.fillStyle = a.color || '#6C63FF';
                ctx.globalAlpha = 0.35;
                ctx.fillRect(rx, ry, rw, rh);
                ctx.globalAlpha = 1.0;
            }
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.restore();
        }
        if (a.type === 'circle') {
            ctx.save();
            const cx = (a.x1Pct + a.x2Pct) * peAnnotCanvas.width / 2;
            const cy = (a.y1Pct + a.y2Pct) * peAnnotCanvas.height / 2;
            const rx = Math.abs(a.x2Pct - a.x1Pct) * peAnnotCanvas.width / 2;
            const ry = Math.abs(a.y2Pct - a.y1Pct) * peAnnotCanvas.height / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
            if (a.filled) {
                ctx.fillStyle = a.color || '#6C63FF';
                ctx.globalAlpha = 0.35;
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }
            ctx.strokeStyle = a.color || '#6C63FF';
            ctx.lineWidth = (a.width || 2.5) * peState.zoom;
            ctx.stroke();
            ctx.restore();
        }
        if (a.type === 'arrow') {
            ctx.save();
            const x1 = a.x1Pct * peAnnotCanvas.width;
            const y1 = a.y1Pct * peAnnotCanvas.height;
            const x2 = a.x2Pct * peAnnotCanvas.width;
            const y2 = a.y2Pct * peAnnotCanvas.height;
            ctx.strokeStyle = a.color || '#6C63FF';
            ctx.fillStyle = a.color || '#6C63FF';
            ctx.lineWidth = (a.width || 2.5) * peState.zoom;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const head = 12 * peState.zoom;
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        if (a.type === 'line') {
            ctx.save();
            ctx.strokeStyle = a.color || '#6C63FF';
            ctx.lineWidth = (a.width || 2.5) * peState.zoom;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(a.x1Pct * peAnnotCanvas.width, a.y1Pct * peAnnotCanvas.height);
            ctx.lineTo(a.x2Pct * peAnnotCanvas.width, a.y2Pct * peAnnotCanvas.height);
            ctx.stroke();
            ctx.restore();
        }
        if (a.type === 'pen' && a.points && a.points.length > 1) {
            ctx.save();
            ctx.strokeStyle = a.color || '#6C63FF';
            ctx.lineWidth = (a.width || 3) * peState.zoom;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(a.points[0].xPct * peAnnotCanvas.width, a.points[0].yPct * peAnnotCanvas.height);
            for (let i = 1; i < a.points.length; i++) {
                ctx.lineTo(a.points[i].xPct * peAnnotCanvas.width, a.points[i].yPct * peAnnotCanvas.height);
            }
            ctx.stroke();
            ctx.restore();
        }
        if (a.type === 'image' && a.imgData) {
            if (!a._imgEl) {
                a._imgEl = new Image();
                a._imgEl.src = a.imgData;
                a._imgEl.onload = () => redrawAnnotations();
            } else if (a._imgEl.complete) {
                ctx.save();
                const x = a.xPct * peAnnotCanvas.width;
                const y = a.yPct * peAnnotCanvas.height;
                const w = a.widthPct * peAnnotCanvas.width;
                const h = a.heightPct ? a.heightPct * peAnnotCanvas.height : w * (a._imgEl.naturalHeight / (a._imgEl.naturalWidth || 1));
                ctx.drawImage(a._imgEl, x, y, w, h);
                ctx.strokeStyle = 'rgba(108, 99, 255, 0.45)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 2]);
                ctx.strokeRect(x, y, w, h);
                ctx.restore();
            }
        }
        if (a.type === 'highlight') {
            ctx.save();
            ctx.fillStyle = a.color || 'rgba(255, 235, 0, 0.45)';
            ctx.fillRect(
                a.x1Pct * peAnnotCanvas.width, a.y1Pct * peAnnotCanvas.height,
                (a.x2Pct - a.x1Pct) * peAnnotCanvas.width, (a.y2Pct - a.y1Pct) * peAnnotCanvas.height
            );
            ctx.restore();
        }
    });

    // In-progress Pen Stroke
    if (peState.penPoints && peState.penPoints.length > 1) {
        ctx.save();
        ctx.strokeStyle = peDrawColor ? peDrawColor.value : '#6C63FF';
        ctx.lineWidth = (parseInt(peStrokeWidth ? peStrokeWidth.value : 3) || 3) * peState.zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(peState.penPoints[0].xPct * peAnnotCanvas.width, peState.penPoints[0].yPct * peAnnotCanvas.height);
        for (let i = 1; i < peState.penPoints.length; i++) {
            ctx.lineTo(peState.penPoints[i].xPct * peAnnotCanvas.width, peState.penPoints[i].yPct * peAnnotCanvas.height);
        }
        ctx.stroke();
        ctx.restore();
    }

    // In-progress Crop or Shape Rectangle
    if (peState.cropRect) {
        const r = peState.cropRect;
        ctx.save();
        const strokeColor = peDrawColor ? peDrawColor.value : '#6C63FF';
        const strokeW = (parseInt(peStrokeWidth ? peStrokeWidth.value : 2) || 2) * peState.zoom;

        if (peState.activeTool === 'crop') {
            ctx.strokeStyle = '#6C63FF';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
            ctx.fillStyle = 'rgba(108, 99, 255, 0.1)';
            ctx.fillRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        } else if (peState.activeTool === 'circle') {
            const cx = (r.x1 + r.x2) / 2;
            const cy = (r.y1 + r.y2) / 2;
            const rx = Math.abs(r.x2 - r.x1) / 2;
            const ry = Math.abs(r.y2 - r.y1) / 2;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeW;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (peState.activeTool === 'arrow') {
            ctx.strokeStyle = strokeColor;
            ctx.fillStyle = strokeColor;
            ctx.lineWidth = strokeW;
            ctx.beginPath();
            ctx.moveTo(r.x1, r.y1);
            ctx.lineTo(r.x2, r.y2);
            ctx.stroke();
            const angle = Math.atan2(r.y2 - r.y1, r.x2 - r.x1);
            const head = 12 * peState.zoom;
            ctx.beginPath();
            ctx.moveTo(r.x2, r.y2);
            ctx.lineTo(r.x2 - head * Math.cos(angle - Math.PI / 6), r.y2 - head * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(r.x2 - head * Math.cos(angle + Math.PI / 6), r.y2 - head * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
        } else if (peState.activeTool === 'line') {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeW;
            ctx.beginPath();
            ctx.moveTo(r.x1, r.y1);
            ctx.lineTo(r.x2, r.y2);
            ctx.stroke();
        } else if (peState.activeTool === 'highlight') {
            ctx.fillStyle = 'rgba(255, 235, 0, 0.4)';
            ctx.fillRect(Math.min(r.x1, r.x2), Math.min(r.y1, r.y2), Math.abs(r.x2 - r.x1), Math.abs(r.y2 - r.y1));
        } else {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeW;
            ctx.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        }
        ctx.restore();
    }
}

peToolBtns.forEach(btn => {
    btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
});

function setActiveTool(tool) {
    if (tool === 'image') {
        if (peImageUploadInput) peImageUploadInput.click();
        return;
    }
    if (tool === 'signature') {
        openSignatureModal();
        return;
    }

    peState.activeTool = tool;
    peToolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === tool));

    const textOpt = document.getElementById('peTextOptions');
    if (textOpt) textOpt.style.display = (tool === 'text') ? 'flex' : 'none';

    const colorOpt = document.getElementById('peColorOptions');
    const isDrawingTool = ['pen', 'rect', 'circle', 'arrow', 'line', 'highlight'].includes(tool);
    if (colorOpt) colorOpt.style.display = isDrawingTool ? 'flex' : 'none';

    if (peFillWrap) {
        peFillWrap.style.display = (tool === 'rect' || tool === 'circle') ? 'block' : 'none';
    }

    peAnnotCanvas.style.cursor =
        tool === 'text' ? 'text' :
        tool === 'eraser' ? 'pointer' :
        ['crop', 'rect', 'circle', 'arrow', 'line', 'pen', 'highlight'].includes(tool) ? 'crosshair' : 'default';

    if (tool !== 'crop') clearCropRect();
}

/* Canvas mouse & touch events */
peAnnotCanvas.addEventListener('mousedown', onCanvasDown);
peAnnotCanvas.addEventListener('mousemove', onCanvasMove);
peAnnotCanvas.addEventListener('mouseup', onCanvasUp);

peAnnotCanvas.addEventListener('touchstart', e => {
    const t = e.touches[0];
    onCanvasDown({ clientX: t.clientX, clientY: t.clientY, target: peAnnotCanvas });
    e.preventDefault();
}, { passive: false });
peAnnotCanvas.addEventListener('touchmove', e => {
    const t = e.touches[0];
    onCanvasMove({ clientX: t.clientX, clientY: t.clientY });
    e.preventDefault();
}, { passive: false });
peAnnotCanvas.addEventListener('touchend', e => {
    onCanvasUp({});
    e.preventDefault();
}, { passive: false });

function getCanvasXY(e) {
    const rect = peAnnotCanvas.getBoundingClientRect();
    const scaleX = peAnnotCanvas.width / rect.width;
    const scaleY = peAnnotCanvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function onCanvasDown(e) {
    const { x, y } = getCanvasXY(e);
    peState.isDragging = true;
    peState.dragStart = { x, y };

    if (peState.activeTool === 'eraser') {
        const pg = state.pages[peState.pageIdx];
        const annots = pg.annotations || [];
        const xPct = x / peAnnotCanvas.width;
        const yPct = y / peAnnotCanvas.height;

        let hitIdx = -1;
        for (let i = annots.length - 1; i >= 0; i--) {
            const a = annots[i];
            if (a.type === 'pen' && a.points) {
                const hit = a.points.some(p => Math.hypot(p.xPct - xPct, p.yPct - yPct) < 0.035);
                if (hit) { hitIdx = i; break; }
            } else if (a.type === 'text' || a.type === 'image') {
                const x1 = a.xPct;
                const y1 = a.yPct;
                const x2 = x1 + (a.widthPct || 0.25);
                const y2 = y1 + (a.heightPct || 0.1);
                if (xPct >= x1 && xPct <= x2 && yPct >= y1 && yPct <= y2) { hitIdx = i; break; }
            } else if (a.x1Pct !== undefined && a.y1Pct !== undefined) {
                const minX = Math.min(a.x1Pct, a.x2Pct) - 0.02;
                const maxX = Math.max(a.x1Pct, a.x2Pct) + 0.02;
                const minY = Math.min(a.y1Pct, a.y2Pct) - 0.02;
                const maxY = Math.max(a.y1Pct, a.y2Pct) + 0.02;
                if (xPct >= minX && xPct <= maxX && yPct >= minY && yPct <= maxY) { hitIdx = i; break; }
            }
        }

        if (hitIdx !== -1) {
            pushPeUndo();
            annots.splice(hitIdx, 1);
            redrawAnnotations();
            updatePeAnnotList();
            showToast('Annotation erased');
        }
        return;
    }

    if (peState.activeTool === 'text') {
        placeTextInput(x, y);
    }
    if (peState.activeTool === 'pen') {
        peState.penPoints = [{ xPct: x / peAnnotCanvas.width, yPct: y / peAnnotCanvas.height }];
        redrawAnnotations();
    }
    if (['crop', 'rect', 'circle', 'arrow', 'line', 'highlight'].includes(peState.activeTool)) {
        peState.cropRect = { x1: x, y1: y, x2: x, y2: y };
    }
}

function onCanvasMove(e) {
    if (!peState.isDragging) return;
    const { x, y } = getCanvasXY(e);

    if (peState.activeTool === 'pen' && peState.penPoints) {
        peState.penPoints.push({ xPct: x / peAnnotCanvas.width, yPct: y / peAnnotCanvas.height });
        redrawAnnotations();
    }
    if (['crop', 'rect', 'circle', 'arrow', 'line', 'highlight'].includes(peState.activeTool) && peState.cropRect) {
        peState.cropRect.x2 = x;
        peState.cropRect.y2 = y;
        redrawAnnotations();
    }
}

function onCanvasUp() {
    if (!peState.isDragging) return;
    peState.isDragging = false;
    const r = peState.cropRect;

    if (peState.activeTool === 'pen' && peState.penPoints && peState.penPoints.length > 1) {
        pushPeUndo();
        const strokeColor = peDrawColor ? peDrawColor.value : '#6C63FF';
        const strokeW = parseInt(peStrokeWidth ? peStrokeWidth.value : 3) || 3;
        const annot = {
            type: 'pen',
            points: peState.penPoints,
            color: strokeColor,
            width: strokeW
        };
        const pg = state.pages[peState.pageIdx];
        if (!pg.annotations) pg.annotations = [];
        pg.annotations.push(annot);
        peState.penPoints = null;
        redrawAnnotations();
        updatePeAnnotList();
        showToast('Drawing added');
    }

    if (peState.activeTool === 'crop' && r && Math.abs(r.x2 - r.x1) > 20 && Math.abs(r.y2 - r.y1) > 20) {
        peCropConfirmBar.classList.add('visible');
    }

    if (['rect', 'circle', 'arrow', 'line', 'highlight'].includes(peState.activeTool) && r && Math.abs(r.x2 - r.x1) > 10) {
        commitDrawAnnotation(peState.activeTool, r);
        peState.cropRect = null;
        redrawAnnotations();
    }
}

function placeTextInput(x, y) {
    if (peState.textInputEl) peState.textInputEl.remove();

    const rect = peAnnotCanvas.getBoundingClientRect();
    const scaleX = rect.width / peAnnotCanvas.width;
    const scaleY = rect.height / peAnnotCanvas.height;

    const wrap = document.createElement('div');
    wrap.style.cssText = `
        position:absolute;
        left:${(x * scaleX)}px;
        top:${(y * scaleY)}px;
        z-index:50;
        display:flex;
        gap:6px;
        align-items:center;
    `;

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = 'Type text…';
    inp.style.cssText = `
        padding:7px 12px;
        font-family:${peFontFamily ? peFontFamily.value : 'Helvetica'};
        font-size:${peTextSize ? peTextSize.value : 16}px;
        color:${peTextColor ? peTextColor.value : '#000000'};
        border:2px solid var(--pe-purple);
        border-radius:10px;
        background:rgba(255,255,255,0.95);
        outline:none;
        min-width:160px;
        box-shadow:0 6px 20px rgba(108,99,255,0.25);
    `;

    const ok = document.createElement('button');
    ok.textContent = '✓';
    ok.style.cssText = `padding:7px 14px;border-radius:10px;border:none;background:var(--pe-purple);color:#fff;font-weight:700;cursor:pointer;`;

    const cancel = document.createElement('button');
    cancel.textContent = '✕';
    cancel.style.cssText = `padding:7px 12px;border-radius:10px;border:none;background:#e2e8f0;cursor:pointer;`;

    wrap.appendChild(inp);
    wrap.appendChild(ok);
    wrap.appendChild(cancel);
    peCanvasWrap.style.position = 'relative';
    peCanvasWrap.appendChild(wrap);
    peState.textInputEl = wrap;
    inp.focus();

    const commit = () => {
        const txt = inp.value.trim();
        if (txt) {
            pushPeUndo();
            const annot = {
                type: 'text',
                text: txt,
                xPct: x / peAnnotCanvas.width,
                yPct: y / peAnnotCanvas.height,
                fontSize: parseInt(peTextSize ? peTextSize.value : 16),
                fontFamily: peFontFamily ? peFontFamily.value : 'Helvetica',
                color: peTextColor ? peTextColor.value : '#000000',
            };
            const pg = state.pages[peState.pageIdx];
            if (!pg.annotations) pg.annotations = [];
            pg.annotations.push(annot);
            redrawAnnotations();
            updatePeAnnotList();
            showToast('Text added');
        }
        wrap.remove();
        peState.textInputEl = null;
    };

    ok.addEventListener('click', commit);
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { wrap.remove(); peState.textInputEl = null; }
    });
    cancel.addEventListener('click', () => { wrap.remove(); peState.textInputEl = null; });
}

function commitDrawAnnotation(type, r) {
    pushPeUndo();
    const x1 = Math.min(r.x1, r.x2) / peAnnotCanvas.width;
    const y1 = Math.min(r.y1, r.y2) / peAnnotCanvas.height;
    const x2 = Math.max(r.x1, r.x2) / peAnnotCanvas.width;
    const y2 = Math.max(r.y1, r.y2) / peAnnotCanvas.height;

    const chosenColor = peDrawColor ? peDrawColor.value : (peTextColor ? peTextColor.value : '#6C63FF');
    const annot = {
        type,
        x1Pct: x1,
        y1Pct: y1,
        x2Pct: x2,
        y2Pct: y2,
        color: type === 'highlight' ? 'rgba(255,235,0,0.45)' : chosenColor
    };

    const pg = state.pages[peState.pageIdx];
    if (!pg.annotations) pg.annotations = [];
    pg.annotations.push(annot);
    redrawAnnotations();
    updatePeAnnotList();
    showToast(type === 'highlight' ? 'Highlight added' : 'Rectangle added');
}

peCropApply.addEventListener('click', () => {
    const r = peState.cropRect;
    if (!r) return;
    pushPeUndo();
    const x1 = Math.min(r.x1, r.x2) / peAnnotCanvas.width;
    const y1 = Math.min(r.y1, r.y2) / peAnnotCanvas.height;
    const x2 = Math.max(r.x1, r.x2) / peAnnotCanvas.width;
    const y2 = Math.max(r.y1, r.y2) / peAnnotCanvas.height;

    const pg = state.pages[peState.pageIdx];
    if (!pg.annotations) pg.annotations = [];
    pg.annotations = pg.annotations.filter(a => a.type !== 'crop');
    pg.annotations.push({ type: 'crop', x1Pct: x1, y1Pct: y1, x2Pct: x2, y2Pct: y2 });
    clearCropRect();
    peCropConfirmBar.classList.remove('visible');
    redrawAnnotations();
    updatePeAnnotList();
    showToast('Crop area set — will apply on export');
});

peCropCancel.addEventListener('click', () => {
    clearCropRect();
    peCropConfirmBar.classList.remove('visible');
});

function clearCropRect() {
    peState.cropRect = null;
    redrawAnnotations();
}

function updatePeAnnotList() {
    const pg = state.pages[peState.pageIdx];
    const annots = pg.annotations || [];
    if (!peAnnotList) return;
    if (annots.length === 0) {
        peAnnotList.innerHTML = '<div class="pe-annot-empty">No edits yet. Use the tools above.</div>';
        return;
    }
    peAnnotList.innerHTML = annots.map((a, i) => {
        const icon = a.type === 'text' ? '💬' : a.type === 'crop' ? '✂️' : a.type === 'highlight' ? '🖊️' : '▭';
        const label = a.type === 'text' ? `"${a.text.substring(0, 20)}${a.text.length > 20 ? '…' : ''}"` :
                      a.type === 'crop' ? `Crop area` :
                      a.type === 'highlight' ? 'Highlight' : 'Rectangle';
        return `<div class="pe-annot-item">
            <span>${icon} ${label}</span>
            <button class="pe-annot-del" data-aidx="${i}" title="Remove edit">✕</button>
        </div>`;
    }).join('');

    peAnnotList.querySelectorAll('.pe-annot-del').forEach(btn => {
        btn.addEventListener('click', () => {
            pushPeUndo();
            const i = parseInt(btn.dataset.aidx);
            state.pages[peState.pageIdx].annotations.splice(i, 1);
            redrawAnnotations();
            updatePeAnnotList();
            showToast('Edit removed');
        });
    });
}

function pushPeUndo() {
    const pg = state.pages[peState.pageIdx];
    peState.annotHistory.push(JSON.parse(JSON.stringify(pg.annotations || [])));
    peState.annotRedoStack = [];
    updatePeHistoryBtns();
}

function updatePeHistoryBtns() {
    peUndoBtn.disabled = peState.annotHistory.length <= 1;
    peRedoBtn.disabled = peState.annotRedoStack.length === 0;
}

peUndoBtn.addEventListener('click', () => {
    if (peState.annotHistory.length <= 1) return;
    const cur = peState.annotHistory.pop();
    peState.annotRedoStack.push(cur);
    const pg = state.pages[peState.pageIdx];
    pg.annotations = JSON.parse(JSON.stringify(peState.annotHistory[peState.annotHistory.length - 1]));
    redrawAnnotations();
    updatePeAnnotList();
    updatePeHistoryBtns();
    showToast('Undone');
});

peRedoBtn.addEventListener('click', () => {
    if (peState.annotRedoStack.length === 0) return;
    const next = peState.annotRedoStack.pop();
    peState.annotHistory.push(next);
    const pg = state.pages[peState.pageIdx];
    pg.annotations = JSON.parse(JSON.stringify(next));
    redrawAnnotations();
    updatePeAnnotList();
    updatePeHistoryBtns();
    showToast('Redone');
});

pageEditorModal.addEventListener('click', e => {
    if (e.target === pageEditorModal) closePageEditor();
});

/* ─────────────────────────────────────────
   BUILD PDF BLOB (with Annotations & Blanks)
───────────────────────────────────────── */
async function buildBlob(pageIndices) {
    try {
        const out = await PDFLib.PDFDocument.create();
        const { rgb, StandardFonts } = PDFLib;
        const degrees = PDFLib.degrees || (n => ({ type: 'degrees', angle: n }));

        for (const pi of pageIndices) {
            const pg = state.pages[pi];

            let outPage;
            if (pg.isBlank) {
                outPage = out.addPage([pg.blankWidth || 595.28, pg.blankHeight || 841.89]);
            } else {
                const srcDoc = state.pdfDocs[pg.pdfIndex];
                const [copied] = await out.copyPages(srcDoc, [pg.pageIndex]);

                // Apply rotation
                const curRot = copied.getRotation().angle;
                const totalRot = (curRot + pg.rotation) % 360;
                copied.setRotation(degrees(totalRot));

                out.addPage(copied);
                outPage = out.getPages()[out.getPageCount() - 1];
            }

            const { width, height } = outPage.getSize();

            // Apply annotations
            for (const a of (pg.annotations || [])) {
                if (a.type === 'text') {
                    try {
                        const fontMap = {
                            'Helvetica': StandardFonts.Helvetica,
                            'Times New Roman': StandardFonts.TimesRoman,
                            'Courier': StandardFonts.Courier,
                        };
                        const fontKey = fontMap[a.fontFamily] || StandardFonts.Helvetica;
                        const font = await out.embedFont(fontKey);
                        const hexColor = a.color || '#000000';
                        const r_ = parseInt(hexColor.slice(1, 3), 16) / 255;
                        const g_ = parseInt(hexColor.slice(3, 5), 16) / 255;
                        const b_ = parseInt(hexColor.slice(5, 7), 16) / 255;
                        outPage.drawText(a.text, {
                            x: a.xPct * width,
                            y: height - (a.yPct * height),
                            size: a.fontSize || 16,
                            font,
                            color: rgb(r_, g_, b_),
                        });
                    } catch (te) {
                        console.warn('Text annotation embed error:', te);
                    }
                }
                if (a.type === 'crop') {
                    const x = a.x1Pct * width;
                    const y_ = (1 - a.y2Pct) * height;
                    const w = (a.x2Pct - a.x1Pct) * width;
                    const h = (a.y2Pct - a.y1Pct) * height;
                    outPage.setCropBox(x, y_, w, h);
                }
                if (a.type === 'rect') {
                    const x = a.x1Pct * width;
                    const y_ = (1 - a.y2Pct) * height;
                    const w = (a.x2Pct - a.x1Pct) * width;
                    const h = (a.y2Pct - a.y1Pct) * height;
                    const hexC = a.color || '#6C63FF';
                    const r_ = parseInt(hexC.slice(1, 3), 16) / 255;
                    const g_ = parseInt(hexC.slice(3, 5), 16) / 255;
                    const b_ = parseInt(hexC.slice(5, 7), 16) / 255;
                    outPage.drawRectangle({
                        x, y: y_, width: w, height: h,
                        borderColor: rgb(r_, g_, b_), borderWidth: 2, opacity: 1
                    });
                }
                if (a.type === 'highlight') {
                    const x = a.x1Pct * width;
                    const y_ = (1 - a.y2Pct) * height;
                    const w = (a.x2Pct - a.x1Pct) * width;
                    const h = (a.y2Pct - a.y1Pct) * height;
                    outPage.drawRectangle({
                        x, y: y_, width: w, height: h,
                        color: PDFLib.rgb(1, 0.92, 0.2), opacity: 0.45
                    });
                }

                // ── Pen / freehand strokes ──
                if (a.type === 'pen' && a.points && a.points.length > 1) {
                    try {
                        const hexC = a.color || '#6C63FF';
                        const r_ = parseInt(hexC.slice(1,3),16)/255;
                        const g_ = parseInt(hexC.slice(3,5),16)/255;
                        const b_ = parseInt(hexC.slice(5,7),16)/255;
                        const lw  = (a.lineWidth || 3) * (width / 800);
                        for (let pi = 1; pi < a.points.length; pi++) {
                            const p0 = a.points[pi-1];
                            const p1 = a.points[pi];
                            outPage.drawLine({
                                start: { x: p0.xPct * width, y: (1 - p0.yPct) * height },
                                end:   { x: p1.xPct * width, y: (1 - p1.yPct) * height },
                                thickness: lw,
                                color: rgb(r_, g_, b_),
                                opacity: 1,
                            });
                        }
                    } catch(pe) { console.warn('Pen annotation error:', pe); }
                }

                // ── Circle / ellipse outline ──
                if (a.type === 'circle') {
                    try {
                        const cx = ((a.x1Pct + a.x2Pct) / 2) * width;
                        const cy = (1 - (a.y1Pct + a.y2Pct) / 2) * height;
                        const rx = Math.abs(a.x2Pct - a.x1Pct) * width / 2;
                        const ry = Math.abs(a.y2Pct - a.y1Pct) * height / 2;
                        const hexC = a.color || '#6C63FF';
                        const r_ = parseInt(hexC.slice(1,3),16)/255;
                        const g_ = parseInt(hexC.slice(3,5),16)/255;
                        const b_ = parseInt(hexC.slice(5,7),16)/255;
                        const lw  = a.lineWidth || 2;
                        outPage.drawEllipse({
                            x: cx, y: cy,
                            xScale: rx, yScale: ry,
                            borderColor: rgb(r_, g_, b_),
                            borderWidth: lw,
                            opacity: a.filled ? 0.25 : 0,
                            color: a.filled ? rgb(r_, g_, b_) : undefined,
                        });
                    } catch(ce) { console.warn('Circle annotation error:', ce); }
                }

                // ── Line ──
                if (a.type === 'line') {
                    try {
                        const hexC = a.color || '#6C63FF';
                        const r_ = parseInt(hexC.slice(1,3),16)/255;
                        const g_ = parseInt(hexC.slice(3,5),16)/255;
                        const b_ = parseInt(hexC.slice(5,7),16)/255;
                        const lw  = a.lineWidth || 2;
                        outPage.drawLine({
                            start: { x: a.x1Pct * width, y: (1 - a.y1Pct) * height },
                            end:   { x: a.x2Pct * width, y: (1 - a.y2Pct) * height },
                            thickness: lw,
                            color: rgb(r_, g_, b_),
                        });
                    } catch(le) { console.warn('Line annotation error:', le); }
                }

                // ── Arrow ──
                if (a.type === 'arrow') {
                    try {
                        const hexC = a.color || '#6C63FF';
                        const r_ = parseInt(hexC.slice(1,3),16)/255;
                        const g_ = parseInt(hexC.slice(3,5),16)/255;
                        const b_ = parseInt(hexC.slice(5,7),16)/255;
                        const lw  = a.lineWidth || 2;
                        const x1 = a.x1Pct * width, y1 = (1 - a.y1Pct) * height;
                        const x2 = a.x2Pct * width, y2 = (1 - a.y2Pct) * height;
                        outPage.drawLine({
                            start: { x: x1, y: y1 },
                            end:   { x: x2, y: y2 },
                            thickness: lw,
                            color: rgb(r_, g_, b_),
                        });
                        // Arrowhead triangle
                        const angle = Math.atan2(y2 - y1, x2 - x1);
                        const hs = Math.max(lw * 4, 10);
                        const ax1 = x2 - hs * Math.cos(angle - Math.PI/6);
                        const ay1 = y2 - hs * Math.sin(angle - Math.PI/6);
                        const ax2 = x2 - hs * Math.cos(angle + Math.PI/6);
                        const ay2 = y2 - hs * Math.sin(angle + Math.PI/6);
                        outPage.drawLine({ start:{x:x2,y:y2}, end:{x:ax1,y:ay1}, thickness:lw, color:rgb(r_,g_,b_) });
                        outPage.drawLine({ start:{x:x2,y:y2}, end:{x:ax2,y:ay2}, thickness:lw, color:rgb(r_,g_,b_) });
                    } catch(ae) { console.warn('Arrow annotation error:', ae); }
                }

                // ── Image annotation (signature, inserted image) ──
                if (a.type === 'image' && a.imgData) {
                    try {
                        let embImg;
                        const dataUrl = a.imgData;
                        if (dataUrl.includes('image/png') || dataUrl.startsWith('data:image/png')) {
                            const base64 = dataUrl.split(',')[1];
                            const bytes  = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                            embImg = await out.embedPng(bytes);
                        } else {
                            const base64 = dataUrl.split(',')[1];
                            const bytes  = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                            embImg = await out.embedJpg(bytes);
                        }
                        const iw = (a.widthPct  || 0.4) * width;
                        const ih = (a.heightPct || 0.2) * height;
                        const ix = (a.xPct || 0.1) * width;
                        const iy = (1 - (a.yPct || 0.5) - (a.heightPct || 0.2)) * height;
                        outPage.drawImage(embImg, {
                            x: ix, y: iy,
                            width: iw, height: ih,
                            opacity: 1,
                        });
                    } catch(ie) { console.warn('Image annotation error:', ie); }
                }
            }

            // Apply Page Numbers
            if (pg.pageNumber) {
                try {
                    const pn = pg.pageNumber;
                    const text = formatPageNumberText(pn.format, pn.num, pn.total);
                    const font = await out.embedFont(StandardFonts.Helvetica);
                    const fs = pn.fontSize || 11;
                    const textWidth = font.widthOfTextAtSize(text, fs);
                    const hexC = pn.color || '#333333';
                    const r_ = parseInt(hexC.slice(1, 3), 16) / 255;
                    const g_ = parseInt(hexC.slice(3, 5), 16) / 255;
                    const b_ = parseInt(hexC.slice(5, 7), 16) / 255;
                    const m = pn.margin || 24;

                    let x = (width - textWidth) / 2;
                    let y = m;

                    if (pn.position.includes('left')) x = m;
                    else if (pn.position.includes('right')) x = width - m - textWidth;

                    if (pn.position.includes('top')) y = height - m - fs;

                    outPage.drawText(text, {
                        x, y,
                        size: fs,
                        font,
                        color: rgb(r_, g_, b_),
                    });
                } catch (pne) {
                    console.warn('Page number embed error:', pne);
                }
            }

            // Apply Watermark
            if (pg.watermark) {
                try {
                    const wm = pg.watermark;
                    const op = (wm.opacity !== undefined ? wm.opacity : 25) / 100;
                    const rot = degrees(wm.rotation || 0);

                    if (wm.type === 'text' && wm.text) {
                        const font = await out.embedFont(StandardFonts.HelveticaBold);
                        const fs = wm.fontSize || 48;
                        const textWidth = font.widthOfTextAtSize(wm.text, fs);
                        const hexC = wm.color || '#EF4444';
                        const r_ = parseInt(hexC.slice(1, 3), 16) / 255;
                        const g_ = parseInt(hexC.slice(3, 5), 16) / 255;
                        const b_ = parseInt(hexC.slice(5, 7), 16) / 255;

                        outPage.drawText(wm.text, {
                            x: (width - textWidth) / 2,
                            y: (height - fs) / 2,
                            size: fs,
                            font,
                            color: rgb(r_, g_, b_),
                            opacity: op,
                            rotate: rot,
                        });
                    } else if (wm.type === 'image' && wm.imageBytes) {
                        let embeddedImg;
                        if (wm.imageType === 'png') {
                            embeddedImg = await out.embedPng(wm.imageBytes);
                        } else {
                            embeddedImg = await out.embedJpg(wm.imageBytes);
                        }
                        const targetW = width * ((wm.scale || 50) / 100);
                        const dims = embeddedImg.scale(targetW / embeddedImg.width);

                        outPage.drawImage(embeddedImg, {
                            x: (width - dims.width) / 2,
                            y: (height - dims.height) / 2,
                            width: dims.width,
                            height: dims.height,
                            opacity: op,
                            rotate: rot,
                        });
                    }
                } catch (wme) {
                    console.warn('Watermark embed error:', wme);
                }
            }
            // ── batchCrop: set CropBox on the outPage ──
            if (pg.batchCrop) {
                try {
                    const bc = pg.batchCrop;
                    const { x: ox, y: oy, width: ow, height: oh } = outPage.getMediaBox();
                    outPage.setCropBox(
                        ox + bc.left,
                        oy + bc.bottom,
                        ow - bc.left - bc.right,
                        oh - bc.top  - bc.bottom
                    );
                } catch(bce) { console.warn('batchCrop error:', bce); }
            }

            // ── resize: embed old page into new blank page ──
            if (pg.resize) {
                try {
                    const rs = pg.resize;
                    const newPage = out.addPage([rs.width, rs.height]);
                    // remove the outPage we just built and replace with newPage
                    // strategy: embed outPage into newPage, then remove old index
                    const embeddedPage = await out.embedPage(outPage);
                    const margin = rs.margin || 0;
                    let dw = rs.width  - 2 * margin;
                    let dh = rs.height - 2 * margin;
                    if (rs.scaleContent) {
                        const scaledDims = embeddedPage.scale(Math.min(dw / embeddedPage.width, dh / embeddedPage.height));
                        dw = scaledDims.width;
                        dh = scaledDims.height;
                    }
                    const dx = (rs.width  - dw) / 2;
                    const dy = (rs.height - dh) / 2;
                    newPage.drawPage(embeddedPage, { x: dx, y: dy, width: dw, height: dh });
                    // Remove the original outPage index (it's the second-to-last page)
                    const pageCount = out.getPageCount();
                    out.removePage(pageCount - 2);
                } catch(rse) { console.warn('resize error:', rse); }
            }
        }

        const bytes = await out.save();
        return new Blob([bytes], { type: 'application/pdf' });
    } catch (e) {
        console.error('Build blob error:', e);
        showError('Failed to generate PDF. Please try again.');
        return null;
    }
}

async function buildAndDownload(pageIndices, label) {
    showProgress('Generating your PDF document…');
    const blob = await buildBlob(pageIndices);
    hideProgress();
    if (!blob) return;
    const name = `shrinknest_${label}_${Date.now()}.pdf`;
    state.resultBlobs = [{ blob, name }];
    showResultSingle(blob, name);
}

btnSave.addEventListener('click', async () => {
    if (state.pages.length === 0) return;
    await buildAndDownload(state.pages.map((_, i) => i), 'edited');
});

/* ─────────────────────────────────────────
   DOWNLOAD & RESULT DISPLAY
───────────────────────────────────────── */
function showResultSingle(blob, name) {
    resultActions.innerHTML = '';
    const url = URL.createObjectURL(blob);
    const sizeKB = (blob.size / 1024).toFixed(1);

    const dl = document.createElement('a');
    dl.href = url;
    dl.download = name;
    dl.className = 'btn-download';
    dl.innerHTML = `<i class="fas fa-download"></i> Download PDF <span style="opacity:0.8;font-size:12px;margin-left:4px;">(${sizeKB} KB)</span>`;
    resultActions.appendChild(dl);

    const again = document.createElement('button');
    again.className = 'btn-edit-again';
    again.innerHTML = '<i class="fas fa-pen-to-square"></i> Keep Editing';
    again.addEventListener('click', () => resultPanel.classList.remove('visible'));
    resultActions.appendChild(again);

    resultPanel.querySelector('p').textContent = `${name} • ${sizeKB} KB`;
    resultPanel.classList.add('visible');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('PDF ready to download!');
}

function showResultMultiple(blobs, title) {
    resultActions.innerHTML = '';
    blobs.forEach(({ blob, name }) => {
        const url = URL.createObjectURL(blob);
        const sizeKB = (blob.size / 1024).toFixed(1);
        const dl = document.createElement('a');
        dl.href = url;
        dl.download = name;
        dl.className = 'btn-download';
        dl.style.marginBottom = '6px';
        dl.innerHTML = `<i class="fas fa-download"></i> ${name} <span style="opacity:0.8;font-size:12px;margin-left:4px;">(${sizeKB} KB)</span>`;
        resultActions.appendChild(dl);
    });

    const again = document.createElement('button');
    again.className = 'btn-edit-again';
    again.innerHTML = '<i class="fas fa-pen-to-square"></i> Keep Editing';
    again.addEventListener('click', () => resultPanel.classList.remove('visible'));
    resultActions.appendChild(again);

    if (resultPanel.querySelector('h3')) resultPanel.querySelector('h3').textContent = title || 'PDF Ready';
    resultPanel.querySelector('p').textContent = `${blobs.length} file(s) generated successfully`;
    resultPanel.classList.add('visible');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ─────────────────────────────────────────
   GLOBAL UNDO / REDO HISTORY STACK
───────────────────────────────────────── */
function pushUndo(label) {
    const snapshot = {
        label,
        pages: state.pages.map(p => ({
            ...p,
            annotations: JSON.parse(JSON.stringify(p.annotations || []))
        })),
        files: [...state.files],
        selected: new Set(state.selected),
    };
    state.undoStack.push(snapshot);
    state.redoStack = [];
    if (state.undoStack.length > 50) state.undoStack.shift();
    updateToolbarState();
}

function restoreState(snapshot) {
    state.pages = snapshot.pages.map(p => ({
        ...p,
        annotations: JSON.parse(JSON.stringify(p.annotations || []))
    }));
    state.files = [...snapshot.files];
    state.selected = new Set(snapshot.selected);
    renderGrid();
    renderFilesList();
    updateToolbarState();
}

/* ─────────────────────────────────────────
   SPLIT RANGE PARSER
───────────────────────────────────────── */
function parseRanges(raw, total) {
    const groups = [];
    for (const part of raw.split(',')) {
        const t = part.trim();
        if (!t) continue;
        if (t.includes('-')) {
            const [a, b] = t.split('-').map(Number);
            if (isNaN(a) || isNaN(b) || a < 1 || b > total || a > b) return null;
            const g = [];
            for (let i = a - 1; i <= b - 1; i++) g.push(i);
            groups.push(g);
        } else {
            const n = Number(t);
            if (isNaN(n) || n < 1 || n > total) return null;
            groups.push([n - 1]);
        }
    }
    return groups.length ? groups : null;
}

/* ─────────────────────────────────────────
   UI STATE & FEEDBACK HELPERS
───────────────────────────────────────── */
function showWorkspace() {
    uploadZone.style.display = 'none';
    editorWorkspace.classList.add('visible');
    saveBar.classList.add('visible');
    updateSaveBarInfo();
}

function showProgress(msg) {
    progressMsg.textContent = msg;
    progressPanel.classList.add('visible');
}

function hideProgress() {
    progressPanel.classList.remove('visible');
}

function updatePageCount() {
    if (pageCountEl) {
        pageCountEl.textContent = `${state.pages.length} page${state.pages.length !== 1 ? 's' : ''}`;
    }
}

function updateFileLabel() {
    if (!fileLabel) return;
    const btnRemoveCurrentFile = document.getElementById('btnRemoveCurrentFile');
    if (state.files.length === 0) {
        fileLabel.textContent = 'No files';
        fileLabel.title = 'No files';
        fileMeta.textContent = '0 pages';
        if (btnRemoveCurrentFile) btnRemoveCurrentFile.style.display = 'none';
    } else if (state.files.length === 1) {
        fileLabel.textContent = state.files[0].name;
        fileLabel.title = state.files[0].name;
        fileMeta.textContent = `${state.pages.length} page${state.pages.length !== 1 ? 's' : ''} • ${formatFileSize(state.files[0].size)}`;
        if (btnRemoveCurrentFile) btnRemoveCurrentFile.style.display = 'inline-flex';
    } else {
        fileLabel.textContent = `${state.files.length} PDF documents`;
        fileLabel.title = `${state.files.length} PDF documents loaded`;
        const totalSize = state.files.reduce((acc, f) => acc + (f.size || 0), 0);
        fileMeta.textContent = `${state.pages.length} total pages • ${formatFileSize(totalSize)}`;
        if (btnRemoveCurrentFile) btnRemoveCurrentFile.style.display = 'inline-flex';
    }
}

function updateToolbarState() {
    const hasSel = state.selected.size > 0;
    const hasPages = state.pages.length > 0;

    btnRotL.disabled = !hasSel;
    btnRotR.disabled = !hasSel;
    btnDuplicate.disabled = !hasSel;
    btnRemove.disabled = !hasSel;
    btnExtract.disabled = !hasSel;

    btnRotL.title = hasSel ? 'Rotate selected left (Shift+R)' : 'Select pages first to rotate';
    btnRotR.title = hasSel ? 'Rotate selected right (R)' : 'Select pages first to rotate';
    btnDuplicate.title = hasSel ? 'Duplicate selected page(s)' : 'Select pages first to duplicate';
    btnRemove.title = hasSel ? 'Remove selected pages (Delete)' : 'Select pages first to remove';
    btnExtract.title = hasSel ? 'Extract selected pages into new PDF' : 'Select pages first to extract';

    btnMerge.disabled = !hasPages;
    btnSave.disabled = !hasPages;
    if (btnPageNumbers) btnPageNumbers.disabled = !hasPages;
    if (btnWatermark) btnWatermark.disabled = !hasPages;

    btnUndo.disabled = state.undoStack.length <= 1;
    btnRedo.disabled = state.redoStack.length === 0;

    // Selection pill
    if (tbSelectionPill) {
        tbSelectionPill.textContent = `${state.selected.size} selected`;
        tbSelectionPill.style.background = hasSel ? 'rgba(108, 99, 255, 0.18)' : 'rgba(108, 99, 255, 0.08)';
        tbSelectionPill.style.borderColor = hasSel ? 'var(--pe-purple)' : 'rgba(108, 99, 255, 0.2)';
    }

    // Contextual Action Bar
    const contextualActionBar = document.getElementById('contextualActionBar');
    const cabCount = document.getElementById('cabCount');
    if (contextualActionBar) {
        if (hasSel) {
            contextualActionBar.style.display = 'flex';
            if (cabCount) cabCount.textContent = `${state.selected.size} selected`;
        } else {
            contextualActionBar.style.display = 'none';
        }
    }

    updateSaveBarInfo();
    updateCompanionPanel();
}

function updateCompanionPanel() {
    const pageCompanionPanel = document.getElementById('pageCompanionPanel');
    const pagesSection = document.getElementById('pagesSection');
    if (!pageCompanionPanel || !pagesSection) return;

    if (state.pages.length > 0 && state.pages.length <= 2) {
        pageCompanionPanel.style.display = 'grid';
        pagesSection.classList.add('few-pages');

        const targetIdx = state.selected.size > 0 ? Array.from(state.selected)[0] : 0;
        const pg = state.pages[targetIdx];
        if (pg) {
            const tagEl = document.getElementById('compPageTag');
            const dimEl = document.getElementById('compDimensions');
            const rotEl = document.getElementById('compRotation');
            const annotEl = document.getElementById('compAnnots');

            if (tagEl) tagEl.textContent = `Page ${targetIdx + 1} of ${state.pages.length}`;
            if (dimEl) dimEl.textContent = pg.isBlank ? `${pg.blankWidth || 595} × ${pg.blankHeight || 842} pt` : 'A4 (595 × 842 pt)';
            if (rotEl) rotEl.textContent = `${pg.rotation || 0}°`;
            const annCount = (pg.annotations || []).length;
            if (annotEl) annotEl.textContent = `${annCount} edit${annCount !== 1 ? 's' : ''}`;
        }
    } else {
        pageCompanionPanel.style.display = 'none';
        pagesSection.classList.remove('few-pages');
    }
}

function updateSaveBarInfo() {
    if (!saveBarInfo) return;
    const total = state.pages.length;
    const sel = state.selected.size;
    saveBarInfo.innerHTML = sel > 0
        ? `<strong>${sel}</strong> of ${total} page${total !== 1 ? 's' : ''} selected`
        : `<strong>${total}</strong> page${total !== 1 ? 's' : ''} total • Click a page to edit it`;
}

function showError(msg) {
    errorBanner.classList.add('visible');
    errorMsg.textContent = msg;
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearError() {
    errorBanner.classList.remove('visible');
    errorMsg.textContent = '';
}

let toastTimer;
function showToast(msg) {
    if (!peToast) return;
    peToast.innerHTML = `<i class="fas fa-circle-check" style="color:var(--pe-purple);"></i> <span>${msg}</span>`;
    peToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => peToast.classList.remove('show'), 2600);
}

function showConfirm(title, body, onConfirm) {
    confirmMsg.innerHTML = `<strong style="font-size:16px;">${title}</strong><br><span style="font-size:13.5px;color:var(--pe-text-secondary);margin-top:4px;display:inline-block;">${body}</span>`;
    confirmModal.classList.add('open');
    btnConfirmOk.onclick = () => {
        confirmModal.classList.remove('open');
        onConfirm();
    };
    btnConfirmCancel.onclick = () => confirmModal.classList.remove('open');
}


/* ═══════════════════════════════════════════════════════════════════════════
   BATCH B: SIGNATURE MODAL
═══════════════════════════════════════════════════════════════════════════ */
let sigColor = '#000000';
let savedSignatures = [];
let sigCtx = null;
let sigIsDrawing = false;
let sigLastX = 0, sigLastY = 0;

function openSignatureModal() {
    signatureModal.classList.add('open');
    initSigCanvas();
    renderSavedSigs();
}

function initSigCanvas() {
    if (!sigCanvas) return;
    sigCtx = sigCanvas.getContext('2d');
    sigCanvas.width = sigCanvas.offsetWidth || 440;
    sigCanvas.height = sigCanvas.offsetHeight || 180;
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    sigCtx.strokeStyle = sigColor;
    sigCtx.lineWidth = 2.5;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
}

// Signature canvas draw events (mouse)
sigCanvas.addEventListener('mousedown', e => {
    sigIsDrawing = true;
    const r = sigCanvas.getBoundingClientRect();
    sigLastX = e.clientX - r.left;
    sigLastY = e.clientY - r.top;
    if (!sigCtx) initSigCanvas();
    sigCtx.beginPath();
    sigCtx.moveTo(sigLastX, sigLastY);
});
sigCanvas.addEventListener('mousemove', e => {
    if (!sigIsDrawing) return;
    const r = sigCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    sigCtx.strokeStyle = sigColor;
    sigCtx.lineWidth = 2.5;
    sigCtx.lineTo(x, y);
    sigCtx.stroke();
    sigLastX = x; sigLastY = y;
});
sigCanvas.addEventListener('mouseup',    () => { sigIsDrawing = false; });
sigCanvas.addEventListener('mouseleave', () => { sigIsDrawing = false; });

// Touch support
sigCanvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    const r = sigCanvas.getBoundingClientRect();
    sigIsDrawing = true;
    sigLastX = t.clientX - r.left;
    sigLastY = t.clientY - r.top;
    if (!sigCtx) initSigCanvas();
    sigCtx.beginPath();
    sigCtx.moveTo(sigLastX, sigLastY);
}, { passive: false });
sigCanvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!sigIsDrawing) return;
    const t = e.touches[0];
    const r = sigCanvas.getBoundingClientRect();
    const x = t.clientX - r.left;
    const y = t.clientY - r.top;
    sigCtx.strokeStyle = sigColor;
    sigCtx.lineTo(x, y);
    sigCtx.stroke();
    sigLastX = x; sigLastY = y;
}, { passive: false });
sigCanvas.addEventListener('touchend', e => { e.preventDefault(); sigIsDrawing = false; }, { passive: false });

btnClearSig.addEventListener('click', () => {
    if (sigCtx) sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
});

// Ink color selection
document.querySelectorAll('.sig-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sig-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sigColor = btn.dataset.color;
        if (sigCtx) sigCtx.strokeStyle = sigColor;
    });
});

// Type signature preview
if (sigTextInput) {
    sigTextInput.addEventListener('input', () => {
        if (sigTypedPreview) {
            sigTypedPreview.textContent = sigTextInput.value || 'Your Signature';
        }
    });
}
if (sigFontSelect) {
    sigFontSelect.addEventListener('change', () => {
        if (sigTypedPreview) {
            sigTypedPreview.style.fontFamily = sigFontSelect.value;
        }
    });
}

// Tab switching in sig modal
sigTabBtnDraw.addEventListener('click', () => {
    sigTabBtnDraw.classList.add('active');
    sigTabBtnType.classList.remove('active');
    sigViewDraw.style.display = 'block';
    sigViewType.style.display = 'none';
    setTimeout(initSigCanvas, 50);
});
sigTabBtnType.addEventListener('click', () => {
    sigTabBtnType.classList.add('active');
    sigTabBtnDraw.classList.remove('active');
    sigViewType.style.display = 'block';
    sigViewDraw.style.display = 'none';
});

btnCloseSig.addEventListener('click',   () => signatureModal.classList.remove('open'));
btnCancelSig.addEventListener('click',  () => signatureModal.classList.remove('open'));
signatureModal.addEventListener('click', e => {
    if (e.target === signatureModal) signatureModal.classList.remove('open');
});

btnApplySig.addEventListener('click', () => {
    let imgData = null;

    const isDrawMode = sigViewDraw.style.display !== 'none';
    if (isDrawMode) {
        if (!sigCtx) { showToast('Please draw your signature first.'); return; }
        const imgPixels = sigCtx.getImageData(0, 0, sigCanvas.width, sigCanvas.height);
        const hasContent = Array.from(imgPixels.data).some((v, i) => i % 4 === 3 && v > 0);
        if (!hasContent) { showToast('Please draw your signature first.'); return; }
        imgData = sigCanvas.toDataURL('image/png');
    } else {
        const text = sigTextInput ? sigTextInput.value.trim() : '';
        if (!text) { showToast('Please type your name first.'); return; }
        const font = sigFontSelect ? sigFontSelect.value : "'Dancing Script', cursive";
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 400; offCanvas.height = 120;
        const octx = offCanvas.getContext('2d');
        octx.clearRect(0, 0, 400, 120);
        octx.font = `56px ${font}`;
        octx.fillStyle = sigColor;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillText(text, 200, 60);
        imgData = offCanvas.toDataURL('image/png');
    }

    if (!imgData) return;

    if (sigSaveCheck && sigSaveCheck.checked) {
        savedSignatures.push({ imgData, label: 'Sig ' + (savedSignatures.length + 1) });
        renderSavedSigs();
    }

    // Place on target page
    const targetIdx = (typeof pageEditorModal !== 'undefined' && pageEditorModal.classList.contains('open'))
        ? peState.pageIdx
        : (state.selected.size > 0 ? [...state.selected][0] : 0);
    const pg = state.pages[targetIdx];
    if (!pg) { showToast('No page to place signature on.'); signatureModal.classList.remove('open'); return; }
    if (!pg.annotations) pg.annotations = [];
    pg.annotations.push({
        type: 'image', imgData,
        xPct: 0.1, yPct: 0.5, widthPct: 0.4, heightPct: 0.15
    });

    signatureModal.classList.remove('open');
    if (typeof pageEditorModal !== 'undefined' && pageEditorModal.classList.contains('open')) {
        if (typeof redrawAnnotations === 'function') redrawAnnotations();
        if (typeof updatePeAnnotList === 'function') updatePeAnnotList();
    }
    if (typeof renderThumb === 'function') renderThumb(targetIdx);
    showToast('Signature placed! Open page editor to reposition it.');
});

function renderSavedSigs() {
    if (!savedSigsList) return;
    if (savedSignatures.length === 0) {
        if (savedSigsSection) savedSigsSection.style.display = 'none';
        return;
    }
    if (savedSigsSection) savedSigsSection.style.display = 'block';
    savedSigsList.innerHTML = '';
    savedSignatures.forEach((sig) => {
        const chip = document.createElement('div');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid rgba(108,99,255,0.3);border-radius:30px;cursor:pointer;background:rgba(108,99,255,0.07);margin:4px;';
        const img = document.createElement('img');
        img.src = sig.imgData;
        img.style.cssText = 'height:28px;width:auto;border-radius:4px;background:#fff;';
        chip.appendChild(img);
        chip.addEventListener('click', () => {
            const targetIdx = (typeof pageEditorModal !== 'undefined' && pageEditorModal.classList.contains('open'))
                ? peState.pageIdx
                : (state.selected.size > 0 ? [...state.selected][0] : 0);
            const pg = state.pages[targetIdx];
            if (!pg) return;
            if (!pg.annotations) pg.annotations = [];
            pg.annotations.push({ type: 'image', imgData: sig.imgData, xPct: 0.1, yPct: 0.5, widthPct: 0.4, heightPct: 0.15 });
            signatureModal.classList.remove('open');
            if (typeof pageEditorModal !== 'undefined' && pageEditorModal.classList.contains('open')) {
                if (typeof redrawAnnotations === 'function') redrawAnnotations();
                if (typeof updatePeAnnotList === 'function') updatePeAnnotList();
            }
            if (typeof renderThumb === 'function') renderThumb(targetIdx);
            showToast('Saved signature placed!');
        });
        savedSigsList.appendChild(chip);
    });
}

// Image upload in page editor
if (peImageUploadInput) {
    peImageUploadInput.addEventListener('change', async () => {
        const file = peImageUploadInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            const imgData = e.target.result;
            const pg = state.pages[peState.pageIdx];
            if (!pg) return;
            if (!pg.annotations) pg.annotations = [];
            if (typeof pushPeUndo === 'function') pushPeUndo();
            pg.annotations.push({ type: 'image', imgData, xPct: 0.1, yPct: 0.1, widthPct: 0.5, heightPct: 0.4 });
            if (typeof redrawAnnotations === 'function') redrawAnnotations();
            if (typeof updatePeAnnotList === 'function') updatePeAnnotList();
            showToast('Image added to page');
        };
        reader.readAsDataURL(file);
        peImageUploadInput.value = '';
        if (typeof setActiveTool === 'function') setActiveTool('select');
    });
}

// Stroke width label
if (peStrokeWidth && peStrokeWidthVal) {
    peStrokeWidth.addEventListener('input', () => {
        peStrokeWidthVal.textContent = `${peStrokeWidth.value}px`;
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH B: BATCH CROP MODAL
═══════════════════════════════════════════════════════════════════════════ */
btnCropModal.addEventListener('click', () => {
    if (state.pages.length === 0) { showToast('Load a PDF first.'); return; }
    cropModal.classList.add('open');
});
btnCloseCropModal.addEventListener('click',  () => cropModal.classList.remove('open'));
btnCancelCropModal.addEventListener('click', () => cropModal.classList.remove('open'));
cropModal.addEventListener('click', e => { if (e.target === cropModal) cropModal.classList.remove('open'); });

btnApplyCropModal.addEventListener('click', () => {
    const top    = parseFloat(cropTop.value)    || 0;
    const bottom = parseFloat(cropBottom.value) || 0;
    const left   = parseFloat(cropLeft.value)   || 0;
    const right  = parseFloat(cropRight.value)  || 0;

    const scopeRadio = document.querySelector('input[name="cropScope"]:checked');
    const scope = scopeRadio ? scopeRadio.value : 'selected';
    const targetIndices = (scope === 'selected' && state.selected.size > 0)
        ? Array.from(state.selected)
        : state.pages.map((_, i) => i);

    pushUndo('Batch Crop Pages');
    targetIndices.forEach(pi => {
        const pg = state.pages[pi];
        pg.batchCrop = { top, bottom, left, right };
    });

    cropModal.classList.remove('open');
    renderGrid();
    showToast(`Crop applied to ${targetIndices.length} page(s). Effect on download.`);
});

btnResetCropModal.addEventListener('click', () => {
    pushUndo('Reset Crop');
    state.pages.forEach(pg => { delete pg.batchCrop; });
    cropModal.classList.remove('open');
    renderGrid();
    showToast('Crop reset on all pages.');
});

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH B: RESIZE PAGES MODAL
═══════════════════════════════════════════════════════════════════════════ */
btnResizeModal.addEventListener('click', () => {
    if (state.pages.length === 0) { showToast('Load a PDF first.'); return; }
    resizeModal.classList.add('open');
});
btnCloseResizeModal.addEventListener('click',  () => resizeModal.classList.remove('open'));
btnCancelResizeModal.addEventListener('click', () => resizeModal.classList.remove('open'));
resizeModal.addEventListener('click', e => { if (e.target === resizeModal) resizeModal.classList.remove('open'); });

btnApplyResizeModal.addEventListener('click', () => {
    const sizeKey     = rsPageSize.value;
    const isLandscape = rsOrientation.value === 'landscape';
    const margin      = parseInt(rsMarginPreset.value) || 0;
    const scaleContent = rsScaleContent.checked;

    const PAGE_SIZES = {
        a4:     [595.28, 841.89],
        letter: [612, 792],
        legal:  [612, 1008],
        a3:     [841.89, 1190.55],
        a5:     [419.53, 595.28],
    };
    let [w, h] = PAGE_SIZES[sizeKey] || PAGE_SIZES.a4;
    if (isLandscape) { const tmp = w; w = h; h = tmp; }

    const scopeRadio = document.querySelector('input[name="rsScope"]:checked');
    const scope = scopeRadio ? scopeRadio.value : 'all';
    const targetIndices = (scope === 'selected' && state.selected.size > 0)
        ? Array.from(state.selected)
        : state.pages.map((_, i) => i);

    pushUndo('Resize Pages');
    targetIndices.forEach(pi => {
        state.pages[pi].resize = { width: w, height: h, margin, scaleContent };
    });

    resizeModal.classList.remove('open');
    renderGrid();
    showToast(`Page size applied to ${targetIndices.length} page(s). Effect on download.`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH C: DOM REFS for new elements
═══════════════════════════════════════════════════════════════════════════ */
const btnConvertModal      = document.getElementById('btnConvertModal');
const convertModal         = document.getElementById('convertModal');
const btnCloseConvertModal = document.getElementById('btnCloseConvertModal');
const convTabPdfToImg      = document.getElementById('convTabPdfToImg');
const convTabImgToPdf      = document.getElementById('convTabImgToPdf');
const convSectionPdfToImg  = document.getElementById('convSectionPdfToImg');
const convSectionImgToPdf  = document.getElementById('convSectionImgToPdf');
const convPdfScale         = document.getElementById('convPdfScale');
const btnConvertPdfToImg   = document.getElementById('btnConvertPdfToImg');
const btnCancelConvPdfToImg= document.getElementById('btnCancelConvPdfToImg');
const convImgInput         = document.getElementById('convImgInput');
const convImgList          = document.getElementById('convImgList');
const convImgPageSize      = document.getElementById('convImgPageSize');
const btnConvertImgToPdf   = document.getElementById('btnConvertImgToPdf');
const btnCancelConvImgToPdf= document.getElementById('btnCancelConvImgToPdf');

const btnAdvSplitModal     = document.getElementById('btnAdvSplitModal');
const advSplitModal        = document.getElementById('advSplitModal');
const btnCloseAdvSplitModal= document.getElementById('btnCloseAdvSplitModal');
const btnCancelAdvSplitModal= document.getElementById('btnCancelAdvSplitModal');
const btnApplyAdvSplitModal= document.getElementById('btnApplyAdvSplitModal');
const advSplitN            = document.getElementById('advSplitN');
const advSplitRanges       = document.getElementById('advSplitRanges');
const advSplitEveryNRow    = document.getElementById('advSplitEveryNRow');
const advSplitRangesRow    = document.getElementById('advSplitRangesRow');

const btnPasswordModal     = document.getElementById('btnPasswordModal');
const passwordModal        = document.getElementById('passwordModal');
const btnClosePasswordModal= document.getElementById('btnClosePasswordModal');
const btnCancelPasswordModal= document.getElementById('btnCancelPasswordModal');
const btnApplyPasswordModal= document.getElementById('btnApplyPasswordModal');
const pdfUserPassword      = document.getElementById('pdfUserPassword');
const pdfOwnerPassword     = document.getElementById('pdfOwnerPassword');
const pdfAllowPrint        = document.getElementById('pdfAllowPrint');
const pdfAllowCopy         = document.getElementById('pdfAllowCopy');

const btnExtractTextModal       = document.getElementById('btnExtractTextModal');
const extractTextModal          = document.getElementById('extractTextModal');
const btnCloseExtractTextModal  = document.getElementById('btnCloseExtractTextModal');
const btnCloseExtractTextModalBottom = document.getElementById('btnCloseExtractTextModalBottom');
const btnRunExtractText         = document.getElementById('btnRunExtractText');
const btnCopyExtractedText      = document.getElementById('btnCopyExtractedText');
const btnDownloadExtractedText  = document.getElementById('btnDownloadExtractedText');
const extractedTextArea         = document.getElementById('extractedTextArea');

// Batch D
const renameModal              = document.getElementById('renameModal');
const btnCloseRenameModal      = document.getElementById('btnCloseRenameModal');
const btnCancelRenameModal     = document.getElementById('btnCancelRenameModal');
const btnConfirmRenameModal    = document.getElementById('btnConfirmRenameModal');
const renameInput              = document.getElementById('renameInput');
const sessionRestoreBanner     = document.getElementById('sessionRestoreBanner');
const btnRestoreSession        = document.getElementById('btnRestoreSession');
const btnDismissRestore        = document.getElementById('btnDismissRestore');

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH C: CONVERT MODAL — PDF → Images
═══════════════════════════════════════════════════════════════════════════ */
if (btnConvertModal) {
    btnConvertModal.addEventListener('click', () => {
        if (state.pages.length === 0) { showToast('Load a PDF first.'); return; }
        convertModal.classList.add('open');
    });
}
if (btnCloseConvertModal) btnCloseConvertModal.addEventListener('click', () => convertModal.classList.remove('open'));
convertModal && convertModal.addEventListener('click', e => { if (e.target === convertModal) convertModal.classList.remove('open'); });
if (btnCancelConvPdfToImg) btnCancelConvPdfToImg.addEventListener('click', () => convertModal.classList.remove('open'));
if (btnCancelConvImgToPdf) btnCancelConvImgToPdf.addEventListener('click', () => convertModal.classList.remove('open'));

// Tab switch for convert modal
if (convTabPdfToImg) convTabPdfToImg.addEventListener('click', () => {
    convTabPdfToImg.classList.add('active');
    convTabImgToPdf.classList.remove('active');
    convSectionPdfToImg.style.display = '';
    convSectionImgToPdf.style.display = 'none';
});
if (convTabImgToPdf) convTabImgToPdf.addEventListener('click', () => {
    convTabImgToPdf.classList.add('active');
    convTabPdfToImg.classList.remove('active');
    convSectionImgToPdf.style.display = '';
    convSectionPdfToImg.style.display = 'none';
});

// Images list preview
if (convImgInput) {
    convImgInput.addEventListener('change', () => {
        const files = Array.from(convImgInput.files);
        if (convImgList) {
            convImgList.textContent = files.length ? `${files.length} image(s) selected: ${files.map(f => f.name).join(', ')}` : '';
        }
    });
}

// PDF → Images (ZIP of PNGs)
if (btnConvertPdfToImg) {
    btnConvertPdfToImg.addEventListener('click', async () => {
        if (state.pages.length === 0) { showToast('No pages loaded.'); return; }
        const scale = parseFloat(convPdfScale.value) || 2;
        const scopeRadio = document.querySelector('input[name="convPdfScope"]:checked');
        const scope = scopeRadio ? scopeRadio.value : 'all';
        const indices = (scope === 'selected' && state.selected.size > 0)
            ? Array.from(state.selected)
            : state.pages.map((_, i) => i);

        showProgress('Rendering pages to images…');
        try {
            const zip = new JSZip();
            for (let i = 0; i < indices.length; i++) {
                const pi = indices[i];
                const pg = state.pages[pi];
                progressMsg.textContent = `Rendering page ${i + 1} of ${indices.length}…`;

                // Get the pdfjs doc
                const pjsDoc = state.pdfJsDocs[pg.pdfIndex];
                if (!pjsDoc) continue;
                const page = await pjsDoc.getPage(pg.pageIndex + 1);
                const viewport = page.getViewport({ scale, rotation: pg.rotation || 0 });
                const canvas = document.createElement('canvas');
                canvas.width  = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;
                const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
                const arrayBuf = await blob.arrayBuffer();
                zip.file(`page_${String(i + 1).padStart(3, '0')}.png`, arrayBuf);
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            hideProgress();
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shrinknest_pages_${Date.now()}.zip`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            convertModal.classList.remove('open');
            showToast(`Exported ${indices.length} page(s) as PNG ZIP!`);
        } catch (err) {
            hideProgress();
            showError('Failed to convert pages to images: ' + err.message);
        }
    });
}

// Images → PDF
if (btnConvertImgToPdf) {
    btnConvertImgToPdf.addEventListener('click', async () => {
        if (!convImgInput || !convImgInput.files.length) {
            showToast('Please select at least one image.');
            return;
        }
        const files  = Array.from(convImgInput.files);
        const pgSize = convImgPageSize ? convImgPageSize.value : 'fit';

        showProgress('Creating PDF from images…');
        try {
            const { PDFDocument: PDFDoc, PageSizes } = PDFLib;
            const pdfDoc = await PDFDoc.create();

            for (let i = 0; i < files.length; i++) {
                progressMsg.textContent = `Processing image ${i + 1} of ${files.length}…`;
                const file = files[i];
                const arrayBuf = await file.arrayBuffer();
                const uint8    = new Uint8Array(arrayBuf);

                let embImg;
                try {
                    if (file.type === 'image/png') {
                        embImg = await pdfDoc.embedPng(uint8);
                    } else {
                        embImg = await pdfDoc.embedJpg(uint8);
                    }
                } catch (imgErr) {
                    console.warn('Could not embed image:', file.name, imgErr);
                    continue;
                }

                let pw, ph;
                if (pgSize === 'a4')     { pw = 595.28; ph = 841.89; }
                else if (pgSize === 'letter') { pw = 612;  ph = 792; }
                else { pw = embImg.width; ph = embImg.height; }

                const page = pdfDoc.addPage([pw, ph]);
                const scale = Math.min(pw / embImg.width, ph / embImg.height);
                const dw = embImg.width  * scale;
                const dh = embImg.height * scale;
                page.drawImage(embImg, {
                    x: (pw - dw) / 2,
                    y: (ph - dh) / 2,
                    width: dw, height: dh,
                });
            }

            const bytes   = await pdfDoc.save();
            const blob    = new Blob([bytes], { type: 'application/pdf' });
            hideProgress();
            const url     = URL.createObjectURL(blob);
            const a       = document.createElement('a');
            a.href        = url;
            a.download    = `shrinknest_from_images_${Date.now()}.pdf`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            convertModal.classList.remove('open');
            showToast(`PDF created from ${files.length} image(s)!`);
        } catch(err) {
            hideProgress();
            showError('Failed to create PDF from images: ' + err.message);
        }
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH C: ADVANCED SPLIT MODAL
═══════════════════════════════════════════════════════════════════════════ */
if (btnAdvSplitModal) {
    btnAdvSplitModal.addEventListener('click', () => {
        if (state.pages.length === 0) { showToast('Load a PDF first.'); return; }
        advSplitModal.classList.add('open');
    });
}
if (btnCloseAdvSplitModal) btnCloseAdvSplitModal.addEventListener('click', () => advSplitModal.classList.remove('open'));
if (btnCancelAdvSplitModal) btnCancelAdvSplitModal.addEventListener('click', () => advSplitModal.classList.remove('open'));
advSplitModal && advSplitModal.addEventListener('click', e => { if (e.target === advSplitModal) advSplitModal.classList.remove('open'); });

// Show/hide rows based on mode
document.querySelectorAll('input[name="advSplitMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const mode = radio.value;
        if (advSplitEveryNRow) advSplitEveryNRow.style.display = (mode === 'everyN') ? '' : 'none';
        if (advSplitRangesRow) advSplitRangesRow.style.display = (mode === 'ranges') ? '' : 'none';
    });
});

if (btnApplyAdvSplitModal) {
    btnApplyAdvSplitModal.addEventListener('click', async () => {
        const modeRadio = document.querySelector('input[name="advSplitMode"]:checked');
        const mode = modeRadio ? modeRadio.value : 'everyN';
        const total = state.pages.length;

        let chunks = []; // array of arrays of page indices

        if (mode === 'burst') {
            chunks = state.pages.map((_, i) => [i]);
        } else if (mode === 'everyN') {
            const n = parseInt(advSplitN ? advSplitN.value : 1) || 1;
            for (let i = 0; i < total; i += n) {
                chunks.push(Array.from({ length: Math.min(n, total - i) }, (_, j) => i + j));
            }
        } else if (mode === 'ranges') {
            const rangesStr = advSplitRanges ? advSplitRanges.value : '';
            const parts = rangesStr.split(',').map(s => s.trim()).filter(Boolean);
            parts.forEach(part => {
                const [a, b] = part.split('-').map(s => parseInt(s.trim()) - 1);
                const end = isNaN(b) ? a : b;
                const chunk = [];
                for (let i = a; i <= Math.min(end, total - 1); i++) chunk.push(i);
                if (chunk.length > 0) chunks.push(chunk);
            });
        }

        if (chunks.length === 0) { showToast('No chunks to split.'); return; }

        showProgress(`Splitting into ${chunks.length} PDF(s)…`);
        advSplitModal.classList.remove('open');
        try {
            const blobs = [];
            for (let ci = 0; ci < chunks.length; ci++) {
                progressMsg.textContent = `Building part ${ci + 1} of ${chunks.length}…`;
                const blob = await buildBlob(chunks[ci]);
                if (blob) blobs.push({ blob, name: `shrinknest_part${ci + 1}_${Date.now()}.pdf` });
            }
            hideProgress();
            state.resultBlobs = blobs;
            if (typeof showResultMultiple === 'function') {
                showResultMultiple(blobs);
            } else {
                blobs.forEach(({ blob, name }) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = name; a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                });
            }
            showToast(`Split into ${blobs.length} PDF(s)!`);
        } catch(err) {
            hideProgress();
            showError('Split failed: ' + err.message);
        }
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH C: PASSWORD MODAL
═══════════════════════════════════════════════════════════════════════════ */
if (btnPasswordModal) {
    btnPasswordModal.addEventListener('click', () => {
        if (state.pages.length === 0) { showToast('Load a PDF first.'); return; }
        passwordModal.classList.add('open');
    });
}
if (btnClosePasswordModal) btnClosePasswordModal.addEventListener('click', () => passwordModal.classList.remove('open'));
if (btnCancelPasswordModal) btnCancelPasswordModal.addEventListener('click', () => passwordModal.classList.remove('open'));
passwordModal && passwordModal.addEventListener('click', e => { if (e.target === passwordModal) passwordModal.classList.remove('open'); });

if (btnApplyPasswordModal) {
    btnApplyPasswordModal.addEventListener('click', async () => {
        const userPw  = pdfUserPassword  ? pdfUserPassword.value  : '';
        const ownerPw = pdfOwnerPassword ? pdfOwnerPassword.value : '';
        if (!userPw && !ownerPw) {
            showToast('Please enter at least one password.');
            return;
        }
        showProgress('Generating password-protected PDF…');
        passwordModal.classList.remove('open');
        try {
            const blob = await buildBlob(state.pages.map((_, i) => i));
            if (!blob) { hideProgress(); return; }
            // pdf-lib 1.17 supports encryption via save options
            const arrBuf = await blob.arrayBuffer();
            const { PDFDocument: PDFDoc } = PDFLib;
            const pdfDoc = await PDFDoc.load(arrBuf);
            const allowPrint = pdfAllowPrint ? pdfAllowPrint.checked : true;
            const allowCopy  = pdfAllowCopy  ? pdfAllowCopy.checked  : true;

            const encOptions = {
                userPassword:  userPw  || undefined,
                ownerPassword: ownerPw || undefined,
                permissions: {
                    printing:  allowPrint ? 'highResolution' : 'notAllowed',
                    modifying: false,
                    copying:   allowCopy,
                    annotating: false,
                    fillingForms: false,
                    contentAccessibility: allowCopy,
                    documentAssembly: false,
                },
            };

            let protectedBytes;
            try {
                protectedBytes = await pdfDoc.save(encOptions);
            } catch(encErr) {
                // Fallback: pdf-lib encryption may not be available, just download unencrypted
                console.warn('Encryption not supported in this pdf-lib version:', encErr);
                protectedBytes = await pdfDoc.save();
                showToast('Note: encryption not available in this build. Downloading unencrypted.');
            }

            const protectedBlob = new Blob([protectedBytes], { type: 'application/pdf' });
            hideProgress();
            const name = `shrinknest_protected_${Date.now()}.pdf`;
            state.resultBlobs = [{ blob: protectedBlob, name }];
            if (typeof showResultSingle === 'function') {
                showResultSingle(protectedBlob, name);
            } else {
                const url = URL.createObjectURL(protectedBlob);
                const a = document.createElement('a');
                a.href = url; a.download = name; a.click();
                setTimeout(() => URL.revokeObjectURL(url), 5000);
            }
            showToast('Password-protected PDF ready!');
        } catch(err) {
            hideProgress();
            showError('Password protect failed: ' + err.message);
        }
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH C: EXTRACT TEXT MODAL
═══════════════════════════════════════════════════════════════════════════ */
if (btnExtractTextModal) {
    btnExtractTextModal.addEventListener('click', () => {
        if (state.pages.length === 0) { showToast('Load a PDF first.'); return; }
        extractTextModal.classList.add('open');
    });
}
if (btnCloseExtractTextModal) btnCloseExtractTextModal.addEventListener('click', () => extractTextModal.classList.remove('open'));
if (btnCloseExtractTextModalBottom) btnCloseExtractTextModalBottom.addEventListener('click', () => extractTextModal.classList.remove('open'));
extractTextModal && extractTextModal.addEventListener('click', e => { if (e.target === extractTextModal) extractTextModal.classList.remove('open'); });

if (btnRunExtractText) {
    btnRunExtractText.addEventListener('click', async () => {
        if (state.pages.length === 0) { showToast('Load a PDF first.'); return; }
        const scopeRadio = document.querySelector('input[name="extractTextScope"]:checked');
        const scope = scopeRadio ? scopeRadio.value : 'all';
        const indices = (scope === 'selected' && state.selected.size > 0)
            ? Array.from(state.selected)
            : state.pages.map((_, i) => i);

        if (extractedTextArea) {
            extractedTextArea.value = 'Extracting text…';
            if (btnCopyExtractedText) btnCopyExtractedText.disabled = true;
            if (btnDownloadExtractedText) btnDownloadExtractedText.disabled = true;
        }

        try {
            let allText = '';
            for (let ii = 0; ii < indices.length; ii++) {
                const pi  = indices[ii];
                const pg  = state.pages[pi];
                const pjsDoc = state.pdfJsDocs[pg.pdfIndex];
                if (!pjsDoc) { allText += `[Page ${pi + 1}: no document]\n`; continue; }
                const page       = await pjsDoc.getPage(pg.pageIndex + 1);
                const textContent = await page.getTextContent();
                const pageText   = textContent.items.map(item => item.str).join(' ');
                allText += `── Page ${pi + 1} ──\n${pageText}\n\n`;
            }
            if (extractedTextArea) {
                extractedTextArea.value = allText.trim() || '(No text found)';
                if (btnCopyExtractedText) btnCopyExtractedText.disabled = false;
                if (btnDownloadExtractedText) btnDownloadExtractedText.disabled = false;
            }
        } catch(err) {
            if (extractedTextArea) extractedTextArea.value = 'Error: ' + err.message;
        }
    });
}

if (btnCopyExtractedText) {
    btnCopyExtractedText.addEventListener('click', () => {
        if (extractedTextArea && extractedTextArea.value) {
            navigator.clipboard.writeText(extractedTextArea.value).then(() => {
                showToast('Text copied to clipboard!');
            }).catch(() => {
                extractedTextArea.select();
                document.execCommand('copy');
                showToast('Text copied!');
            });
        }
    });
}

if (btnDownloadExtractedText) {
    btnDownloadExtractedText.addEventListener('click', () => {
        if (!extractedTextArea || !extractedTextArea.value) return;
        const blob = new Blob([extractedTextArea.value], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `shrinknest_text_${Date.now()}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH D: RENAME BEFORE DOWNLOAD MODAL
═══════════════════════════════════════════════════════════════════════════ */
// Wire the Save & Download button to rename modal first
(function wireRenameModal() {
    if (!btnSave) return;
    // We intercept the save button click and show the rename modal
    // The existing listener calls buildAndDownload; we want to show rename first.
    // We add a *capture* listener to intercept before the existing one.
    const originalClick = btnSave.onclick;
    // Replace with rename-first flow
    btnSave._renameFlow = true;
    if (renameModal && renameInput) {
        // Open rename modal on save click
        btnSave.addEventListener('click', (e) => {
            if (state.pages.length === 0) return;
            if (btnSave._renameFlow) {
                e.stopImmediatePropagation();
                // Set default name
                const firstName = state.files && state.files.length > 0
                    ? state.files[0].name.replace(/\.pdf$/i, '')
                    : 'document';
                renameInput.value = firstName + '_edited';
                renameModal.classList.add('open');
            }
        }, true /* capture = runs before other listeners */);
    }
})();

if (btnCloseRenameModal) btnCloseRenameModal.addEventListener('click', () => renameModal.classList.remove('open'));
if (btnCancelRenameModal) btnCancelRenameModal.addEventListener('click', () => renameModal.classList.remove('open'));
renameModal && renameModal.addEventListener('click', e => { if (e.target === renameModal) renameModal.classList.remove('open'); });

if (btnConfirmRenameModal) {
    btnConfirmRenameModal.addEventListener('click', async () => {
        renameModal.classList.remove('open');
        const baseName = (renameInput && renameInput.value.trim()) || 'document';
        const filename = baseName.replace(/\.pdf$/i, '') + '.pdf';
        showProgress('Generating your PDF document…');
        const blob = await buildBlob(state.pages.map((_, i) => i));
        hideProgress();
        if (!blob) return;
        state.resultBlobs = [{ blob, name: filename }];
        showResultSingle(blob, filename);
    });
}

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH D: SESSION AUTOSAVE — IndexedDB
═══════════════════════════════════════════════════════════════════════════ */
const IDB_NAME    = 'ShrinkNestEditor';
const IDB_VERSION = 1;
const IDB_STORE   = 'session';
let idb = null;

function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE, { keyPath: 'key' });
            }
        };
        req.onsuccess = e => { idb = e.target.result; resolve(idb); };
        req.onerror   = e => reject(e.target.error);
    });
}

async function idbPut(key, value) {
    if (!idb) await openIDB();
    return new Promise((resolve, reject) => {
        const tx   = idb.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put({ key, value }).onsuccess = () => resolve();
        tx.onerror = e => reject(e.target.error);
    });
}

async function idbGet(key) {
    if (!idb) await openIDB();
    return new Promise((resolve, reject) => {
        const tx    = idb.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req   = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror   = e => reject(e.target.error);
    });
}

async function idbDelete(key) {
    if (!idb) await openIDB();
    return new Promise((resolve) => {
        const tx   = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = () => resolve();
    });
}

// Autosave: serialize lightweight session state (page metadata, not PDF bytes)
async function autosaveSession() {
    try {
        if (state.pages.length === 0) return;
        const sessionData = {
            savedAt: Date.now(),
            fileNames: state.fileNames,
            pageCount: state.pages.length,
            // Store lightweight page metadata (not raw PDF bytes)
            pageMeta: state.pages.map(pg => ({
                id: pg.id,
                pdfIndex: pg.pdfIndex,
                pageIndex: pg.pageIndex,
                rotation: pg.rotation,
                isBlank: pg.isBlank,
                blankWidth: pg.blankWidth,
                blankHeight: pg.blankHeight,
                batchCrop: pg.batchCrop,
                resize: pg.resize,
                annotations: (pg.annotations || []).filter(a => a.type !== 'pen'), // skip large pen data
            }))
        };
        await idbPut('lastSession', sessionData);
    } catch(e) {
        console.warn('Autosave failed:', e);
    }
}

// Check for existing session on load
(async function checkForSession() {
    try {
        await openIDB();
        const session = await idbGet('lastSession');
        if (session && session.pageCount > 0 && sessionRestoreBanner) {
            const ageMin = Math.round((Date.now() - session.savedAt) / 60000);
            sessionRestoreBanner.style.display = 'flex';
            const strong = sessionRestoreBanner.querySelector('strong');
            if (strong) strong.textContent = `Restore previous session? (${session.pageCount} pages, ${ageMin}m ago)`;
        }
    } catch(e) { /* no IDB, ignore */ }
})();

if (btnRestoreSession) {
    btnRestoreSession.addEventListener('click', async () => {
        if (sessionRestoreBanner) sessionRestoreBanner.style.display = 'none';
        try {
            const session = await idbGet('lastSession');
            if (!session) { showToast('No session data found.'); return; }
            showToast(`Session info: ${session.pageCount} pages from: ${(session.fileNames || []).join(', ')}. Please reload your PDF(s) to fully restore.`);
        } catch(e) {
            showToast('Could not read session data.');
        }
    });
}

if (btnDismissRestore) {
    btnDismissRestore.addEventListener('click', async () => {
        if (sessionRestoreBanner) sessionRestoreBanner.style.display = 'none';
        await idbDelete('lastSession');
    });
}

// Autosave every 30 seconds while pages are loaded
setInterval(() => { if (state.pages.length > 0) autosaveSession(); }, 30000);

/* ═══════════════════════════════════════════════════════════════════════════
   BATCH D: COMPRESS SHORTCUT BUTTON in result panel
═══════════════════════════════════════════════════════════════════════════ */
// Hook into showResultSingle to inject a "Compress PDF" link after each result
(function patchResultPanel() {
    const _orig = typeof showResultSingle === 'function' ? showResultSingle : null;
    if (!_orig || !resultActions) return;
    // We use a MutationObserver so we don't have to modify the original function
    const observer = new MutationObserver(() => {
        if (!resultActions.querySelector('.btn-compress-shortcut')) {
            const compressBtn = document.createElement('a');
            compressBtn.href      = '../tools/pdf-compress.html';
            compressBtn.className = 'tb-btn btn-compress-shortcut';
            compressBtn.style.cssText = 'text-decoration:none;display:inline-flex;align-items:center;gap:6px;margin-top:8px;';
            compressBtn.innerHTML = '<i class="fas fa-file-zipper" style="color:#6C63FF;"></i> Compress this PDF';
            compressBtn.title     = 'Open PDF Compress tool';
            resultActions.appendChild(compressBtn);
        }
    });
    observer.observe(resultActions, { childList: true });
})();
