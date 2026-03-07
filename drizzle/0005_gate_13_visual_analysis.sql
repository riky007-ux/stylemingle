CREATE TABLE IF NOT EXISTS wardrobe_item_analysis (
  id TEXT PRIMARY KEY NOT NULL,
  wardrobeItemId TEXT NOT NULL,
  userId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'complete',
  routeUsed TEXT NOT NULL DEFAULT 'legacy',
  proofMode INTEGER NOT NULL DEFAULT 0,
  needsReviewFields TEXT NOT NULL DEFAULT '[]',
  category TEXT,
  primaryColor TEXT,
  styleTag TEXT,
  updatedAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (wardrobeItemId) REFERENCES wardrobe_items(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS wardrobe_item_analysis_user_idx
  ON wardrobe_item_analysis(userId);

CREATE INDEX IF NOT EXISTS wardrobe_item_analysis_item_idx
  ON wardrobe_item_analysis(wardrobeItemId);
