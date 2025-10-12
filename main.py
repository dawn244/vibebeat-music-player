# main.py
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from bson import ObjectId
import gridfs
from playlist import PlaylistManager
from db import db, fs

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Playlist Manager instance
playlist = PlaylistManager()


# ---- Upload Song to Database (GridFS) ----
@app.post("/upload_song/")
async def upload_song(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        gridfs_id = fs.put(contents, filename=file.filename)
        # store reference in songs collection; use GridFS id as _id for simplicity
        db["songs"].update_one(
            {"_id": gridfs_id},
            {"$set": {"filename": file.filename}},
            upsert=True,
        )
        return {"message": "Song uploaded", "file_id": str(gridfs_id), "filename": file.filename}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")


# ---- Fetch All Songs from Database ----
@app.get("/songs")
def get_all_songs():
    songs = list(db["songs"].find({}, {"_id": 1, "filename": 1}))
    # Convert ObjectId to string
    for song in songs:
        song["_id"] = str(song["_id"])
    return {"songs": songs}


# ---- Play MP3 by file_id ----
@app.get("/play/{file_id}")
def play_song(file_id: str):
    try:
        file = fs.get(ObjectId(file_id))
        return StreamingResponse(file, media_type="audio/mpeg")
    except Exception:
        raise HTTPException(status_code=404, detail="Song not found")


# ---- Get Current Queue (Linked List) ----
@app.get("/playlist")
def get_playlist():
    return {"playlist": playlist.display_playlist()}


# ---- Add Song to Current Queue ----
@app.post("/add_song/{file_id}")
def add_song(file_id: str):
    song = db["songs"].find_one({"_id": ObjectId(file_id)})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    playlist.add_to_playlist({
        "file_id": str(file_id),
        "filename": song["filename"]
    })
    return {"message": f"{song['filename']} added to queue"}


# ---- Remove Song from Current Queue by filename ----
@app.delete("/remove_song/{filename}")
def remove_song(filename: str):
    success = playlist.remove_by_filename(filename)
    if success:
        return {"message": f"{filename} removed from playlist"}
    else:
        raise HTTPException(status_code=404, detail="Song not found in playlist")


# ---- Remove Song from Current Queue by file_id ----
@app.delete("/remove_song_by_id/{file_id}")
def remove_song_by_id(file_id: str):
    success = playlist.remove_by_file_id(file_id)
    if success:
        return {"message": f"{file_id} removed from playlist"}
    else:
        raise HTTPException(status_code=404, detail="Song not found in playlist")


# ---- Playlists CRUD (MongoDB persistence) ----
@app.get("/playlists")
def list_playlists():
    playlists = list(db["playlists"].find({}))
    for p in playlists:
        p["_id"] = str(p["_id"])
        # normalize song ids to str
        if "songs" in p:
            for s in p["songs"]:
                s["file_id"] = str(s.get("file_id"))
    return {"playlists": playlists}


@app.post("/playlists")
def create_playlist(payload: dict):
    name = payload.get("name")
    description = payload.get("description", "")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    doc = {"name": name, "description": description, "songs": [], "createdAt": datetime.now(timezone.utc).isoformat()}
    result = db["playlists"].insert_one(doc)
    return {"_id": str(result.inserted_id), "name": name}


@app.get("/playlists/{playlist_id}")
def get_playlist_by_id(playlist_id: str):
    pl = db["playlists"].find_one({"_id": ObjectId(playlist_id)})
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    pl["_id"] = str(pl["_id"])
    for s in pl.get("songs", []):
        s["file_id"] = str(s.get("file_id"))
    return pl


@app.delete("/playlists/{playlist_id}")
def delete_playlist(playlist_id: str):
    res = db["playlists"].delete_one({"_id": ObjectId(playlist_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"message": "Playlist deleted"}


@app.post("/playlists/{playlist_id}/songs/{file_id}")
def add_song_to_playlist(playlist_id: str, file_id: str):
    song = db["songs"].find_one({"_id": ObjectId(file_id)})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    update_res = db["playlists"].update_one(
        {"_id": ObjectId(playlist_id)},
        {"$addToSet": {"songs": {"file_id": ObjectId(file_id), "filename": song["filename"]}}},
    )
    if update_res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"message": "Song added to playlist"}


@app.delete("/playlists/{playlist_id}/songs/{file_id}")
def remove_song_from_playlist(playlist_id: str, file_id: str):
    update_res = db["playlists"].update_one(
        {"_id": ObjectId(playlist_id)},
        {"$pull": {"songs": {"file_id": ObjectId(file_id)}}},
    )
    if update_res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"message": "Song removed from playlist"}


# ---- Load Queue from a Playlist ----
@app.post("/queue/from_playlist/{playlist_id}")
def load_queue_from_playlist(playlist_id: str):
    pl = db["playlists"].find_one({"_id": ObjectId(playlist_id)})
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    # reset linked list and fill it with playlist songs
    playlist.head = None
    for s in pl.get("songs", []):
        playlist.add_to_playlist({"file_id": str(s["file_id"]), "filename": s["filename"]})
    return {"message": "Queue loaded", "count": len(pl.get("songs", []))}
