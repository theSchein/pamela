import { Content, ActionResult } from "@elizaos/core";

/**
 * Converts a Content object to an ActionResult object
 * This is a compatibility helper for the polymarket plugin
 */
export function contentToActionResult(
  content: Content,
  success: boolean = true,
): ActionResult {
  return {
    text: content.text || "",
    success,
    data: content,
    values: {
      success,
      ...(content.values || {}),
    },
  };
}

/**
 * Creates an error ActionResult
 */
export function createErrorResult(
  error: string | Error,
  data?: any,
): ActionResult {
  const errorMessage = error instanceof Error ? error.message : error;
  return {
    text: `Error: ${errorMessage}`,
    success: false,
    error: error instanceof Error ? error : new Error(errorMessage),
    data: data || {},
    values: {
      success: false,
      error: errorMessage,
    },
  };
}
