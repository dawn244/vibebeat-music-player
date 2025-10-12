# main.py
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
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


# ---- Get Playlist ----
@app.get("/playlist")
def get_playlist():
    return {"playlist": playlist.display_playlist()}


# ---- Add Song to Playlist ----
@app.post("/add_song/{file_id}")
def add_song(file_id: str):
    song = db["songs"].find_one({"_id": ObjectId(file_id)})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    playlist.add_to_playlist({
        "file_id": str(file_id),
        "filename": song["filename"]
    })
    return {"message": f"{song['filename']} added to playlist"}


# ---- Remove Song from Playlist ----
@app.delete("/remove_song/{filename}")
def remove_song(filename: str):
    success = playlist.remove_from_playlist({"filename": filename})
    if success:
        return {"message": f"{filename} removed from playlist"}
    else:
        raise HTTPException(status_code=404, detail="Song not found in playlist")
