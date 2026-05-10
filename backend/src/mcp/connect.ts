import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "../../../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../../../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";
import { discoverServerTools } from "./discover.js";
import {
    clearRegistry,
    upsertServer,
    type McpClientLike,
    type RegisteredServer
} from "../registry/tools.js";
import { log } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

export const defaultServers: RegisteredServer[] = [
    {
        name: "filesystem",
        command: "node",
        args: ["dist/index.js"],
        cwd: path.resolve(projectRoot, "mcp")
    }
];

function createClient(server: RegisteredServer): {
    client: McpClientLike;
    transport: StdioClientTransport;
} {
    const env = server.env
        ? Object.fromEntries(
            Object.entries(server.env).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string"
            )
        )
        : undefined;

    const transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
        ...(server.cwd ? { cwd: server.cwd } : {}),
        ...(env ? { env } : {}),
        stderr: "pipe"
    });

    const client = new Client({
        name: "runtime-mcp-orchestrator",
        version: "1.0.0"
    });

    transport.stderr?.on("data", chunk => {
        const stderr = chunk.toString().trim();

        if (stderr.length > 0) {
            log("MCP", `${server.name} stderr`, { stderr });
        }
    });

    return {
        client: client as McpClientLike,
        transport
    };
}

export async function connectAllServers(servers = defaultServers) {
    clearRegistry();

    for (const server of servers) {
        log("BOOT", `connecting ${server.name}`, {
            command: server.command,
            args: server.args
        });

        const { client, transport } = createClient(server);

        await client.connect(transport);
        upsertServer(server, client);
        await discoverServerTools(server, client);

        log("BOOT", `connected ${server.name}`);
    }

    return servers;
}

export async function disconnectAllServers() {
    for (const [serverName, client] of (await import("../registry/tools.js")).mcpClients) {
        try {
            await client.close();
            log("BOOT", `disconnected ${serverName}`);
        } catch (error) {
            log("BOOT", `failed to disconnect ${serverName}`, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}
