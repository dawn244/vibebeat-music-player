# playlist_manager.py

class Node:  # Doubly Linked List Node
    def __init__(self, data):
        self.data = data
        self.next = None
        self.prev = None


class PlaylistManager:
    def __init__(self):
        self.head = None

    def add_to_playlist(self, data):  # Insert at the end
        new_node = Node(data)
        if self.head is None:
            self.head = new_node
        else:
            temp = self.head
            while temp.next is not None:
                temp = temp.next
            temp.next = new_node
            new_node.prev = temp

    def remove_from_playlist(self, data):  # Delete by data
        temp = self.head
        while temp is not None:
            if temp.data == data:
                if temp.prev is not None:
                    temp.prev.next = temp.next
                if temp.next is not None:
                    temp.next.prev = temp.prev
                if temp == self.head:
                    self.head = temp.next
                return True  # Song removed
            temp = temp.next
        return False  # Song not found

    def remove_by_filename(self, filename):
        """Remove first node whose data has matching filename."""
        temp = self.head
        while temp is not None:
            data = temp.data
            if isinstance(data, dict) and data.get("filename") == filename:
                if temp.prev is not None:
                    temp.prev.next = temp.next
                if temp.next is not None:
                    temp.next.prev = temp.prev
                if temp == self.head:
                    self.head = temp.next
                return True
            temp = temp.next
        return False

    def remove_by_file_id(self, file_id):
        """Remove first node whose data has matching file_id (string)."""
        temp = self.head
        while temp is not None:
            data = temp.data
            if isinstance(data, dict) and str(data.get("file_id")) == str(file_id):
                if temp.prev is not None:
                    temp.prev.next = temp.next
                if temp.next is not None:
                    temp.next.prev = temp.prev
                if temp == self.head:
                    self.head = temp.next
                return True
            temp = temp.next
        return False

    def display_playlist(self):  # Return list of songs
        songs = []
        temp = self.head
        while temp is not None:
            songs.append(temp.data)
            temp = temp.next
        return songs
