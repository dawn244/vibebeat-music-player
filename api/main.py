from flask import Flask, request, jsonify, send_from_directory
from playlist_manager import PlaylistManager
import os, json

app = Flask(__name__, static_folder="../static", static_url_path="")

UPLOAD_FOLDER = "/tmp/uploads"  # serverless writable directory
PLAYLISTS_FILE = "/tmp/playlists.json"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

playlist_objects = {}

def load_playlists_meta():
    if os.path.exists(PLAYLISTS_FILE):
        with open(PLAYLISTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_playlists_meta(pls):
    with open(PLAYLISTS_FILE, "w", encoding="utf-8") as f:
        json.dump(pls, f, indent=2)

def ensure_playlist_object(plid):
    if plid not in playlist_objects:
        playlist_objects[plid] = PlaylistManager()
    return playlist_objects[plid]

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory(app.static_folder, filename)

@app.route("/upload_song/", methods=["POST"])
def upload_song():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file"}), 400
    filename = os.path.basename(file.filename)
    file.save(os.path.join(UPLOAD_FOLDER, filename))
    return jsonify({"message": "Uploaded", "filename": filename, "path": f"/play/{filename}"}), 201

@app.route("/songs")
def list_songs():
    files = [f for f in os.listdir(UPLOAD_FOLDER) if not f.startswith(".")]
    return jsonify({"songs": [{"filename": f, "path": f"/play/{f}"} for f in files]})

@app.route("/play/<path:filename>")
def play_song(filename):
    safe = os.path.basename(filename)
    return send_from_directory(UPLOAD_FOLDER, safe)

@app.route("/playlists", methods=["GET"])
def get_playlists():
    meta = load_playlists_meta()
    result = []
    for pl in meta:
        pl_obj = ensure_playlist_object(pl["id"])
        result.append({**pl, "songs": pl_obj.display_playlist()})
    return jsonify({"playlists": result})

@app.route("/playlists", methods=["POST"])
def create_playlist():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    desc = (data.get("description") or "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400
    meta = load_playlists_meta()
    new_id = max([p["id"] for p in meta], default=0) + 1
    pl = {"id": new_id, "name": name, "description": desc}
    meta.append(pl)
    save_playlists_meta(meta)
    playlist_objects[new_id] = PlaylistManager()
    return jsonify({"playlist": pl}), 201

@app.route("/playlists/<int:plid>/add", methods=["POST"])
def add_song(plid):
    data = request.get_json(force=True)
    filename = data.get("filename")
    if not filename:
        return jsonify({"error": "No filename"}), 400
    path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(path):
        return jsonify({"error": "File missing"}), 404
    pl_obj = ensure_playlist_object(plid)
    pl_obj.add_to_playlist({"filename": filename})
    return jsonify({"playlist": pl_obj.display_playlist()})

@app.route("/playlists/<int:plid>/remove/<path:filename>", methods=["DELETE"])
def remove_song(plid, filename):
    pl_obj = ensure_playlist_object(plid)
    ok = pl_obj.remove_by_filename(filename)
    if not ok:
        return jsonify({"error": "Song not found"}), 404
    return jsonify({"playlist": pl_obj.display_playlist()})

# Required for Vercel
def handler(event, context):
    return app(event, context)

if __name__ == "__main__":
    app.run(debug=True)
