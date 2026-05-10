import { mcpClients, toolRegistry } from "../registry/tools.js";
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
    const rawResult = await withTimeout(
        client.callTool({
            name: toolUse.name,
            arguments: toolUse.input
        }),
        timeoutMs,
        `Tool ${toolUse.name}`
    );
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
