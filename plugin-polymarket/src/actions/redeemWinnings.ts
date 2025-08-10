import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from "@elizaos/core";
import { ethers, Wallet, Contract, JsonRpcProvider, parseUnits, ZeroHash } from "ethers";
import { initializeClobClient } from "../utils/clobClient";
import {
  contentToActionResult,
  createErrorResult,
} from "../utils/actionHelpers";

// Contract addresses
const CONDITIONAL_TOKENS_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const NEG_RISK_ADAPTER_ADDRESS = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e

// ABI for ConditionalTokens redeemPositions function
const CONDITIONAL_TOKENS_ABI = [
  "function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external",
  "function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256)",
  "function payoutDenominator(bytes32 conditionId) external view returns (uint256)",
];

// ABI for NegRiskAdapter redeemPositions function
const NEG_RISK_ADAPTER_ABI = [
  "function redeemPositions(bytes32 conditionId, uint256[] calldata amounts) external",
];

interface ResolvedMarket {
  conditionId: string;
  question: string;
  resolvedOutcome?: string;
  isNegRisk?: boolean;
  positions?: {
    tokenId: string;
    outcome: string;
    size: string;
  }[];
}

/**
 * Redeem winnings from resolved markets
 */
export const redeemWinningsAction: Action = {
  name: "REDEEM_WINNINGS",
  similes: [
    "REDEEM_POSITIONS",
    "CLAIM_WINNINGS",
    "COLLECT_WINNINGS",
    "REDEEM",
    "CLAIM",
    "WITHDRAW_WINNINGS",
    "GET_PAYOUTS",
  ],
  description: "Redeem winnings from resolved Polymarket markets",
  
  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "redeem my winnings" },
      },
      {
        name: "{{assistant}}",
        content: { 
          text: "I'll check for resolved markets and redeem any winnings.",
          actions: ["REDEEM_WINNINGS"],
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "claim all resolved positions" },
      },
      {
        name: "{{assistant}}",
        content: { 
          text: "Let me process redemptions for all your resolved markets.",
          actions: ["REDEEM_WINNINGS"],
        },
      },
    ],
  ],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    const text = (message.content.text || "").toLowerCase();
    
    // Check for redemption-related keywords
    const redeemKeywords = ["redeem", "claim", "collect", "withdraw"];
    const contextKeywords = ["winning", "payout", "position", "resolved", "settlement"];
    
    const hasRedeemKeyword = redeemKeywords.some(keyword => text.includes(keyword));
    const hasContextKeyword = contextKeywords.some(keyword => text.includes(keyword));
    
    // Must have a redeem keyword, optionally with context
    if (!hasRedeemKeyword && !(text.includes("get") && hasContextKeyword)) {
      return false;
    }
    
    // Check for private key
    const privateKey = runtime.getSetting("WALLET_PRIVATE_KEY") || 
                      runtime.getSetting("PRIVATE_KEY") ||
                      runtime.getSetting("POLYMARKET_PRIVATE_KEY");
    
    if (!privateKey) {
      logger.warn("[redeemWinningsAction] No private key configured");
      return false;
    }
    
    logger.info(`[redeemWinningsAction] Validation passed for message: "${text}"`);
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    logger.info("[redeemWinningsAction] Starting redemption process");

    try {
      // Get private key and setup provider
      const privateKey = runtime.getSetting("WALLET_PRIVATE_KEY") || 
                        runtime.getSetting("PRIVATE_KEY") ||
                        runtime.getSetting("POLYMARKET_PRIVATE_KEY");
      
      if (!privateKey) {
        throw new Error("No private key configured for redemption");
      }

      // Initialize provider and wallet
      const provider = new JsonRpcProvider(
        "https://polygon-rpc.com"
      );
      const wallet = new Wallet(privateKey, provider);
      const walletAddress = wallet.address;

      logger.info(`[redeemWinnings] Using wallet: ${walletAddress}`);

      if (callback) {
        await callback({
          text: "🔍 **Checking for Resolved Markets**\n\nSearching for positions that can be redeemed...",
          actions: ["REDEEM_WINNINGS"],
          data: { status: "checking" },
        });
      }

      // Get current positions from Polymarket API
      const positionsUrl = `https://data-api.polymarket.com/positions?user=${walletAddress}&sizeThreshold=0.01`;
      logger.info(`[redeemWinnings] Fetching positions from: ${positionsUrl}`);
      const positionsResponse = await fetch(positionsUrl);
      
      if (!positionsResponse.ok) {
        throw new Error(`Failed to fetch positions: ${positionsResponse.status}`);
      }

      const positionsData: any = await positionsResponse.json();
      const positions = positionsData.data || positionsData || [];

      logger.info(`[redeemWinnings] Found ${positions.length} positions`);

      // Check which markets are resolved
      const marketMap = new Map<string, ResolvedMarket>();
      
      for (const position of positions) {
        // Skip if position is too small
        const size = parseFloat(position.size || position.quantity || "0");
        if (size < 0.01) continue;

        // Get condition ID from various possible fields
        const conditionId = position.conditionId || 
                          position.market?.conditionId || 
                          position.marketConditionId ||
                          position.condition_id;
        
        if (!conditionId) {
          logger.warn(`[redeemWinnings] No condition ID for position: ${JSON.stringify(position).substring(0, 200)}`);
          continue;
        }

        // Also check if current price is 0 or 1 (indicates resolution)
        const currentPrice = parseFloat(position.currentPrice || position.price || position.current_price || "-1");
        const isLikelyResolved = currentPrice === 0 || currentPrice === 1 || currentPrice === 0.0 || currentPrice === 1.0;
        
        logger.info(`[redeemWinnings] Position ${position.outcome} in market ${conditionId?.substring(0, 10)}... has price ${currentPrice}, size ${size}`);

        // Check if market is resolved by querying the market data
        try {
          // First try to get market data from Gamma API
          const marketUrl = `https://gamma-api.polymarket.com/markets?conditionId=${conditionId}`;
          logger.info(`[redeemWinnings] Checking market resolution at: ${marketUrl}`);
          const marketResponse = await fetch(marketUrl);
          
          if (marketResponse.ok) {
            const marketData = await marketResponse.json();
            const market = Array.isArray(marketData) ? marketData[0] : marketData;
            
            // Check if market is closed/resolved OR if price indicates resolution
            // Also filter out very old markets
            const marketEndDate = market?.endDate || market?.end_date_iso;
            const isOldMarket = marketEndDate ? new Date(marketEndDate) < new Date('2024-01-01') : false;
            
            if (market && !isOldMarket && (market.closed || market.resolved || isLikelyResolved)) {
              const existingMarket = marketMap.get(conditionId);
              
              if (existingMarket) {
                // Add this position to existing market entry
                existingMarket.positions?.push({
                  tokenId: position.tokenId || position.token_id,
                  outcome: position.outcome,
                  size: position.size || position.quantity,
                });
              } else {
                // Create new market entry
                marketMap.set(conditionId, {
                  conditionId,
                  question: market.question || position.market?.question || position.question || "Unknown market",
                  resolvedOutcome: market.outcome || market.resolved_outcome,
                  isNegRisk: market.negRisk || market.neg_risk || market.negative_risk || false,
                  positions: [{
                    tokenId: position.tokenId || position.token_id,
                    outcome: position.outcome,
                    size: position.size || position.quantity,
                  }],
                });
              }
              
              logger.info(`[redeemWinnings] Found resolved market: ${market.question?.substring(0, 50)}...`);
            }
          }
        } catch (error) {
          logger.warn(`[redeemWinnings] Failed to check market ${conditionId}:`, error);
          
          // If API fails but price indicates resolution, still try to redeem
          if (isLikelyResolved) {
            const existingMarket = marketMap.get(conditionId);
            
            if (existingMarket) {
              existingMarket.positions?.push({
                tokenId: position.tokenId,
                outcome: position.outcome,
                size: position.size || position.quantity,
              });
            } else {
              marketMap.set(conditionId, {
                conditionId,
                question: position.question || position.market?.question || "Unknown market",
                resolvedOutcome: currentPrice === 1 ? position.outcome : undefined,
                isNegRisk: position.negRisk || position.negative_risk || false,
                positions: [{
                  tokenId: position.tokenId || position.token_id,
                  outcome: position.outcome,
                  size: position.size || position.quantity,
                }],
              });
            }
          }
        }
      }
      
      // Convert map to array
      const resolvedMarkets = Array.from(marketMap.values());

      if (resolvedMarkets.length === 0) {
        const responseContent: Content = {
          text: "📊 **No Redeemable Positions Found**\n\nYou don't have any positions in resolved markets that can be redeemed.",
          actions: ["REDEEM_WINNINGS"],
          data: {
            status: "no_positions",
            checkedPositions: positions.length,
          },
        };

        if (callback) {
          await callback(responseContent);
        }

        return contentToActionResult(responseContent);
      }

      // Report found markets
      if (callback) {
        const marketsList = resolvedMarkets.map(m => 
          `• ${m.question.substring(0, 50)}...`
        ).join("\n");
        
        await callback({
          text: `✅ **Found ${resolvedMarkets.length} Resolved Markets**\n\n${marketsList}\n\nPreparing redemption transactions...`,
          actions: ["REDEEM_WINNINGS"],
          data: { 
            status: "preparing",
            resolvedMarkets: resolvedMarkets.length,
          },
        });
      }

      // Process redemptions
      const redemptionResults = [];
      let totalRedeemed = 0;

      for (const market of resolvedMarkets) {
        try {
          logger.info(`[redeemWinnings] Processing redemption for ${market.conditionId}`);

          if (market.isNegRisk) {
            // Use NegRiskAdapter for neg risk markets
            const negRiskAdapter = new Contract(
              NEG_RISK_ADAPTER_ADDRESS,
              NEG_RISK_ADAPTER_ABI,
              wallet
            );

            // Get position amounts for this market
            const amounts = market.positions?.map(p => 
              parseUnits(p.size, 6) // USDC has 6 decimals
            ) || [];

            if (amounts.length > 0) {
              const tx = await negRiskAdapter.redeemPositions(
                market.conditionId,
                amounts,
                {
                  gasLimit: 500000,
                }
              );

              logger.info(`[redeemWinnings] Neg risk redemption tx: ${tx.hash}`);
              
              const receipt = await tx.wait();
              
              // Check if transaction was successful
              if (receipt && receipt.status === 1) {
                logger.info(`[redeemWinnings] Neg risk transaction confirmed successfully: ${tx.hash}`);
                redemptionResults.push({
                  market: market.question,
                  txHash: tx.hash,
                  status: "success",
                  type: "neg_risk",
                });
              } else {
                logger.error(`[redeemWinnings] Neg risk transaction failed: ${tx.hash}`);
                redemptionResults.push({
                  market: market.question,
                  txHash: tx.hash,
                  status: "failed",
                  error: "Transaction reverted on chain",
                });
              }

              // Only add to total if successful
              if (receipt && receipt.status === 1) {
                const estimatedAmount = market.positions?.reduce((sum, p) => 
                  sum + parseFloat(p.size), 0
                ) || 0;
                totalRedeemed += estimatedAmount;
              }
            }
          } else {
            // Use standard ConditionalTokens redemption
            const conditionalTokens = new Contract(
              CONDITIONAL_TOKENS_ADDRESS,
              CONDITIONAL_TOKENS_ABI,
              wallet
            );

            // For standard binary markets, indexSets is [1, 2] for both outcomes
            const indexSets = [1, 2];
            const parentCollectionId = ZeroHash; // 0x0 for top-level positions

            // Properly call the function with await
            const tx = await conditionalTokens["redeemPositions(address,bytes32,bytes32,uint256[])"](
              USDC_ADDRESS,
              parentCollectionId,
              market.conditionId,
              indexSets,
              {
                gasLimit: 500000,
              }
            );

            logger.info(`[redeemWinnings] Standard redemption tx: ${tx.hash}`);
            
            const receipt = await tx.wait();
            
            // Check if transaction was successful
            if (receipt && receipt.status === 1) {
              logger.info(`[redeemWinnings] Transaction confirmed successfully: ${tx.hash}`);
              redemptionResults.push({
                market: market.question,
                txHash: tx.hash,
                status: "success",
                type: "standard",
              });
            } else {
              logger.error(`[redeemWinnings] Transaction failed: ${tx.hash}`);
              redemptionResults.push({
                market: market.question,
                txHash: tx.hash,
                status: "failed",
                error: "Transaction reverted on chain",
              });
            }

            // Only add to total if successful
            if (receipt && receipt.status === 1) {
              const estimatedAmount = market.positions?.reduce((sum, p) => 
                sum + parseFloat(p.size), 0
              ) || 0;
              totalRedeemed += estimatedAmount;
            }
          }

        } catch (error) {
          logger.error(`[redeemWinnings] Failed to redeem ${market.conditionId}:`, error);
          
          redemptionResults.push({
            market: market.question,
            error: error instanceof Error ? error.message : "Unknown error",
            status: "failed",
          });
        }
      }

      // Prepare final response
      const successCount = redemptionResults.filter(r => r.status === "success").length;
      const failedCount = redemptionResults.filter(r => r.status === "failed").length;

      let responseText = `🎉 **Redemption Complete**\n\n`;
      responseText += `✅ Successfully redeemed: ${successCount} market(s)\n`;
      if (failedCount > 0) {
        responseText += `❌ Failed redemptions: ${failedCount} market(s)\n`;
      }
      responseText += `💰 Estimated total redeemed: ~$${totalRedeemed.toFixed(2)} USDC\n\n`;

      if (redemptionResults.length > 0) {
        responseText += "**Transaction Details:**\n";
        for (const result of redemptionResults) {
          if (result.status === "success") {
            responseText += `✅ ${result.market.substring(0, 40)}...\n`;
            responseText += `   TX: ${result.txHash}\n`;
          } else {
            responseText += `❌ ${result.market.substring(0, 40)}...\n`;
            responseText += `   Error: ${result.error}\n`;
          }
        }
      }

      const responseContent: Content = {
        text: responseText,
        actions: ["REDEEM_WINNINGS"],
        data: {
          status: "completed",
          successCount,
          failedCount,
          totalRedeemed,
          results: redemptionResults,
        },
      };

      if (callback) {
        await callback(responseContent);
      }

      return contentToActionResult(responseContent);

    } catch (error) {
      logger.error("[redeemWinningsAction] Error:", error);
      
      const errorContent: Content = {
        text: `❌ **Redemption Failed**\n\n${error instanceof Error ? error.message : "Unknown error occurred"}`,
        actions: ["REDEEM_WINNINGS"],
        data: {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };

      if (callback) {
        await callback(errorContent);
      }

      return createErrorResult(
        error instanceof Error ? error.message : "Redemption failed"
      );
    }
  },
};