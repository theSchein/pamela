import { logger } from "@elizaos/core";

/**
 * Price formatting and validation utilities for Polymarket
 * Handles the different price formats from various API endpoints
 */

export interface PriceValidationResult {
  isValid: boolean;
  price?: number;
  error?: string;
}

export interface FormattedPrice {
  decimal: number;
  percentage: number;
  display: string;
  cents: string;
}

/**
 * Validates and parses a price value from any format
 * @param price - Price in any format (string, number, etc.)
 * @param context - Context for error logging
 * @returns Validation result with parsed price or error
 */
export function validatePrice(price: any, context: string = "unknown"): PriceValidationResult {
  if (price === undefined || price === null) {
    return {
      isValid: false,
      error: "Price is undefined or null"
    };
  }

  let numericPrice: number;

  try {
    if (typeof price === 'string') {
      // Handle string prices (from order book endpoints)
      if (price.trim() === '') {
        return {
          isValid: false,
          error: "Price is empty string"
        };
      }
      numericPrice = parseFloat(price);
    } else if (typeof price === 'number') {
      // Handle numeric prices (from market endpoints)
      numericPrice = price;
    } else {
      return {
        isValid: false,
        error: `Invalid price type: ${typeof price}`
      };
    }

    // Check if parsing resulted in NaN
    if (isNaN(numericPrice)) {
      return {
        isValid: false,
        error: `Cannot parse price value: ${price}`
      };
    }

    // Validate price range for prediction markets (0-1)
    if (numericPrice < 0 || numericPrice > 1) {
      logger.warn(`[priceHelpers] Price ${numericPrice} outside normal range [0,1] in context: ${context}`);
      // Don't fail validation, just log warning as some special cases might exist
    }

    return {
      isValid: true,
      price: numericPrice
    };

  } catch (error) {
    return {
      isValid: false,
      error: `Error parsing price: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}

/**
 * Formats a validated price for display and API usage
 * @param price - Numeric price (0-1 range)
 * @param decimals - Number of decimal places for display
 * @returns Formatted price object
 */
export function formatPrice(price: number, decimals: number = 4): FormattedPrice {
  // Ensure price is in valid range
  const clampedPrice = Math.max(0, Math.min(1, price));
  
  if (clampedPrice !== price) {
    logger.warn(`[priceHelpers] Price ${price} clamped to ${clampedPrice}`);
  }

  return {
    decimal: clampedPrice,
    percentage: clampedPrice * 100,
    display: `$${clampedPrice.toFixed(decimals)}`,
    cents: `${(clampedPrice * 100).toFixed(decimals - 2)}%`
  };
}

/**
 * Safely parses and formats a price from API response
 * @param rawPrice - Raw price from API (any format)
 * @param context - Context for logging
 * @param decimals - Decimal places for formatting
 * @returns Formatted price or null if invalid
 */
export function parseAndFormatPrice(
  rawPrice: any, 
  context: string = "api", 
  decimals: number = 4
): FormattedPrice | null {
  const validation = validatePrice(rawPrice, context);
  
  if (!validation.isValid) {
    logger.error(`[priceHelpers] Invalid price in ${context}: ${validation.error}`);
    return null;
  }

  return formatPrice(validation.price!, decimals);
}

/**
 * Extracts the best bid/ask prices from order book data
 * @param orderbook - Order book data from CLOB API
 * @returns Object with best bid and ask prices, or null values if not available
 */
export function extractOrderBookPrices(orderbook: any): {
  bestBid: number | null;
  bestAsk: number | null;
  bidSize: number | null;
  askSize: number | null;
} {
  let bestBid: number | null = null;
  let bestAsk: number | null = null;
  let bidSize: number | null = null;
  let askSize: number | null = null;

  try {
    // Extract best bid
    if (orderbook?.bids && Array.isArray(orderbook.bids) && orderbook.bids.length > 0) {
      const bidValidation = validatePrice(orderbook.bids[0].price, "orderbook-bid");
      if (bidValidation.isValid) {
        bestBid = bidValidation.price!;
        const sizeValidation = validatePrice(orderbook.bids[0].size, "orderbook-bid-size");
        if (sizeValidation.isValid) {
          bidSize = sizeValidation.price!; // size is also a numeric value
        }
      }
    }

    // Extract best ask
    if (orderbook?.asks && Array.isArray(orderbook.asks) && orderbook.asks.length > 0) {
      const askValidation = validatePrice(orderbook.asks[0].price, "orderbook-ask");
      if (askValidation.isValid) {
        bestAsk = askValidation.price!;
        const sizeValidation = validatePrice(orderbook.asks[0].size, "orderbook-ask-size");
        if (sizeValidation.isValid) {
          askSize = sizeValidation.price!; // size is also a numeric value
        }
      }
    }
  } catch (error) {
    logger.error(`[priceHelpers] Error extracting orderbook prices:`, error);
  }

  return { bestBid, bestAsk, bidSize, askSize };
}

/**
 * Calculates trading recommendations based on order book prices
 * @param bestBid - Best bid price
 * @param bestAsk - Best ask price
 * @param premiumPercent - Premium to add for reliable execution (default 2%)
 * @returns Recommended buy and sell prices
 */
export function calculateTradingPrices(
  bestBid: number, 
  bestAsk: number, 
  premiumPercent: number = 0.02
): {
  recommendedBuyPrice: number;
  recommendedSellPrice: number;
  midPrice: number;
  spread: number;
  spreadPercent: number;
} {
  const midPrice = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;
  const spreadPercent = (spread / midPrice) * 100;

  // Add premium for reliable execution, but cap at market limits
  const recommendedBuyPrice = Math.min(0.99, bestAsk * (1 + premiumPercent));
  const recommendedSellPrice = Math.max(0.01, bestBid * (1 - premiumPercent));

  return {
    recommendedBuyPrice,
    recommendedSellPrice,
    midPrice,
    spread,
    spreadPercent
  };
}

/**
 * Formats a price for API submission (ensures proper decimal string format)
 * @param price - Numeric price
 * @param decimals - Number of decimal places
 * @returns Price formatted as string for API
 */
export function formatPriceForAPI(price: number, decimals: number = 4): string {
  const validation = validatePrice(price, "api-submission");
  if (!validation.isValid) {
    throw new Error(`Invalid price for API submission: ${validation.error}`);
  }
  
  return validation.price!.toFixed(decimals);
}