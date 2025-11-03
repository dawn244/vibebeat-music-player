const API_BASE = "";

// --- state
const state = {
  songs: {},        // filename -> {id,title,artist,audio}
  playlists: [],    // array from server
  selectedPlaylistId: null
};

// --- DOM refs
const refs = {
  uploadInput: document.getElementById("uploadInput"),
  uploadBtn: document.getElementById("uploadBtn"),
  createPlaylist: document.getElementById("createPlaylist"),
  sidebarPlaylists: document.getElementById("sidebarPlaylists"),
  libraryGrid: document.getElementById("libraryGrid"),
  playlistsGrid: document.getElementById("playlistsGrid"),
  playlistDetail: document.getElementById("playlistDetail"),
  playlistTitle: document.getElementById("playlistTitle"),
  playlistDesc: document.getElementById("playlistDesc"),
  playlistInfo: document.getElementById("playlistInfo"),
  playAllBtn: document.getElementById("playAllBtn"),
  addSongsBtn: document.getElementById("addSongsBtn"),
  editPlaylistBtn: document.getElementById("editPlaylistBtn"),
  deletePlaylistBtn: document.getElementById("deletePlaylistBtn"),
  playlistSongs: document.getElementById("playlistSongs"),
  audio: document.getElementById("audio"),
  trackTitle: document.getElementById("trackTitle"),
  trackArtist: document.getElementById("trackArtist"),
  modal: document.getElementById("modal"),
  modalInner: document.getElementById("modalInner")
};

// --- helpers
function el(tag, cls, html){ const e = document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML = html; return e; }
function showModal(html){ refs.modalInner.innerHTML = html; refs.modal.style.display = "flex"; }
function closeModal(){ refs.modal.style.display = "none"; refs.modalInner.innerHTML = ""; }
function formatFilename(fn){ return fn.replace(/\.[^/.]+$/, ""); }

// --- fetch songs
async function fetchSongs(){
  try{
    const res = await fetch(`${API_BASE}/songs`);
    const data = await res.json();
    state.songs = {};
    data.songs.forEach(s=>{
      state.songs[s.filename] = { id: s.filename, title: formatFilename(s.filename), artist: "Uploaded", audio: `${API_BASE}${s.path}` };
    });
    renderLibrary();
  }catch(e){ console.error(e); alert("Failed to load songs"); }
}

// --- upload
refs.uploadBtn.addEventListener("click", ()=> refs.uploadInput.click());
refs.uploadInput.addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const form = new FormData(); form.append("file", file);
  try{
    const res = await fetch(`${API_BASE}/upload_song/`, { method: "POST", body: form });
    if(!res.ok) throw new Error("Upload failed");
    await fetchSongs();
    await fetchPlaylists(); // in case playlists reference files
    alert("Uploaded!");
  }catch(err){ console.error(err); alert("Upload failed"); }
  refs.uploadInput.value = "";
});

// --- playlists API
async function fetchPlaylists(){
  try{
    const res = await fetch(`${API_BASE}/playlists`);
    const data = await res.json();
    state.playlists = data.playlists || [];
    renderSideAndGrid();
    // if selected playlist no longer exists, clear detail
    if(state.selectedPlaylistId && !state.playlists.find(p=>p.id===state.selectedPlaylistId)){
      clearPlaylistDetail();
    }
  }catch(e){ console.error(e); alert("Failed to load playlists"); }
}

async function createPlaylistApi(name, desc){
  const res = await fetch(`${API_BASE}/playlists`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ name, description: desc })
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function editPlaylistApi(id, name, desc){
  const res = await fetch(`${API_BASE}/playlists/${id}`, {
    method: "PUT",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ name, description: desc })
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function deletePlaylistApi(id){
  const res = await fetch(`${API_BASE}/playlists/${id}`, { method: "DELETE" });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function addSongToPlaylistApi(id, filename){
  const res = await fetch(`${API_BASE}/playlists/${id}/add`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ filename })
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function removeSongFromPlaylistApi(id, filename){
  const res = await fetch(`${API_BASE}/playlists/${id}/remove/${encodeURIComponent(filename)}`, { method: "DELETE" });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

// --- renderers
function renderLibrary(){
  refs.libraryGrid.innerHTML = "";
  const songs = Object.values(state.songs);
  if(!songs.length) { refs.libraryGrid.append(el("div","card","No songs uploaded")); return; }
  songs.forEach(s=>{
    const card = el("div","card");
    card.innerHTML = `<div class="cover">🎵</div><h3>${s.title}</h3><p>${s.artist}</p>`;
    const playBtn = el("button","primary","▶");
    playBtn.addEventListener("click", ()=> playSong(s.id));
    const addBtn = el("button","small","Add");
    addBtn.addEventListener("click", ()=> openAddToPlaylistQuick(s.id));
    card.append(playBtn, addBtn);
    refs.libraryGrid.append(card);
  });
}

function renderSideAndGrid(){
  // sidebar
  refs.sidebarPlaylists.innerHTML = "";
  state.playlists.forEach(pl=>{
    const li = el("li","","");
    li.textContent = pl.name + (pl.songs.length ? ` (${pl.songs.length})` : "");
    li.dataset.id = pl.id;
    if(state.selectedPlaylistId === pl.id) li.classList.add("active");
    li.addEventListener("click", ()=> selectPlaylist(pl.id));
    refs.sidebarPlaylists.append(li);
  });
  // grid
  refs.playlistsGrid.innerHTML = "";
  state.playlists.forEach(pl=>{
    const card = el("div","card");
    card.innerHTML = `<div class="cover">📋</div><h3>${pl.name}</h3><p>${pl.songs.length} songs</p>`;
    card.addEventListener("click", ()=> selectPlaylist(pl.id));
    refs.playlistsGrid.append(card);
  });
}

function selectPlaylist(id){
  state.selectedPlaylistId = id;
  // highlight in sidebar
  document.querySelectorAll("#sidebarPlaylists li").forEach(li=> li.classList.toggle("active", parseInt(li.dataset.id) === id));
  // show detail
  const pl = state.playlists.find(p=>p.id===id);
  if(!pl) return;
  refs.playlistDetail.style.display = "block";
  refs.playlistTitle.textContent = pl.name;
  refs.playlistDesc.textContent = pl.description || "";
  refs.playlistInfo.textContent = `${pl.songs.length} song${pl.songs.length!==1 ? 's' : ''}`;
  refs.playAllBtn.onclick = ()=> playAll(pl);
  refs.addSongsBtn.onclick = ()=> openAddSongsModal(pl);
  refs.editPlaylistBtn.onclick = ()=> openEditPlaylistModal(pl);
  refs.deletePlaylistBtn.onclick = async ()=>{
    if(!confirm(`Delete playlist "${pl.name}"?`)) return;
    try{ await deletePlaylistApi(pl.id); await fetchPlaylists(); clearPlaylistDetail(); } catch(e){ alert("Failed to delete"); }
  };
  renderPlaylistSongs(pl);
}

function clearPlaylistDetail(){
  state.selectedPlaylistId = null;
  refs.playlistDetail.style.display = "none";
  document.querySelectorAll("#sidebarPlaylists li").forEach(li=> li.classList.remove("active"));
}

function renderPlaylistSongs(pl){
  refs.playlistSongs.innerHTML = "";
  if(!pl.songs.length) {
    refs.playlistSongs.append(el("div","card","No songs in this playlist"));
    return;
  }

  pl.songs.forEach(item => {
    // Each item could be a string (filename) or an object {filename: "..."}
    const filename = typeof item === "string" ? item : item.filename;
    const s = state.songs[filename];
    const title = s ? s.title : filename;

    const row = el("div","list-row");
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px">
        <div>🎵</div>
        <div style="min-width:200px">${title}</div>
      </div>
    `;

    const playBtn = el("button","small","Play");
    playBtn.addEventListener("click", () => playSong(filename));

    const removeBtn = el("button","small","Remove");
    removeBtn.addEventListener("click", async () => {
      try {
        await removeSongFromPlaylistApi(pl.id, filename);
        await fetchPlaylists();
        selectPlaylist(pl.id);
      } catch (e) {
        alert("Failed to remove");
      }
    });

    row.append(playBtn, removeBtn);
    refs.playlistSongs.append(row);
  });
}


// --- interactions / modals
refs.createPlaylist.addEventListener("click", ()=> {
  const html = `
    <h3>Create Playlist</h3>
    <label>Name<br><input id="modal_name" type="text" style="width:100%"/></label>
    <label>Description<br><input id="modal_desc" type="text" style="width:100%"/></label>
    <div class="button-row">
      <button id="modal_cancel" class="small">Cancel</button>
      <button id="modal_create" class="primary">Create</button>
    </div>
  `;
  showModal(html);
  document.getElementById("modal_cancel").addEventListener("click", closeModal);
  document.getElementById("modal_create").addEventListener("click", async ()=>{
    const name = document.getElementById("modal_name").value.trim();
    const desc = document.getElementById("modal_desc").value.trim();
    if(!name) return alert("Name required");
    try{ await createPlaylistApi(name, desc); await fetchPlaylists(); closeModal(); } catch(e){ alert("Create failed"); }
  });
});

async function createPlaylistApi(name, desc){
  const res = await fetch(`${API_BASE}/playlists`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ name, description: desc })
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

function openEditPlaylistModal(pl){
  const html = `
    <h3>Edit Playlist</h3>
    <label>Name<br><input id="modal_name" value="${escapeHtml(pl.name)}" type="text" style="width:100%"/></label>
    <label>Description<br><input id="modal_desc" value="${escapeHtml(pl.description||'')}" type="text" style="width:100%"/></label>
    <div class="button-row">
      <button id="modal_cancel" class="small">Cancel</button>
      <button id="modal_save" class="primary">Save</button>
    </div>
  `;
  showModal(html);
  document.getElementById("modal_cancel").addEventListener("click", closeModal);
  document.getElementById("modal_save").addEventListener("click", async ()=>{
    const name = document.getElementById("modal_name").value.trim();
    const desc = document.getElementById("modal_desc").value.trim();
    if(!name) return alert("Name required");
    try{ await editPlaylistApi(pl.id, name, desc); await fetchPlaylists(); closeModal(); } catch(e){ alert("Save failed"); }
  });
}

async function editPlaylistApi(id, name, desc){
  const res = await fetch(`${API_BASE}/playlists/${id}`, {
    method: "PUT",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ name, description: desc })
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

function openAddSongsModal(pl){
  // list songs not already in playlist
  const available = Object.keys(state.songs).filter(fn => !pl.songs.includes(fn));
  if(available.length === 0) return alert("No songs available to add");
  const rows = available.map(fn => `<label style="display:block"><input type="checkbox" data-fn="${fn}" /> ${escapeHtml(formatFilename(fn))}</label>`).join("");
  const html = `<h3>Add Songs to ${escapeHtml(pl.name)}</h3><div style="max-height:300px;overflow:auto;margin-top:8px">${rows}</div>
    <div class="button-row"><button id="modal_cancel" class="small">Cancel</button><button id="modal_add" class="primary">Add</button></div>`;
  showModal(html);
  document.getElementById("modal_cancel").addEventListener("click", closeModal);
  document.getElementById("modal_add").addEventListener("click", async ()=>{
    const checks = Array.from(refs.modalInner.querySelectorAll('input[type=checkbox]:checked'));
    if(checks.length === 0) return alert("Select at least one");
    try{
      for(const c of checks){
        const fn = c.dataset.fn;
        await addSongToPlaylistApi(pl.id, fn);
      }
      await fetchPlaylists();
      selectPlaylist(pl.id);
      closeModal();
    }catch(e){ alert("Failed to add songs"); }
  });
}

async function addSongToPlaylistApi(id, filename){
  const res = await fetch(`${API_BASE}/playlists/${id}/add`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ filename })
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

function openAddToPlaylistQuick(filename){
  if(state.playlists.length === 0) return alert("No playlists. Create one first.");
  const rows = state.playlists.map(pl => `<label style="display:block"><input type="radio" name="pl" value="${pl.id}" /> ${escapeHtml(pl.name)}</label>`).join("");
  const html = `<h3>Add "${escapeHtml(formatFilename(filename))}" to</h3><div style="max-height:300px;overflow:auto;margin-top:8px">${rows}</div>
    <div class="button-row"><button id="modal_cancel" class="small">Cancel</button><button id="modal_add" class="primary">Add</button></div>`;
  showModal(html);
  document.getElementById("modal_cancel").addEventListener("click", closeModal);
  document.getElementById("modal_add").addEventListener("click", async ()=>{
    const sel = refs.modalInner.querySelector('input[name=pl]:checked');
    if(!sel) return alert("Choose a playlist");
    try{
      await addSongToPlaylistApi(parseInt(sel.value,10), filename);
      await fetchPlaylists();
      closeModal();
    }catch(e){ alert("Failed to add"); }
  });
}

// --- delete playlist
async function deletePlaylistApi(id){
  const res = await fetch(`${API_BASE}/playlists/${id}`, { method: "DELETE" });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

// --- play helpers
function playSong(idOrFilename){
  const fn = typeof idOrFilename === "string" ? idOrFilename : idOrFilename.id;
  const song = state.songs[fn];
  if(!song) return alert("Song not found");
  refs.audio.src = song.audio;
  refs.audio.play();
  refs.trackTitle.textContent = song.title;
  refs.trackArtist.textContent = song.artist;
}
function playAll(pl){
  if(!pl.songs.length) return alert("No songs");
  const first = pl.songs.find(fn => state.songs[fn]);
  if(!first) return alert("First song not available on server");
  playSong(first);
}

// --- utilities
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function formatFilename(fn){ return fn.replace(/\.[^/.]+$/, ""); }

// --- init
async function init(){
  await fetchSongs();
  await fetchPlaylists();
  // modal click outside to close
  refs.modal.addEventListener("click", (e)=>{ if(e.target === refs.modal) closeModal(); });
}
init();
