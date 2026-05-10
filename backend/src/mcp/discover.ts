import { log } from "../utils/logger.js";
import type { McpClientLike, RegisteredServer } from "../registry/tools.js";
import {
    buildNamespacedToolName,
    updateServerHealth,
    upsertTool
} from "../registry/tools.js";

const EMPTY_SCHEMA = {
    type: "object",
    properties: {},
    additionalProperties: false
} satisfies Record<string, unknown>;

export async function discoverServerTools(
    server: RegisteredServer,
    client: McpClientLike
) {
    const startedAt = Date.now();
    const toolList = await client.listTools();
    const latencyMs = Date.now() - startedAt;

    for (const tool of toolList.tools as Array<Record<string, unknown>>) {
        const rawName = typeof tool.name === "string" ? tool.name : "";
        const description = typeof tool.description === "string"
            ? tool.description
            : "No description provided";
        const inputSchema = (
            typeof tool.inputSchema === "object" &&
            tool.inputSchema !== null
        )
            ? tool.inputSchema as Record<string, unknown>
            : EMPTY_SCHEMA;
        const outputSchema = (
            typeof tool.outputSchema === "object" &&
            tool.outputSchema !== null
        )
            ? tool.outputSchema as Record<string, unknown>
            : undefined;
        const annotations = (
            typeof tool.annotations === "object" &&
            tool.annotations !== null
        )
            ? tool.annotations
            : undefined;

        if (rawName.length === 0) {
            continue;
        }

        upsertTool({
            name: buildNamespacedToolName(server.name, rawName),
            rawName,
            server: server.name,
            transport: server.type,
            description,
            inputSchema,
            ...(outputSchema ? { outputSchema } : {}),
            ...(annotations ? { annotations } : {})
        });
    }

    updateServerHealth(server.name, {
        name: server.name,
        transport: server.type,
        status: "connected",
        tools: toolList.tools.length,
        latencyMs
    });

    log("TOOLS", `discovered ${toolList.tools.length} tools from ${server.name}`, {
        latencyMs
    });

    return toolList.tools;
}
