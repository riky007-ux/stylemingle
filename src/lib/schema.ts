import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export const wardrobe_items = sqliteTable('wardrobe_items', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  imageUrl: text('imageUrl').notNull(),
  category: text('category'),
  color: text('color'),
  style: text('style'),
  season: text('season'),
  notes: text('notes'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export const outfits = sqliteTable('outfits', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export const ratings = sqliteTable('ratings', {
  id: text('id').primaryKey(),
  outfitId: text('outfitId').notNull().references(() => outfits.id),
  rating: integer('rating').notNull(),
  userId: text('userId').notNull().references(() => users.id),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export default { users, wardrobe_items, outfits, ratings };
