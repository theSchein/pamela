/**
 * Database schema for Polymarket plugin using Drizzle ORM
 * Based on official Polymarket CLOB API documentation:
 * https://docs.polymarket.com/developers/CLOB/markets/get-markets
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  decimal,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Markets table - stores core market information from Polymarket
 * Maps directly to Market interface from API
 */
export const polymarketMarketsTable = pgTable(
  "polymarket_markets",
  {
    // Primary key (internal)
    id: uuid("id").defaultRandom().primaryKey(),

    // Polymarket identifiers
    conditionId: text("condition_id").notNull().unique(),
    questionId: text("question_id").notNull(),
    marketSlug: text("market_slug").notNull(),

    // Market content
    question: text("question").notNull(),
    category: text("category"),

    // Dates (ISO strings from API)
    endDateIso: timestamp("end_date_iso", { withTimezone: true }),
    gameStartTime: timestamp("game_start_time", { withTimezone: true }),

    // Status flags
    active: boolean("active").notNull().default(false),
    closed: boolean("closed").notNull().default(false),

    // Trading parameters (strings from API)
    minimumOrderSize: text("minimum_order_size"),
    minimumTickSize: text("minimum_tick_size"),
    minIncentiveSize: text("min_incentive_size"),
    maxIncentiveSpread: text("max_incentive_spread"),
    secondsDelay: integer("seconds_delay").default(0),

    // Metadata
    icon: text("icon"),
    fpmm: text("fpmm"), // Fixed Product Market Maker address

    // Tracking fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Indexes for common queries
    conditionIdIdx: index("polymarket_markets_condition_id_idx").on(
      table.conditionId,
    ),
    activeIdx: index("polymarket_markets_active_idx").on(table.active),
    closedIdx: index("polymarket_markets_closed_idx").on(table.closed),
    categoryIdx: index("polymarket_markets_category_idx").on(table.category),
    endDateIdx: index("polymarket_markets_end_date_idx").on(table.endDateIso),
    lastSyncedIdx: index("polymarket_markets_last_synced_idx").on(
      table.lastSyncedAt,
    ),

    // Active markets are most commonly queried
    activeClosedIdx: index("polymarket_markets_active_closed_idx").on(
      table.active,
      table.closed,
    ),
  }),
);

/**
 * Tokens table - stores YES/NO token information for each market
 * Each market has exactly 2 tokens (YES and NO outcomes)
 */
export const polymarketTokensTable = pgTable(
  "polymarket_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenId: text("token_id").notNull().unique(),
    conditionId: text("condition_id").notNull(),
    outcome: text("outcome").notNull(), // 'YES' or 'NO'

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Foreign key to markets
    conditionIdFk: foreignKey({
      columns: [table.conditionId],
      foreignColumns: [polymarketMarketsTable.conditionId],
      name: "fk_tokens_condition_id",
    }).onDelete("cascade"),

    // Indexes
    tokenIdIdx: index("polymarket_tokens_token_id_idx").on(table.tokenId),
    conditionIdIdx: index("polymarket_tokens_condition_id_idx").on(
      table.conditionId,
    ),
    outcomeIdx: index("polymarket_tokens_outcome_idx").on(table.outcome),

    // Compound index for market + outcome lookups
    conditionOutcomeIdx: index("polymarket_tokens_condition_outcome_idx").on(
      table.conditionId,
      table.outcome,
    ),
  }),
);

/**
 * Rewards table - stores reward configuration for markets
 * Based on Rewards interface from API
 */
export const polymarketRewardsTable = pgTable(
  "polymarket_rewards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conditionId: text("condition_id").notNull(),

    // Reward parameters (from API)
    minSize: decimal("min_size", { precision: 20, scale: 8 }),
    maxSpread: decimal("max_spread", { precision: 10, scale: 4 }),
    eventStartDate: text("event_start_date"), // Store as ISO string from API
    eventEndDate: text("event_end_date"), // Store as ISO string from API
    inGameMultiplier: decimal("in_game_multiplier", {
      precision: 10,
      scale: 4,
    }),
    rewardEpoch: integer("reward_epoch"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Foreign key and unique constraint
    conditionIdFk: foreignKey({
      columns: [table.conditionId],
      foreignColumns: [polymarketMarketsTable.conditionId],
      name: "fk_rewards_condition_id",
    }).onDelete("cascade"),

    // One reward config per market
    conditionIdUnique: unique("polymarket_rewards_condition_id_unique").on(
      table.conditionId,
    ),

    // Index for epoch queries
    rewardEpochIdx: index("polymarket_rewards_epoch_idx").on(table.rewardEpoch),
  }),
);

/**
 * Market prices table - stores current price data for tokens
 * This will be populated by price sync service
 */
export const polymarketPricesTable = pgTable(
  "polymarket_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenId: text("token_id").notNull(),
    conditionId: text("condition_id").notNull(),

    // Price data
    price: decimal("price", { precision: 10, scale: 6 }), // Price from 0 to 1
    bid: decimal("bid", { precision: 10, scale: 6 }),
    ask: decimal("ask", { precision: 10, scale: 6 }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Foreign keys
    conditionIdFk: foreignKey({
      columns: [table.conditionId],
      foreignColumns: [polymarketMarketsTable.conditionId],
      name: "fk_prices_condition_id",
    }).onDelete("cascade"),
    tokenIdFk: foreignKey({
      columns: [table.tokenId],
      foreignColumns: [polymarketTokensTable.tokenId],
      name: "fk_prices_token_id",
    }).onDelete("cascade"),

    // Indexes for price lookups
    tokenIdIdx: index("polymarket_prices_token_id_idx").on(table.tokenId),
    conditionIdIdx: index("polymarket_prices_condition_id_idx").on(
      table.conditionId,
    ),
    updatedAtIdx: index("polymarket_prices_updated_at_idx").on(table.updatedAt),

    // Most recent price per token
    tokenUpdatedIdx: index("polymarket_prices_token_updated_idx").on(
      table.tokenId,
      table.updatedAt,
    ),
  }),
);

/**
 * Sync status table - tracks sync operations and status
 */
export const polymarketSyncStatusTable = pgTable(
  "polymarket_sync_status",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    syncType: text("sync_type").notNull(), // 'markets', 'prices', 'volume'
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    syncStatus: text("sync_status").default("pending").notNull(), // 'pending', 'running', 'success', 'error'
    errorMessage: text("error_message"),
    recordsProcessed: integer("records_processed").default(0),

    // Metadata for sync details
    metadata: jsonb("metadata")
      .default(sql`'{}'::jsonb`)
      .notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // Indexes for sync monitoring
    syncTypeIdx: index("polymarket_sync_status_type_idx").on(table.syncType),
    lastSyncIdx: index("polymarket_sync_status_last_sync_idx").on(
      table.lastSyncAt,
    ),
    statusIdx: index("polymarket_sync_status_status_idx").on(table.syncStatus),

    // Latest sync per type
    typeLastSyncIdx: index("polymarket_sync_status_type_last_sync_idx").on(
      table.syncType,
      table.lastSyncAt,
    ),
  }),
);

// Export all tables as schema for migration registration
export const polymarketSchema = {
  polymarketMarketsTable,
  polymarketTokensTable,
  polymarketRewardsTable,
  polymarketPricesTable,
  polymarketSyncStatusTable,
};

// Type exports for TypeScript usage
export type PolymarketMarket = typeof polymarketMarketsTable.$inferSelect;
export type NewPolymarketMarket = typeof polymarketMarketsTable.$inferInsert;
export type PolymarketToken = typeof polymarketTokensTable.$inferSelect;
export type NewPolymarketToken = typeof polymarketTokensTable.$inferInsert;
export type PolymarketReward = typeof polymarketRewardsTable.$inferSelect;
export type NewPolymarketReward = typeof polymarketRewardsTable.$inferInsert;
export type PolymarketPrice = typeof polymarketPricesTable.$inferSelect;
export type NewPolymarketPrice = typeof polymarketPricesTable.$inferInsert;
export type PolymarketSyncStatus =
  typeof polymarketSyncStatusTable.$inferSelect;
export type NewPolymarketSyncStatus =
  typeof polymarketSyncStatusTable.$inferInsert;
