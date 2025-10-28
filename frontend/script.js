// =========================
// script.js - VibeBeat
// =========================

// References to audio player & UI elements
const audioPlayer = document.getElementById('audioPlayer');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const queueContent = document.getElementById('queueContent'); // queue modal
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

let playlist = [];        // dynamic playlist from backend
let currentIndex = 0;     // currently playing song

// =========================
// 1. Load Playlist from Backend
// =========================
async function loadPlaylist() {
    try {
        const res = await fetch("http://127.0.0.1:8000/playlist");
        const data = await res.json();

        if (data.playlist && data.playlist.length > 0) {
            playlist = data.playlist;
        } else {
            // Try to default to all songs from backend as a queue
            const songsRes = await fetch("http://127.0.0.1:8000/songs");
            const songsData = await songsRes.json();
            playlist = (songsData.songs || []).map(s => ({ file_id: s._id, filename: s.filename }));
        }

        displayQueue();
        playSong(0); // start with first song
    } catch (err) {
        console.error("Error fetching backend playlist, using demo songs.", err);
        playlist = [
            { file_id: null, filename: 'Song 1.mp3', url: 'demo/songs/song1.mp3' },
            { file_id: null, filename: 'Song 2.mp3', url: 'demo/songs/song2.mp3' },
            { file_id: null, filename: 'Song 3.mp3', url: 'demo/songs/song3.mp3' },
        ];
        displayQueue();
        playSong(0);
    }
}

// =========================
// 2. Display Playlist in Queue
// =========================
function displayQueue() {
    if (!queueContent) return; // Some pages may not include the queue modal
    queueContent.innerHTML = '';
    playlist.forEach((song, index) => {
        const li = document.createElement('div');
        li.className = 'queue-item';
        li.textContent = song.filename;

        li.addEventListener('click', () => {
            playSong(index);
        });

        queueContent.appendChild(li);
    });
}

// =========================
// 3. Play a Song by Index
// =========================
function playSong(index) {
    if (playlist.length === 0) return;
    currentIndex = index;

    const song = playlist[index];
    if (song.file_id) {
        // Play from backend
        audioPlayer.src = `http://127.0.0.1:8000/play/${song.file_id}`;
    } else if (song.url) {
        // Fallback: play demo song
        audioPlayer.src = song.url;
    }

    audioPlayer.play();

    // Update UI
    trackTitle.textContent = song.filename;
    trackArtist.textContent = 'VibeBeat';
    playBtn.innerHTML = '<i class="fas fa-pause"></i>';
}

// =========================
// 4. Playback Controls
// =========================
playBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        audioPlayer.pause();
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
});

nextBtn.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % playlist.length;
    playSong(currentIndex);
});

prevBtn.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(currentIndex);
});

audioPlayer.addEventListener('ended', () => {
    nextBtn.click();
});

// =========================
// 5. Optional: Upload Songs
// =========================
async function uploadSong(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        await fetch("http://127.0.0.1:8000/upload_song/", {
            method: 'POST',
            body: formData
        });

        loadPlaylist(); // refresh after upload
    } catch (err) {
        console.error("Error uploading song:", err);
    }
}

// =========================
// 6. Initialize on Page Load
// =========================
document.addEventListener('DOMContentLoaded', () => {
    // Check user login (existing code)
    const userData = localStorage.getItem('vibeBeatUser');
    if (!userData) {
        window.location.href = 'login.html';
        return;
    }
    const user = JSON.parse(userData);
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userAvatar').src = user.avatar;

    // Start MusicApp (existing)
    if (typeof MusicApp !== 'undefined') {
        window.app = new MusicApp();
        window.app.start();
    }

    // Load playlist from backend
    loadPlaylist();

    // Upload button wiring
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadInput = document.getElementById('uploadInput');
    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                uploadSong(file);
            }
            // reset input so selecting the same file again still fires change
            uploadInput.value = '';
        });
    }
});
