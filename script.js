const LS_SETTINGS_KEY = 'photoSettings';
const LS_RESULTS_KEY = 'photoResults';
let editorCanvases = [];
let originalDataURLs = [];
let currentFilter = 'none'
function getPhotoResults() {
    const results = localStorage.getItem(LS_RESULTS_KEY);
    return results ? JSON.parse(results) : [];
}

function clearLocalStorage() {
    localStorage.removeItem(LS_SETTINGS_KEY);
    localStorage.removeItem(LS_RESULTS_KEY);
    localStorage.removeItem('editIndex');
}

// --- LOGIKA UTAMA (Deteksi Halaman Kamera) ---
if (document.getElementById('camera-page')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const video = document.getElementById("video");
        const countdownOverlay = document.getElementById("countdown-overlay");
        const photoSlots = document.getElementById("photo-slots");
        const cameraControls = document.getElementById("camera-controls");
        const videoWrapper = document.getElementById("video-wrapper");

        let capturedDataURLs = [];

        const settings = JSON.parse(localStorage.getItem(LS_SETTINGS_KEY));
        if (!settings) {
            alert("Pengaturan tidak ditemukan. Kembali ke halaman awal.");
            window.location.href = 'index.html';
            return;
        }

        const { shotCount, delayTime } = settings;

        // buat slot foto
        createPhotoSlots(shotCount, photoSlots);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;

            await new Promise(resolve => {
                video.onloadedmetadata = () => resolve();
            });

            setTimeout(() => {
                startCaptureSeries(
                    shotCount,
                    delayTime,
                    video,
                    countdownOverlay,
                    photoSlots,
                    capturedDataURLs,
                    cameraControls,
                    videoWrapper
                );
            }, 8);
        } catch (error) {
            alert("Gagal mengakses kamera. Mohon periksa izin browser.");
            console.error("Camera access error:", error);
            window.location.href = 'index.html';
        }
    });
}else if (document.getElementById('editor-page')) {

    document.addEventListener('DOMContentLoaded', async () => {
        const stripContainer = document.getElementById('strip-preview-container');
        const results = getPhotoResults();

        const downloadBtn = document.getElementById("download-strip-btn");
        const backBtn = document.getElementById("back-to-results-btn");
        const bwBtn = document.getElementById('bw-filter-btn');
        const sepiaBtn = document.getElementById('sepia-filter-btn');
        const stripControls = document.getElementById('strip-style-controls');

        let isBW = false;
        let isSepia = false;

        const settings = JSON.parse(localStorage.getItem(LS_SETTINGS_KEY));
        if (settings && settings.shotCount === 6) {
            stripControls.style.display = 'block';
        } else {
            stripControls.style.display = 'none';
        }

        originalDataURLs = results;

        if (originalDataURLs.length === 0) {
            window.location.href = 'camera.html';
            return;
        }

        await loadStripCanvases(stripContainer, originalDataURLs);

        const bgPicker = document.getElementById('bgColorPicker');
        const borderPicker = document.getElementById('borderColorPicker');
        setTimeout(() => {
            const bgColor = bgPicker ? bgPicker.value : "#ff70a6";
            const borderColor = borderPicker ? borderPicker.value : "#fc0065";

            const finalCanvas = createFinalStripCanvas(isBW, isSepia, bgColor, borderColor);
            stripContainer.innerHTML = ""; 
            stripContainer.appendChild(finalCanvas); 
        }, 500);


        downloadBtn.onclick = function() {
           const bgPicker = document.getElementById('bgColorPicker');
            const borderPicker = document.getElementById('borderColorPicker');
            const bgColor = bgPicker ? bgPicker.value : "#ff70a6";
            const borderColor = borderPicker ? borderPicker.value : "#fc0065";

            const finalCanvas = createFinalStripCanvas(isBW, isSepia, bgColor, borderColor);
            const link = document.createElement('a');
            link.download = `photo_strip_${Date.now()}.png`;
            link.href = finalCanvas.toDataURL("image/png");
            link.click();
        };

        backBtn.onclick = function() {
            clearLocalStorage();
            window.location.href = 'index.html';
        };

        bwBtn.addEventListener('click', () => {
            isBW = !isBW;
            bwBtn.classList.toggle('active');

            const bgPicker = document.getElementById('bgColorPicker');
            const borderPicker = document.getElementById('borderColorPicker');

            const bgColor = bgPicker ? bgPicker.value : "#ff70a6";
            const borderColor = borderPicker ? borderPicker.value : "#fc0065";

            const finalCanvas = createFinalStripCanvas(isBW, isSepia, bgColor, borderColor);
            stripContainer.innerHTML = '';
            stripContainer.appendChild(finalCanvas);
            stripContainer.innerHTML = '';
            stripContainer.appendChild(finalCanvas);
        });

        sepiaBtn.addEventListener('click', () => {
            isSepia = !isSepia;
            sepiaBtn.classList.toggle('active');

            const bgPicker = document.getElementById('bgColorPicker');
            const borderPicker = document.getElementById('borderColorPicker');

            const bgColor = bgPicker ? bgPicker.value : "#ff70a6";
            const borderColor = borderPicker ? borderPicker.value : "#fc0065";

            const finalCanvas = createFinalStripCanvas(isBW, isSepia, bgColor, borderColor);
            stripContainer.innerHTML = '';
            stripContainer.appendChild(finalCanvas);
            stripContainer.innerHTML = '';
            stripContainer.appendChild(finalCanvas);
        });

        if (bgPicker && borderPicker) {
            const updateStripColors = () => {
                const bgColor = bgPicker.value;
                const borderColor = borderPicker.value;
                const finalCanvas = createFinalStripCanvas(isBW, isSepia, bgColor, borderColor);
                stripContainer.innerHTML = '';
                stripContainer.appendChild(finalCanvas);
            };

            bgPicker.addEventListener('input', updateStripColors);
            borderPicker.addEventListener('input', updateStripColors);
        }
    });
}



// ----------------------------------------------------------------------
// --- FUNGSI-FUNGSI HELPER (DIPERBAIKI) ---
// ----------------------------------------------------------------------

function createPhotoSlots(count, photoSlots) {
    photoSlots.innerHTML = ''; 
    
    if (count > 3) { photoSlots.style.maxWidth = '640px'; } 
    else { photoSlots.style.maxWidth = '400px'; } 

    for (let i = 0; i < count; i++) {
        const slot = document.createElement("div");
        slot.classList.add("slot-item");
        slot.id = `slot-${i}`;
        slot.textContent = `#${i + 1}`;
        photoSlots.appendChild(slot);
    }
}

const showCountdown = (value, countdownOverlay) => { 
    countdownOverlay.textContent = value; 
    countdownOverlay.style.fontSize = '150px'; 
    countdownOverlay.style.display = 'flex'; 
};

const hideCountdown = (countdownOverlay) => { 
    countdownOverlay.style.display = 'none'; 
};

const runCountdown = (delay, countdownOverlay) => {
    return new Promise(resolve => {
        let timer = delay;
        showCountdown(timer, countdownOverlay);
        const countdownInterval = setInterval(() => {
            timer--;
            if (timer > 0) {
                showCountdown(timer, countdownOverlay);
            } else {
                clearInterval(countdownInterval);
                hideCountdown(countdownOverlay);
                resolve();
            }
        }, 1000);
    });
};

function capturePhoto(slotIndex, video, capturedDataURLs) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL("image/png");

    capturedDataURLs.push(dataURL);

    const slotElement = document.getElementById(`slot-${slotIndex}`);
    if (slotElement) {
        slotElement.innerHTML = '';
        slotElement.classList.add('slot-filled');
        slotElement.style.border = '3px solid #ff70a6';

        const img = new Image();
        img.src = dataURL;
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 6px;
        `;
        slotElement.appendChild(img);

        const downloadBtn = document.createElement("a");
        downloadBtn.href = dataURL;
        downloadBtn.download = `photo_${slotIndex + 1}_${Date.now()}.png`;
        downloadBtn.textContent = '↓';
        downloadBtn.classList.add('download-btn');
        slotElement.appendChild(downloadBtn);
    }
}

// --- Proses Capture Series ---
async function startCaptureSeries(shots, delay, video, countdownOverlay, photoSlots, capturedDataURLs, cameraControls, videoWrapper) {
    for (let i = 0; i < shots; i++) {
        const slot = document.getElementById(`slot-${i}`);
        countdownOverlay.style.display = 'flex';
        countdownOverlay.textContent = `Shot ${i + 1}/${shots}`;
        countdownOverlay.style.fontSize = '80px';

        await new Promise(res => setTimeout(res, 600));
        if (slot) slot.style.border = '3px solid red';

        await runCountdown(delay, countdownOverlay);
        capturePhoto(i, video, capturedDataURLs);
        await new Promise(res => setTimeout(res, 500));
    }

    hideCountdown(countdownOverlay);
    if (video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());

    localStorage.setItem(LS_RESULTS_KEY, JSON.stringify(capturedDataURLs));

    videoWrapper.style.display = 'none';
    const oldLoader = document.querySelector('#loading-to-editor');
    if (oldLoader) oldLoader.remove();

    const loader = document.createElement('h3');
    loader.id = 'loading-to-editor';
    loader.textContent = "Mengalihkan ke Editor...";
    loader.style.textAlign = 'center';
    loader.style.marginTop = '20px';
    document.querySelector('.container').appendChild(loader);

    setTimeout(() => {
        window.location.href = 'editor.html';
    }, 8);
}


function loadStripCanvases(container, dataURLs) {
    container.innerHTML = '';
    editorCanvases = [];
    
    dataURLs.forEach((dataURL, index) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.classList.add('editor-canvas'); 
            canvas.dataset.originalSrc = dataURL;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            container.appendChild(canvas);
            editorCanvases.push(canvas);
        };
        img.src = dataURL;
    });
}

function downloadAllPhotos() {
    
    if (!editorCanvases || editorCanvases.length === 0) {
        alert("Tidak ada foto untuk diunduh.");
        return;
    }
    
    const finalCanvas = createFinalStripCanvas(isBW, isSepia, bgColor, borderColor);

    if (!finalCanvas) {
        alert("Gagal membuat strip foto final."); 
        return;
    }

    const dataURL = finalCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `photo_strip_final_${Date.now()}.png`;
    
    document.body.appendChild(a); 
    const event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
    a.dispatchEvent(event);
    document.body.removeChild(a); 
    
    alert("berhasil diunduh!");
}
function createFinalStripCanvas(isBW = false, isSepia = false, bgColor = "#ff70a6", borderColor = "#fc0065") {
    const NUM_PHOTOS = editorCanvases.length;

    if (NUM_PHOTOS === 1) {
    const PHOTO_W = 1000;
    const PHOTO_H = 800;

    const BOX_PADDING_TOP = 40;
    const BOX_PADDING_LEFT = 40;
    const BOX_PADDING_RIGHT = 40;
    const BOX_PADDING_BOTTOM = 50;

    const TEXT_PADDING_LEFT = 20; // jarak teks dari tepi kiri kotak
    const TEXT_PADDING_TOP = 150;  // jarak teks dari atas foto

    const HEADLINE_FONT = "bold 60px Inter, sans-serif";
    const SUBHEAD_FONT = "bold 36px Inter, sans-serif";
    const TEXT_COLOR = "#000";

    const headlineLines = ["The moon is beautiful,", "isn't it?"];
    const subLines = ["Nyatanya sudut bumi manapun yang indah itu", "takkan indah jika tak bersamamu", "karena pada awalnya yang indah itu adalah kamu"];
    const TEXT_AREA_HEIGHT = TEXT_PADDING_TOP + headlineLines.length * 70 + subLines.length * 40 + BOX_PADDING_BOTTOM;

    const BOX_WIDTH = PHOTO_W + BOX_PADDING_LEFT + BOX_PADDING_RIGHT;
    const BOX_HEIGHT = PHOTO_H + TEXT_AREA_HEIGHT;

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = BOX_WIDTH;
    finalCanvas.height = BOX_HEIGHT;
    const ctx = finalCanvas.getContext("2d");

    // Kotak putih dengan padding kanan/ kiri
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, BOX_WIDTH, BOX_HEIGHT);

    // Gambar foto di dalam kotak putih
    ctx.save();
    let filterStr = '';
    if (isBW) filterStr += 'grayscale(100%) ';
    if (isSepia) filterStr += 'sepia(100%)';
    ctx.filter = filterStr || 'none';
    ctx.drawImage(editorCanvases[0], BOX_PADDING_LEFT, BOX_PADDING_TOP, PHOTO_W, PHOTO_H);
    ctx.restore();

    // Teks di bawah foto dengan padding kiri/atas
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = "left";
    let currentY = PHOTO_H + TEXT_PADDING_TOP;
    ctx.font = HEADLINE_FONT;
    headlineLines.forEach(line => {
        ctx.fillText(line, BOX_PADDING_LEFT + TEXT_PADDING_LEFT, currentY);
        currentY += 70;
    });

    ctx.font = SUBHEAD_FONT;
    subLines.forEach(line => {
        ctx.fillText(line, BOX_PADDING_LEFT + TEXT_PADDING_LEFT, currentY);
        currentY += 40;
    });

    return finalCanvas;
    }

    else {
        // --- MODE 6 FOTO (2 kolom x 3 baris) ---
        const COLS = 2;
        const ROWS = Math.ceil(NUM_PHOTOS / COLS);
        const PHOTO_W = 200;
        const PHOTO_H = 250;
        const GAP = 10;
        const PADDING = 1;
        const BORDER_W = 50;
        const TEXT_TOP_SPACE = 280;

        const finalWidth = (COLS * PHOTO_W) + ((COLS - 1) * GAP) + (2 * PADDING) + (2 * BORDER_W);
        const finalHeight = TEXT_TOP_SPACE + (ROWS * PHOTO_H) + ((ROWS - 1) * GAP) + (2 * PADDING) + (2 * BORDER_W);

        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = finalWidth;
        finalCanvas.height = finalHeight;
        const ctx = finalCanvas.getContext("2d");

        // background dan border pakai warna pilihan
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, finalWidth, finalHeight);
        ctx.lineWidth = BORDER_W;
        ctx.strokeStyle = borderColor;
        ctx.strokeRect(0, 0, finalWidth, finalHeight);

        // gambar semua foto
        let index = 0;
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (index >= NUM_PHOTOS) break;
                const x = PADDING + BORDER_W + col * (PHOTO_W + GAP);
                const y = TEXT_TOP_SPACE + PADDING + BORDER_W + row * (PHOTO_H + GAP);

                ctx.save();
                let filterStr = '';
                if (isBW) filterStr += 'grayscale(100%) ';
                if (isSepia) filterStr += 'sepia(100%)';
                ctx.filter = filterStr || 'none';
                ctx.drawImage(editorCanvases[index], x, y, PHOTO_W, PHOTO_H);
                ctx.restore();

                index++;
            }
        }

        // teks di atas
        ctx.fillStyle = "#fff";
        ctx.font = "bold 120px Comic Sans MS";
        ctx.textAlign = "center";
        ctx.fillText("I ❤️", finalWidth / 2, 150);
        ctx.font = "bold 150px Comic Sans MS";
        ctx.fillText("You", finalWidth / 2, 280);

        return finalCanvas;
    }
}