ALTER TABLE wardrobe_items ADD COLUMN primaryColor TEXT;
ALTER TABLE wardrobe_items ADD COLUMN styleTag TEXT;

CREATE TABLE avatar_preferences (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL UNIQUE,
  gender TEXT NOT NULL,
  skinToneKey TEXT NOT NULL,
  hairStyleKey TEXT NOT NULL,
  hairColorKey TEXT NOT NULL,
  faceStyleKey TEXT NOT NULL,
  bodySize TEXT NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
);

ALTER TABLE outfits ADD COLUMN promptJson TEXT;
ALTER TABLE outfits ADD COLUMN explanation TEXT;
