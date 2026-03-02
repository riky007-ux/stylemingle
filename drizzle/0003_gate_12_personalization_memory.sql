ALTER TABLE users ADD COLUMN isPremium INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ratings ADD COLUMN reasons TEXT;
ALTER TABLE ratings ADD COLUMN note TEXT;

CREATE TABLE IF NOT EXISTS user_style_profile (
  userId TEXT PRIMARY KEY NOT NULL,
  styleVibes TEXT NOT NULL DEFAULT '[]',
  fitPreference TEXT,
  comfortFashion INTEGER NOT NULL DEFAULT 50,
  colorsLove TEXT NOT NULL DEFAULT '[]',
  colorsAvoid TEXT NOT NULL DEFAULT '[]',
  climate TEXT,
  budgetSensitivity TEXT,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
);
