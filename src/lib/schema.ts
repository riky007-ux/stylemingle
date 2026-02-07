import {
  sqliteTable,
  text,
  integer,
} from "drizzle-orm/sqlite-core";

/**
 * Users
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("passwordHash").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

/**
 * Wardrobe Items
 * ⚠️ MUST match Turso table exactly
 */
export const wardrobe_items = sqliteTable("wardrobe_items", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  imageUrl: text("imageUrl").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

/**
 * Outfits
 */
export const outfits = sqliteTable("outfits", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  itemIds: text("itemIds").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

/**
 * Ratings
 */
export const ratings = sqliteTable("ratings", {
  id: text("id").primaryKey(),
  outfitId: text("outfitId")
    .notNull()
    .references(() => outfits.id),
  rating: integer("rating").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export default {
  users,
  wardrobe_items,
  outfits,
  ratings,
};
