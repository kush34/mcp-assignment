import { log } from "../utils/logger.js";
import type { McpClientLike, RegisteredServer } from "../registry/tools.js";
import { upsertTool } from "../registry/tools.js";

const EMPTY_SCHEMA = {
    type: "object",
    properties: {},
    additionalProperties: false
} satisfies Record<string, unknown>;

export async function discoverServerTools(
    server: RegisteredServer,
    client: McpClientLike
) {
    const toolList = await client.listTools();

    for (const tool of toolList.tools as Array<Record<string, unknown>>) {
        const name = typeof tool.name === "string" ? tool.name : "";
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

        if (name.length === 0) {
            continue;
        }

        const registeredTool = {
            name,
            server: server.name,
            description,
            inputSchema,
            ...(outputSchema ? { outputSchema } : {}),
            ...(annotations ? { annotations } : {})
        };

        upsertTool(registeredTool);
    }

    log("TOOLS", `discovered ${toolList.tools.length} tools from ${server.name}`);

    return toolList.tools;
}
