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
  isPremium: integer("isPremium", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

/**
 * Wardrobe Items
 */
export const wardrobe_items = sqliteTable("wardrobe_items", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  imageUrl: text("imageUrl").notNull(),
  category: text("category"),
  primaryColor: text("primaryColor"),
  styleTag: text("styleTag"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const avatar_preferences = sqliteTable("avatar_preferences", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id)
    .unique(),
  gender: text("gender", { enum: ["male", "female"] }).notNull(),
  skinToneKey: text("skinToneKey").notNull(),
  hairStyleKey: text("hairStyleKey").notNull(),
  hairColorKey: text("hairColorKey").notNull(),
  faceStyleKey: text("faceStyleKey").notNull(),
  bodySize: text("bodySize", { enum: ["S", "M", "L", "XL"] }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const wardrobe_item_analysis = sqliteTable("wardrobe_item_analysis", {
  id: text("id").primaryKey(),
  wardrobeItemId: text("wardrobeItemId")
    .notNull()
    .references(() => wardrobe_items.id),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["complete", "needs_review"] }).notNull().default("complete"),
  routeUsed: text("routeUsed").notNull().default("legacy"),
  proofMode: integer("proofMode", { mode: "boolean" }).notNull().default(false),
  needsReviewFields: text("needsReviewFields").notNull().default("[]"),
  category: text("category"),
  primaryColor: text("primaryColor"),
  styleTag: text("styleTag"),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
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
  promptJson: text("promptJson"),
  explanation: text("explanation"),
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
  reasons: text("reasons"),
  note: text("note"),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const user_style_profile = sqliteTable("user_style_profile", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id),
  styleVibes: text("styleVibes").notNull().default("[]"),
  fitPreference: text("fitPreference"),
  comfortFashion: integer("comfortFashion").notNull().default(50),
  colorsLove: text("colorsLove").notNull().default("[]"),
  colorsAvoid: text("colorsAvoid").notNull().default("[]"),
  climate: text("climate"),
  budgetSensitivity: text("budgetSensitivity"),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export default {
  users,
  wardrobe_items,
  avatar_preferences,
  outfits,
  ratings,
  user_style_profile,
  wardrobe_item_analysis,
};
