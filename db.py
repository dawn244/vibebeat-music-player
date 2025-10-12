# db.py
from pymongo import MongoClient
import gridfs

client = MongoClient("mongodb://localhost:27017")
db = client["musicdb"]
fs = gridfs.GridFS(db)
