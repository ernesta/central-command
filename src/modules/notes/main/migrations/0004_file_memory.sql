-- Where a file a note can link to (`cc://file/<workspace>/<name>`) was last seen, by its identity on disk (device and inode, as text),
-- keyed by its key. An identity survives a rename or a move between workspace folders on the same disk, so a link whose file has
-- gone can be followed. Only a memory: the notes hold the links, and a row may be dropped at any time.
CREATE TABLE entity_file_memory (
  key TEXT PRIMARY KEY,
  dev TEXT NOT NULL,
  ino TEXT NOT NULL
);
