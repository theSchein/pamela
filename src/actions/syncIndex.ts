import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    logger
} from "@elizaos/core";
import { IndexTradingService } from "../services/IndexTradingService";

export const syncIndexAction: Action = {
    name: "SYNC_INDEX",
    similes: [
        "rebalance index",
        "sync portfolio to index",
        "match index allocation",
        "update index positions",
        "rebalance portfolio",
        "sync to spmc index"
    ],
    description: "Manually sync the portfolio to match the index allocations",
    
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        logger.debug("syncIndexAction: Validating sync index request");
        
        // Check if index trading is enabled
        const indexEnabled = runtime.getSetting("INDEX_TRADING_ENABLED") === 'true';
        if (!indexEnabled) {
            logger.debug("syncIndexAction: Index trading is not enabled");
            return false;
        }

        // Check if this is about syncing the index
        const text = message.content.text?.toLowerCase() || '';
        const keywords = ["sync", "rebalance", "index", "allocation", "match", "update positions"];
        
        const hasKeyword = keywords.some(keyword => text.includes(keyword));
        
        return hasKeyword;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: { [key: string]: any },
        callback?: HandlerCallback
    ): Promise<void> => {
        logger.info("syncIndexAction: Starting index sync");

        try {
            // Get the index trading service
            const service = IndexTradingService.getInstance();
            
            // Execute manual rebalance
            logger.info("syncIndexAction: Executing manual rebalance");
            const success = await service.manualRebalance();

            if (success) {
                // Get updated status
                const status = await service.getIndexStatus();
                
                let responseText = `✅ Successfully synced portfolio to index allocations!\n\n`;
                responseText += `📊 Portfolio Summary:\n`;
                responseText += `• Total Value: $${status.portfolioValue?.toFixed(2) || '0.00'}\n`;
                responseText += `• USDC Balance: $${status.usdcBalance?.toFixed(2) || '0.00'}\n`;
                responseText += `• Position Count: ${status.positionCount || 0}\n`;
                responseText += `• Tracking Error: ${status.trackingError?.toFixed(2) || '0.00'}%\n\n`;

                // Show top allocations
                if (status.allocations && status.allocations.length > 0) {
                    responseText += `Top Allocations:\n`;
                    const topAllocations = status.allocations
                        .slice(0, 5)
                        .map((a: any) => {
                            const sign = a.delta > 0 ? '+' : '';
                            return `• ${a.marketId.substring(0, 8)}: $${a.current.toFixed(2)} → $${a.target.toFixed(2)} (${sign}$${a.delta.toFixed(2)})`;
                        });
                    responseText += topAllocations.join('\n');
                }

                if (callback) {
                    await callback({
                        text: responseText
                    });
                }
            } else {
                if (callback) {
                    await callback({
                        text: "❌ Failed to sync index. The portfolio may already be balanced or there might be an issue with the index service. Please check the logs for details."
                    });
                }
            }

        } catch (error) {
            logger.error(`syncIndexAction: Error syncing index: ${error}`);
            
            if (callback) {
                await callback({
                    text: `❌ Error syncing index: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }
    },

    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "sync the portfolio to the index" }
            },
            {
                name: "{{agentName}}",
                content: { 
                    text: "I'll sync the portfolio to match the index allocations now.",
                    action: "SYNC_INDEX"
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "rebalance to match the spmc index" }
            },
            {
                name: "{{agentName}}",
                content: { 
                    text: "Starting index rebalancing to match the SPMC index allocations.",
                    action: "SYNC_INDEX"
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "please update my positions to follow the index" }
            },
            {
                name: "{{agentName}}",
                content: { 
                    text: "I'll update your positions to follow the index allocation now.",
                    action: "SYNC_INDEX"
                }
            }
        ]
    ]
};