import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    logger
} from "@elizaos/core";
import { IndexTradingService } from "../services/IndexTradingService";

export const indexStatusAction: Action = {
    name: "INDEX_STATUS",
    similes: [
        "show index status",
        "check index allocation",
        "index tracking error",
        "how is the index doing",
        "show index positions",
        "index portfolio status"
    ],
    description: "Check the current index allocation status and tracking error",
    
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        logger.debug("indexStatusAction: Validating index status request");
        
        // Check if index trading is enabled
        const indexEnabled = runtime.getSetting("INDEX_TRADING_ENABLED") === 'true';
        if (!indexEnabled) {
            logger.debug("indexStatusAction: Index trading is not enabled");
            return false;
        }

        // Check if this is about index status
        const text = message.content.text?.toLowerCase() || '';
        const keywords = ["index", "status", "allocation", "tracking", "error", "positions", "rebalance"];
        
        const hasKeyword = keywords.some(keyword => text.includes(keyword));
        const isQuestion = text.includes("?") || text.includes("how") || text.includes("what") || text.includes("show");
        
        return hasKeyword && isQuestion;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: { [key: string]: any },
        callback?: HandlerCallback
    ): Promise<void> => {
        logger.info("indexStatusAction: Getting index status");

        try {
            // Get the index trading service
            const service = IndexTradingService.getInstance();
            
            // Get index status
            logger.info("indexStatusAction: Fetching index status");
            const status = await service.getIndexStatus();

            if (status.error) {
                if (callback) {
                    await callback({
                        text: `❌ Error getting index status: ${status.error}`
                    });
                }
                return;
            }

            // Format the response
            let responseText = `📊 **Index Trading Status**\n\n`;
            
            // Basic info
            responseText += `**Configuration:**\n`;
            responseText += `• Status: ${status.enabled ? (status.paused ? '⏸️ Paused' : '✅ Active') : '❌ Disabled'}\n`;
            responseText += `• Index ID: ${status.indexId}\n`;
            responseText += `• Next Rebalance: ${status.nextRebalance}\n\n`;

            // Portfolio metrics
            responseText += `**Portfolio Metrics:**\n`;
            responseText += `• Total Value: $${status.portfolioValue?.toFixed(2) || '0.00'}\n`;
            responseText += `• USDC Balance: $${status.usdcBalance?.toFixed(2) || '0.00'}\n`;
            responseText += `• Active Positions: ${status.positionCount || 0}\n`;
            responseText += `• Tracking Error: ${status.trackingError?.toFixed(2) || '0.00'}%\n`;
            responseText += `• Needs Rebalance: ${status.needsRebalance ? '⚠️ Yes' : '✅ No'}\n\n`;

            // Show allocation details
            if (status.allocations && status.allocations.length > 0) {
                responseText += `**Current Allocations:**\n`;
                
                // Show positions that need action
                const actionNeeded = status.allocations.filter((a: any) => a.action !== 'HOLD');
                const holding = status.allocations.filter((a: any) => a.action === 'HOLD');
                
                if (actionNeeded.length > 0) {
                    responseText += `\n⚠️ Positions needing adjustment:\n`;
                    actionNeeded.slice(0, 5).forEach((a: any) => {
                        const sign = a.delta > 0 ? '+' : '';
                        const emoji = a.action === 'BUY' ? '🟢' : '🔴';
                        responseText += `${emoji} ${a.marketId.substring(0, 8)}: `;
                        responseText += `$${a.current.toFixed(2)} → $${a.target.toFixed(2)} `;
                        responseText += `(${sign}$${a.delta.toFixed(2)})\n`;
                    });
                    if (actionNeeded.length > 5) {
                        responseText += `... and ${actionNeeded.length - 5} more\n`;
                    }
                }
                
                if (holding.length > 0) {
                    responseText += `\n✅ Balanced positions: ${holding.length}\n`;
                }
            } else {
                responseText += `No positions currently held.\n`;
            }

            // Add recommendation
            if (status.needsRebalance) {
                responseText += `\n💡 **Recommendation:** The portfolio has drifted from target allocations. `;
                responseText += `Consider running 'sync index' to rebalance.`;
            } else {
                responseText += `\n✅ **Status:** Portfolio is well-balanced with the index.`;
            }

            if (callback) {
                await callback({
                    text: responseText
                });
            }

        } catch (error) {
            logger.error(`indexStatusAction: Error getting index status: ${error}`);
            
            if (callback) {
                await callback({
                    text: `❌ Error getting index status: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }
    },

    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "show me the index status" }
            },
            {
                name: "{{agentName}}",
                content: { 
                    text: "Let me check the current index allocation status for you.",
                    action: "INDEX_STATUS"
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "what's the tracking error?" }
            },
            {
                name: "{{agentName}}",
                content: { 
                    text: "I'll check the current tracking error and index status.",
                    action: "INDEX_STATUS"
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "how are my index positions doing?" }
            },
            {
                name: "{{agentName}}",
                content: { 
                    text: "Let me show you the current index portfolio status and allocations.",
                    action: "INDEX_STATUS"
                }
            }
        ]
    ]
};