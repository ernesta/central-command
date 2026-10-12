-- Where a linked folder was last seen, by its identity on disk (device and inode, as text because an inode may not fit a JS number),
-- keyed by its path relative to the Trainings folder. An identity survives a rename or a move on the same disk, so a link whose path
-- has gone can be followed to the folder's new path. Only a memory: the note's `folder:` is the truth, and a row may be dropped at any time.
CREATE TABLE training_folder_memory (
  folder TEXT PRIMARY KEY,
  dev    TEXT NOT NULL,
  ino    TEXT NOT NULL
);
