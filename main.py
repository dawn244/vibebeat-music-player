import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from playlist_manager import PlaylistManager

# Flask setup
app = Flask(__name__)
CORS(app)

# Folder to save uploaded songs
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Playlist manager (linked list)
playlist = PlaylistManager()


# ---- Upload Song ----
@app.route("/upload_song/", methods=["POST"])
def upload_song():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(file_path)

    return jsonify({
        "message": "Song uploaded successfully",
        "filename": file.filename,
        "path": file_path
    })


# ---- Fetch All Songs ----
@app.route("/songs", methods=["GET"])
def get_all_songs():
    files = os.listdir(UPLOAD_FOLDER)
    songs = [{"filename": f, "path": f"/play/{f}"} for f in files]
    return jsonify({"songs": songs})


# ---- Play a Song ----
@app.route("/play/<filename>", methods=["GET"])
def play_song(filename):
    try:
        return send_from_directory(UPLOAD_FOLDER, filename, mimetype="audio/mpeg")
    except FileNotFoundError:
        return jsonify({"error": "Song not found"}), 404


# ---- Playlist Operations ----
@app.route("/playlist", methods=["GET"])
def get_playlist():
    return jsonify({"playlist": playlist.display_playlist()})


@app.route("/add_song/<filename>", methods=["POST"])
def add_song(filename):
    song_path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(song_path):
        return jsonify({"error": "Song not found"}), 404

    playlist.add_to_playlist({
        "filename": filename,
        "path": f"/play/{filename}"
    })
    return jsonify({"message": f"{filename} added to queue"})


@app.route("/remove_song/<filename>", methods=["DELETE"])
def remove_song(filename):
    success = playlist.remove_by_filename(filename)
    if success:
        return jsonify({"message": f"{filename} removed from playlist"})
    else:
        return jsonify({"error": "Song not found in playlist"}), 404


@app.route("/playlist/clear", methods=["DELETE"])
def clear_playlist():
    playlist.head = None
    return jsonify({"message": "Playlist cleared"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
