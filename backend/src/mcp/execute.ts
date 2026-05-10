import { mcpClients, toolRegistry, type McpClientLike } from "../registry/tools.js";
import type { ToolUseRequest } from "../policy/engine.js";
import { withTimeout } from "../utils/timeout.js";

export type ToolExecutionResult = {
    success: boolean;
    tool: string;
    server: string;
    durationMs: number;
    structuredContent?: unknown;
    content?: unknown;
    isError?: boolean;
    error?: string;
};

const DEFAULT_TOOL_TIMEOUT_MS = 10_000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 250;

export async function executeTool(
    toolUse: ToolUseRequest,
    timeoutMs = DEFAULT_TOOL_TIMEOUT_MS
): Promise<ToolExecutionResult> {
    const tool = toolRegistry.get(toolUse.name);

    if (!tool) {
        throw new Error(`Unknown tool: ${toolUse.name}`);
    }

    const client = mcpClients.get(tool.server);

    if (!client) {
        throw new Error(`No MCP client connected for server: ${tool.server}`);
    }

    const startedAt = Date.now();
    const retryable = isRetrySafe(tool);
    const rawResult = await callToolWithRetry({
        client,
        toolUse,
        rawName: tool.rawName,
        timeoutMs,
        maxAttempts: retryable ? MAX_RETRY_ATTEMPTS : 1
    });
    const durationMs = Date.now() - startedAt;

    const result: ToolExecutionResult = {
        success: rawResult.isError !== true,
        tool: toolUse.name,
        server: tool.server,
        durationMs,
        ...(rawResult.structuredContent !== undefined
            ? { structuredContent: rawResult.structuredContent }
            : {}),
        ...(rawResult.content !== undefined
            ? { content: rawResult.content }
            : {}),
        ...(rawResult.isError !== undefined
            ? { isError: rawResult.isError === true }
            : {}),
        ...(rawResult.isError === true
            ? {
                error: JSON.stringify(
                    rawResult.content ?? rawResult.structuredContent ?? rawResult
                )
            }
            : {})
    };

    return result;
}

async function callToolWithRetry(input: {
    client: McpClientLike;
    toolUse: ToolUseRequest;
    rawName: string;
    timeoutMs: number;
    maxAttempts: number;
}) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
        try {
            return await withTimeout(
                input.client.callTool({
                    name: input.rawName,
                    arguments: input.toolUse.input
                }),
                input.timeoutMs,
                `Tool ${input.toolUse.name}`
            );
        } catch (error) {
            lastError = error;

            if (!isRetryableTransportError(error) || attempt === input.maxAttempts) {
                break;
            }

            await sleepWithBackoff(attempt);
        }
    }

    throw decorateToolError(input.toolUse.name, lastError, input.maxAttempts);
}

function isRetrySafe(tool: NonNullable<ReturnType<typeof toolRegistry.get>>) {
    return tool.annotations?.idempotentHint === true || tool.annotations?.readOnlyHint === true;
}

function isRetryableTransportError(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }

    return /timed out|transport|socket|econnreset|network|broken pipe|closed/i.test(error.message);
}

async function sleepWithBackoff(attempt: number) {
    const delayMs = RETRY_BACKOFF_MS * (2 ** (attempt - 1));
    await new Promise(resolve => setTimeout(resolve, delayMs));
}

function decorateToolError(toolName: string, error: unknown, attempts: number) {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(
        `Tool ${toolName} failed after ${attempts} attempt${attempts === 1 ? "" : "s"}: ${message}`
    );
}
