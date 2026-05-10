import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { discoverServerTools } from "./discover.js";
import { loadMcpConfig } from "./config.js";
import {
    clearRegistry,
    updateServerHealth,
    upsertServer,
    type McpClientLike,
    type RegisteredServer,
    type ServerTransportType
} from "../registry/tools.js";
import { log } from "../utils/logger.js";

type ConnectedServer = {
    client: McpClientLike;
    transport: unknown;
};

export async function connectAllServers() {
    clearRegistry();
    const config = loadMcpConfig();

    for (const server of config.servers) {
        updateServerHealth(server.name, {
            name: server.name,
            transport: server.type,
            status: "connecting",
            tools: 0,
            ...(server.url ? { url: server.url } : {}),
            ...(server.command ? { command: server.command } : {})
        });

        log("BOOT", `connecting ${server.name}`, {
            transport: server.type,
            ...(server.url ? { url: server.url } : {}),
            ...(server.command ? { command: server.command, args: server.args } : {})
        });

        try {
            const { client, transport } = await connectServer(server);
            await client.connect(transport);
            upsertServer(server, client);
            await discoverServerTools(server, client);
            log("BOOT", `connected ${server.name}`);
        } catch (error) {
            updateServerHealth(server.name, {
                status: "error",
                lastError: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    return config.servers;
}

export async function disconnectAllServers() {
    for (const [serverName, client] of (await import("../registry/tools.js")).mcpClients) {
        try {
            await client.close();
            updateServerHealth(serverName, { status: "disconnected" });
            log("BOOT", `disconnected ${serverName}`);
        } catch (error) {
            updateServerHealth(serverName, {
                status: "error",
                lastError: error instanceof Error ? error.message : String(error)
            });
            log("BOOT", `failed to disconnect ${serverName}`, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}

async function connectServer(server: RegisteredServer): Promise<ConnectedServer> {
    switch (server.type) {
        case "stdio":
            return connectStdio(server);
        case "remote":
            return connectRemote(server);
        case "sse":
            return connectSse(server);
        default:
            throw new Error(`Unsupported MCP transport: ${String(server.type)}`);
    }
}

function connectStdio(server: RegisteredServer): ConnectedServer {
    if (!server.command) {
        throw new Error(`Stdio server ${server.name} is missing command`);
    }

    const env = server.env
        ? Object.fromEntries(
            Object.entries(server.env).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string"
            )
        )
        : undefined;

    const transport = new StdioClientTransport({
        command: server.command,
        args: server.args ?? [],
        ...(server.cwd ? { cwd: server.cwd } : {}),
        ...(env ? { env } : {}),
        stderr: "pipe"
    });

    attachStderrLogger(server.name, transport);
    return { client: createClient(), transport };
}

function connectRemote(server: RegisteredServer): ConnectedServer {
    if (!server.url) {
        throw new Error(`Remote server ${server.name} is missing url`);
    }

    const transport = new StreamableHTTPClientTransport(new URL(server.url), {
        requestInit: {
            headers: server.headers ?? {}
        }
    });

    return { client: createClient(), transport };
}

function connectSse(server: RegisteredServer): ConnectedServer {
    if (!server.url) {
        throw new Error(`SSE server ${server.name} is missing url`);
    }

    const headers = server.headers ?? {};
    const transport = new SSEClientTransport(new URL(server.url), {
        requestInit: {
            headers
        },
        eventSourceInit: {
            fetch: (input, init) => {
                const mergedHeaders = new Headers(init?.headers);

                for (const [key, value] of Object.entries(headers)) {
                    mergedHeaders.set(key, value);
                }

                return fetch(input, {
                    ...init,
                    headers: mergedHeaders
                });
            }
        }
    });

    return { client: createClient(), transport };
}

function createClient(): McpClientLike {
    return new Client({
        name: "runtime-mcp-orchestrator",
        version: "1.0.0"
    }) as McpClientLike;
}

function attachStderrLogger(serverName: string, transport: StdioClientTransport) {
    transport.stderr?.on("data", chunk => {
        const stderr = chunk.toString().trim();

        if (stderr.length > 0) {
            log("MCP", `${serverName} stderr`, { stderr });
        }
    });
}
