import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export const wardrobe_items = sqliteTable('wardrobe_items', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  imageUrl: text('imageUrl').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});