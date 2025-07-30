import { type IAgentRuntime, logger } from "@elizaos/core";
import { eq, and, sql, like, desc } from "drizzle-orm";
import { polymarketMarketsTable, polymarketTokensTable } from "../schema";

/**
 * Market lookup result containing market and token information
 */
export interface MarketLookupResult {
  market: {
    id: string;
    question: string;
    condition_id: string;
    slug: string;
    category: string;
    end_date_iso: string;
    description?: string;
  };
  tokens: {
    token_id: string;
    outcome: string;
    price?: string;
  }[];
}

/**
 * Find market by question, slug, or description
 * @param runtime - Agent runtime for database access
 * @param searchTerm - Market name, question, or partial match
 * @returns Market and token information
 */
export async function findMarketByName(
  runtime: IAgentRuntime,
  searchTerm: string,
): Promise<MarketLookupResult | null> {
  logger.info(`[marketLookup] Searching for market: "${searchTerm}"`);

  try {
    const db = (runtime as any).db;
    if (!db) {
      throw new Error("Database not available");
    }

    // Clean search term - remove quotes, normalize case
    const cleanTerm = searchTerm.replace(/['"]/g, "").trim().toLowerCase();

    logger.info(`[marketLookup] Clean search term: "${cleanTerm}"`);

    // Search for market by question, slug, or description
    const markets = await db
      .select()
      .from(polymarketMarketsTable)
      .where(
        and(
          eq(polymarketMarketsTable.active, true),
          eq(polymarketMarketsTable.closed, false),
          sql`(
            LOWER(${polymarketMarketsTable.question}) LIKE ${`%${cleanTerm}%`} OR
            LOWER(${polymarketMarketsTable.marketSlug}) LIKE ${`%${cleanTerm}%`} OR
            LOWER(${polymarketMarketsTable.category}) LIKE ${`%${cleanTerm}%`}
          )`,
        ),
      )
      .orderBy(desc(polymarketMarketsTable.lastSyncedAt))
      .limit(5);

    if (markets.length === 0) {
      logger.warn(`[marketLookup] No markets found for: "${searchTerm}"`);
      return null;
    }

    // Get the best match (highest volume first)
    const market = markets[0];
    logger.info(`[marketLookup] Found market: "${market.question}"`);

    // Get tokens for this market
    const tokens = await db
      .select()
      .from(polymarketTokensTable)
      .where(eq(polymarketTokensTable.conditionId, market.conditionId))
      .orderBy(polymarketTokensTable.outcome);

    if (tokens.length === 0) {
      logger.warn(`[marketLookup] No tokens found for market: ${market.id}`);
      return null;
    }

    const result: MarketLookupResult = {
      market: {
        id: market.id,
        question: market.question,
        condition_id: market.conditionId,
        slug: market.marketSlug,
        category: market.category || "",
        end_date_iso: market.endDateIso?.toISOString() || "",
        description: market.marketSlug, // Use slug as description fallback
      },
      tokens: tokens.map((token: any) => ({
        token_id: token.tokenId,
        outcome: token.outcome,
        price: undefined, // Price not stored in tokens table
      })),
    };

    logger.info(`[marketLookup] Market lookup successful:`, {
      question: result.market.question,
      tokenCount: result.tokens.length,
      tokens: result.tokens.map(
        (t) => `${t.outcome}: ${t.token_id.slice(0, 8)}...`,
      ),
    });

    return result;
  } catch (error) {
    logger.error(`[marketLookup] Error finding market:`, error);
    return null;
  }
}

/**
 * Get multiple market suggestions based on search term
 * @param runtime - Agent runtime for database access
 * @param searchTerm - Partial market name or category
 * @param limit - Maximum number of results (default: 5)
 * @returns Array of market lookup results
 */
export async function getMarketSuggestions(
  runtime: IAgentRuntime,
  searchTerm: string,
  limit: number = 5,
): Promise<MarketLookupResult[]> {
  logger.info(`[marketLookup] Getting suggestions for: "${searchTerm}"`);

  try {
    const db = (runtime as any).db;
    if (!db) {
      throw new Error("Database not available");
    }

    const cleanTerm = searchTerm.replace(/['"]/g, "").trim().toLowerCase();

    const markets = await db
      .select()
      .from(polymarketMarketsTable)
      .where(
        and(
          eq(polymarketMarketsTable.active, true),
          eq(polymarketMarketsTable.closed, false),
          sql`(
            LOWER(${polymarketMarketsTable.question}) LIKE ${`%${cleanTerm}%`} OR
            LOWER(${polymarketMarketsTable.marketSlug}) LIKE ${`%${cleanTerm}%`} OR
            LOWER(${polymarketMarketsTable.category}) LIKE ${`%${cleanTerm}%`}
          )`,
        ),
      )
      .orderBy(desc(polymarketMarketsTable.lastSyncedAt))
      .limit(limit);

    const results: MarketLookupResult[] = [];

    for (const market of markets) {
      const tokens = await db
        .select()
        .from(polymarketTokensTable)
        .where(eq(polymarketTokensTable.conditionId, market.conditionId))
        .orderBy(polymarketTokensTable.outcome);

      if (tokens.length > 0) {
        results.push({
          market: {
            id: market.id,
            question: market.question,
            condition_id: market.conditionId,
            slug: market.marketSlug,
            category: market.category || "",
            end_date_iso: market.endDateIso?.toISOString() || "",
            description: market.marketSlug,
          },
          tokens: tokens.map((token: any) => ({
            token_id: token.tokenId,
            outcome: token.outcome,
            price: undefined,
          })),
        });
      }
    }

    logger.info(`[marketLookup] Found ${results.length} market suggestions`);
    return results;
  } catch (error) {
    logger.error(`[marketLookup] Error getting suggestions:`, error);
    return [];
  }
}

/**
 * Format market lookup result for user display
 * @param result - Market lookup result
 * @returns Formatted string for user
 */
export function formatMarketLookup(result: MarketLookupResult): string {
  const endDate = new Date(result.market.end_date_iso).toLocaleDateString();

  const tokenInfo = result.tokens
    .map((token) => {
      const price = token.price
        ? `$${parseFloat(token.price).toFixed(3)}`
        : "N/A";
      return `• **${token.outcome}**: ${price}`;
    })
    .join("\n");

  return `**${result.market.question}**

**Market Details:**
• **Category**: ${result.market.category}
• **End Date**: ${endDate}
• **Market ID**: ${result.market.condition_id}

**Current Prices:**
${tokenInfo}

*To trade, use: "Buy YES/NO in ${result.market.question}" or similar natural language.*`;
}

/**
 * Extract market reference from user message
 * @param message - User message text
 * @returns Extracted market name/reference
 */
export function extractMarketReference(message: string): string | null {
  // Remove common trading words and extract market name
  const cleanMessage = message
    .replace(
      /\b(buy|sell|trade|order|place|get|details|about|on|in|for|the)\b/gi,
      " ",
    )
    .replace(/\b(token|market|shares?|position)\b/gi, " ")
    .replace(/\$[\d.]+/g, " ") // Remove prices
    .replace(/\d+/g, " ") // Remove numbers
    .replace(/\s+/g, " ")
    .trim();

  // Look for quoted text or title case phrases
  const quotedMatch = message.match(/["']([^"']+)["']/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Look for question-like patterns
  const questionMatch = cleanMessage.match(/([A-Z][^.!?]*\?)/);
  if (questionMatch) {
    return questionMatch[1];
  }

  // Return cleaned message if it's substantial
  if (cleanMessage.length > 3) {
    return cleanMessage;
  }

  return null;
}
