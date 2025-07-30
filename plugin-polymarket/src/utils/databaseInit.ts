/**
 * Database initialization utilities for Polymarket plugin
 * Handles table creation and schema setup
 */

import { logger } from "@elizaos/core";
import { sql } from "drizzle-orm";

/**
 * Initialize database tables for Polymarket plugin
 * Creates tables if they don't exist
 */
export async function initializePolymarketTables(db: any): Promise<boolean> {
  try {
    logger.info("Initializing Polymarket database tables...");

    // Create polymarket_markets table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS polymarket_markets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        condition_id TEXT NOT NULL UNIQUE,
        question_id TEXT NOT NULL,
        market_slug TEXT NOT NULL,
        question TEXT NOT NULL,
        category TEXT,
        end_date_iso TIMESTAMP WITH TIME ZONE,
        game_start_time TIMESTAMP WITH TIME ZONE,
        active BOOLEAN NOT NULL DEFAULT false,
        closed BOOLEAN NOT NULL DEFAULT false,
        minimum_order_size TEXT,
        minimum_tick_size TEXT,
        min_incentive_size TEXT,
        max_incentive_spread TEXT,
        seconds_delay INTEGER DEFAULT 0,
        icon TEXT,
        fpmm TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      )
    `);

    // Create indexes
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_markets_condition_id_idx ON polymarket_markets(condition_id)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_markets_active_idx ON polymarket_markets(active)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_markets_closed_idx ON polymarket_markets(closed)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_markets_category_idx ON polymarket_markets(category)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_markets_end_date_idx ON polymarket_markets(end_date_iso)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_markets_last_synced_idx ON polymarket_markets(last_synced_at)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_markets_active_closed_idx ON polymarket_markets(active, closed)`,
    );

    // Create polymarket_tokens table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS polymarket_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_id TEXT NOT NULL UNIQUE,
        condition_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        FOREIGN KEY (condition_id) REFERENCES polymarket_markets(condition_id) ON DELETE CASCADE
      )
    `);

    // Create token indexes
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_tokens_token_id_idx ON polymarket_tokens(token_id)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_tokens_condition_id_idx ON polymarket_tokens(condition_id)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_tokens_outcome_idx ON polymarket_tokens(outcome)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_tokens_condition_outcome_idx ON polymarket_tokens(condition_id, outcome)`,
    );

    // Create polymarket_rewards table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS polymarket_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        condition_id TEXT NOT NULL UNIQUE,
        min_size DECIMAL(20,8),
        max_spread DECIMAL(10,4),
        event_start_date TEXT,
        event_end_date TEXT,
        in_game_multiplier DECIMAL(10,4),
        reward_epoch INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        FOREIGN KEY (condition_id) REFERENCES polymarket_markets(condition_id) ON DELETE CASCADE
      )
    `);

    // Create reward indexes
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_rewards_epoch_idx ON polymarket_rewards(reward_epoch)`,
    );

    // Create polymarket_prices table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS polymarket_prices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_id TEXT NOT NULL,
        condition_id TEXT NOT NULL,
        price DECIMAL(10,6),
        bid DECIMAL(10,6),
        ask DECIMAL(10,6),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        FOREIGN KEY (condition_id) REFERENCES polymarket_markets(condition_id) ON DELETE CASCADE,
        FOREIGN KEY (token_id) REFERENCES polymarket_tokens(token_id) ON DELETE CASCADE
      )
    `);

    // Create price indexes
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_prices_token_id_idx ON polymarket_prices(token_id)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_prices_condition_id_idx ON polymarket_prices(condition_id)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_prices_updated_at_idx ON polymarket_prices(updated_at)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_prices_token_updated_idx ON polymarket_prices(token_id, updated_at)`,
    );

    // Create polymarket_sync_status table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS polymarket_sync_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sync_type TEXT NOT NULL,
        last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        sync_status TEXT DEFAULT 'pending' NOT NULL,
        error_message TEXT,
        records_processed INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      )
    `);

    // Create sync status indexes
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_sync_status_type_idx ON polymarket_sync_status(sync_type)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_sync_status_last_sync_idx ON polymarket_sync_status(last_sync_at)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_sync_status_status_idx ON polymarket_sync_status(sync_status)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS polymarket_sync_status_type_last_sync_idx ON polymarket_sync_status(sync_type, last_sync_at)`,
    );

    logger.info("Polymarket database tables initialized successfully");
    return true;
  } catch (error) {
    logger.error("Failed to initialize Polymarket database tables:", error);
    return false;
  }
}

/**
 * Check if Polymarket tables exist
 */
export async function checkPolymarketTablesExist(db: any): Promise<boolean> {
  try {
    // Try to query the main markets table
    await db.execute(sql`SELECT 1 FROM polymarket_markets LIMIT 1`);
    return true;
  } catch (error) {
    return false;
  }
}
