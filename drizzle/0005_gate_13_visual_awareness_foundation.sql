CREATE TABLE `wardrobe_item_analysis` (
  `id` text PRIMARY KEY NOT NULL,
  `itemId` text NOT NULL,
  `userId` text NOT NULL,
  `status` text NOT NULL,
  `category` text,
  `subcategory` text,
  `primaryColor` text,
  `secondaryColors` text DEFAULT '[]' NOT NULL,
  `pattern` text,
  `material` text,
  `seasonality` text DEFAULT '[]' NOT NULL,
  `styleTags` text DEFAULT '[]' NOT NULL,
  `brandCandidate` text,
  `sizeEstimateCandidate` text,
  `fieldConfidence` text DEFAULT '{}' NOT NULL,
  `overallConfidence` integer DEFAULT 0 NOT NULL,
  `needsReviewFields` text DEFAULT '[]' NOT NULL,
  `rawModelPayload` text,
  `failureCode` text,
  `failureMessage` text,
  `analyzedAt` integer,
  `reviewedAt` integer,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL,
  FOREIGN KEY (`itemId`) REFERENCES `wardrobe_items`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `wardrobe_item_analysis_itemId_unique` ON `wardrobe_item_analysis` (`itemId`);
CREATE INDEX `wardrobe_item_analysis_user_status_idx` ON `wardrobe_item_analysis` (`userId`,`status`);
