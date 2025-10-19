// --- VARIABEL GLOBAL DAN LOCAL STORAGE ---
const LS_SETTINGS_KEY = 'photoSettings';
const LS_RESULTS_KEY = 'photoResults';
let editorCanvases = [];
let originalDataURLs = [];
let currentFilter = 'none'
// Fungsi untuk mendapatkan DataURL dari LocalStorage
function getPhotoResults() {
    const results = localStorage.getItem(LS_RESULTS_KEY);
    return results ? JSON.parse(results) : [];
}
// Fungsi untuk membersihkan LocalStorage saat Retake/Mulai Baru
function clearLocalStorage() {
    localStorage.removeItem(LS_SETTINGS_KEY);
    localStorage.removeItem(LS_RESULTS_KEY);
    localStorage.removeItem('editIndex');
}
// --- LOGIKA UTAMA (Deteksi Halaman) ---
if (document.getElementById('camera-page')) {
    document.addEventListener('DOMContentLoaded', () => {
        const video = document.getElementById("video");
        const countdownOverlay = document.getElementById("countdown-overlay");
        const photoSlots = document.getElementById("photo-slots");
        const cameraControls = document.getElementById("camera-controls");
        const resultsColumn = document.getElementById("results-column");
        const resultsTitle = document.getElementById("results-title");
        const videoWrapper = document.getElementById("video-wrapper"); // Dideklarasikan di sini
        
        let capturedDataURLs = [];
        
        const settings = JSON.parse(localStorage.getItem(LS_SETTINGS_KEY));
        if (!settings) {
            alert("Pengaturan tidak ditemukan. Kembali ke halaman awal.");
            window.location.href = 'index.html';
            return;
        }

        const { shotCount, delayTime } = settings;

        // --- SETUP AWAL ---
        createPhotoSlots(shotCount, photoSlots);
        
        // Panggil getUserMedia saat elemen sudah pasti ada
        navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
            video.srcObject = stream;
            
            setTimeout(() => {
                 startCaptureSeries(shotCount, delayTime, video, countdownOverlay, photoSlots, capturedDataURLs, cameraControls, resultsColumn, resultsTitle, videoWrapper);
            }, 1000); 
            
        }).catch(error => {
            alert("Gagal mengakses kamera. Mohon periksa izin browser.");
            console.error("Camera access error:", error);
            window.location.href = 'index.html';
        });
    }); // Akhir dari DOMContentLoaded
    
}else if (document.getElementById('editor-page')) {

    document.addEventListener('DOMContentLoaded', async () => {
        const stripContainer = document.getElementById('strip-preview-container');
        const results = getPhotoResults();

        const downloadBtn = document.getElementById("download-strip-btn");
        const backBtn = document.getElementById("back-to-results-btn");

        const bwBtn = document.getElementById('bw-filter-btn');
        let isBW = false;

        const sepiaBtn = document.getElementById('sepia-filter-btn');
        let isSepia = false;

        originalDataURLs = results;

        if (originalDataURLs.length === 0) {
            window.location.href = 'camera.html';
            return;
        }

        // 1️⃣ Muat foto ke canvas individual dulu
        await loadStripCanvases(stripContainer, originalDataURLs);

        // 2️⃣ Setelah semua foto siap, render hasil akhir
        setTimeout(() => {
            const finalCanvas = createFinalStripCanvas(isBW, isSepia);
            stripContainer.innerHTML = ""; // hapus preview lama
            stripContainer.appendChild(finalCanvas); // tampilkan hasil final
        }, 500);

        // 3️⃣ Tombol Download (langsung pakai hasil final)
        downloadBtn.onclick = function() {
            const finalCanvas = createFinalStripCanvas(isBW, isSepia);
            const link = document.createElement('a');
            link.download = `photo_strip_${Date.now()}.png`;
            link.href = finalCanvas.toDataURL("image/png");
            link.click();
        };

        // 4️⃣ Tombol Kembali
        backBtn.onclick = function() {
            clearLocalStorage();
            window.location.href = 'index.html';
        };

        bwBtn.addEventListener('click', () => {
            isBW = !isBW;
            bwBtn.classList.toggle('active');

            const finalCanvas = createFinalStripCanvas(isBW, isSepia); // <-- pakai isBW
            stripContainer.innerHTML = '';
            stripContainer.appendChild(finalCanvas);
        });

        sepiaBtn.addEventListener('click', () => {
            isSepia = !isSepia;
            sepiaBtn.classList.toggle('active');

            // render ulang preview, bisa tambahin parameter ke createFinalStripCanvas
            const finalCanvas = createFinalStripCanvas(isBW, isSepia);
            stripContainer.innerHTML = '';
            stripContainer.appendChild(finalCanvas);
        });
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

const capturePhoto = (slotIndex, video, capturedDataURLs) => {
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

        const img = document.createElement("img");
        img.src = dataURL;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '6px';
        slotElement.appendChild(img);

        const downloadBtn = document.createElement("a");
        downloadBtn.href = dataURL;
        downloadBtn.download = `photo_${slotIndex + 1}_${Date.now()}.png`;
        downloadBtn.textContent = '↓';
        slotElement.appendChild(downloadBtn);
    }
};

async function startCaptureSeries(shots, delay, video, countdownOverlay, photoSlots, capturedDataURLs, cameraControls, resultsColumn, resultsTitle, videoWrapper) {
    for (let i = 0; i < shots; i++) {
        let slotElement = document.getElementById(`slot-${i}`);
        
        countdownOverlay.textContent = `Shot ${i + 1}/${shots}`;
        countdownOverlay.style.fontSize = '80px'; 
        countdownOverlay.style.display = 'flex';
        await new Promise(resolve => setTimeout(resolve, 800)); 
        
        if(slotElement) slotElement.style.border = '3px solid red'; 
        await runCountdown(delay, countdownOverlay); 
        capturePhoto(i, video, capturedDataURLs);
        
        await new Promise(resolve => setTimeout(resolve, 500)); 
    }
    
    // --- AKSI SETELAH SELESAI TAKE FOTO ---
    hideCountdown(countdownOverlay);
    if (video.srcObject) { video.srcObject.getTracks().forEach(track => track.stop()); }
    
    // Simpan hasil
    localStorage.setItem(LS_RESULTS_KEY, JSON.stringify(capturedDataURLs));
    
    // Tampilkan loader sementara
    videoWrapper.style.display = 'none';
    
    // Tambahkan loader ke DOM
    const loaderElement = document.createElement('h3');
    loaderElement.textContent = "Mengalihkan ke Editor...";
    document.querySelector('.container').appendChild(loaderElement); 
    
    // PENGALIHAN PAKSA
    setTimeout(() => {
        window.location.href = 'editor.html'; 
    }, 5);
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
            canvas.classList.add('editor-canvas'); // Kelas untuk styling
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
    
    // KUNCI: PANGGIL FUNGSI UNTUK MEMBUAT SATU GAMBAR BESAR
    const finalCanvas = createFinalStripCanvas(isBW, isSepia);

    if (!finalCanvas) {
        // Hapus console.error di createFinalStripCanvas agar hanya ada satu alert
        alert("Gagal membuat strip foto final."); 
        return;
    }

    // Logika Download Komposit yang Kuat
    const dataURL = finalCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `photo_strip_final_${Date.now()}.png`;
    
    // Gunakan simulasi click yang paling kuat
    document.body.appendChild(a); 
    const event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
    a.dispatchEvent(event);
    document.body.removeChild(a); 
    
    alert("berhasil diunduh!");
}


// script.js (Ganti fungsi createFinalStripCanvas kamu)
function createFinalStripCanvas(isBW = false, isSepia = false) {
    const NUM_PHOTOS = editorCanvases.length;
    const ctxFont = "bold 48px Inter, sans-serif";
    const ctxTextColor = "#000000ff";

    if (NUM_PHOTOS === 1) {
        // --- MODE 1 FOTO ---
        const PHOTO_W = 1000;
        const PHOTO_H = 800;
        const TEXT_H = 150;

        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = PHOTO_W;
        finalCanvas.height = PHOTO_H + TEXT_H;
        const ctx = finalCanvas.getContext("2d");

        // gambar foto
        ctx.save();
        let filterStr = '';
        if (isBW) filterStr += 'grayscale(100%) ';
        if (isSepia) filterStr += 'sepia(100%)';
        ctx.filter = filterStr || 'none';
        ctx.drawImage(editorCanvases[0], 0, 0, PHOTO_W, PHOTO_H);
        ctx.restore();

        // kotak putih di bawah
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, PHOTO_H, PHOTO_W, TEXT_H);

        // teks puitis
        ctx.fillStyle = ctxTextColor;
        ctx.font = ctxFont;
        ctx.textAlign = "center";
        ctx.fillText("The moon is beautiful, isn't it?", PHOTO_W / 2, PHOTO_H + TEXT_H / 2);

        return finalCanvas;
    } else {
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

        // background strip
        ctx.fillStyle = "#ff70a6";
        ctx.fillRect(0, 0, finalWidth, finalHeight);
        ctx.lineWidth = BORDER_W;
        ctx.strokeStyle = "#fc0065";
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
