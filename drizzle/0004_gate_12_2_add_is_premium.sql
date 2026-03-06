ALTER TABLE users ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0;

UPDATE users
SET is_premium = CASE
  WHEN isPremium IS NOT NULL AND isPremium != 0 THEN 1
  ELSE 0
END;
