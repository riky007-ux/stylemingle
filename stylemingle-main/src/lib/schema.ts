import { sqliteTable, text, integer } from 'drizzle-orm/libsql';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  subscription: text('subscription').notNull().default('free'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const wardrobeItems = sqliteTable('wardrobe_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  imageUrl: text('image_url').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const outfits = sqliteTable('outfits', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  itemIds: text('item_ids').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const ratings = sqliteTable('ratings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  outfitId: text('outfit_id').notNull().references(() => outfits.id),
  rating: integer('rating').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
