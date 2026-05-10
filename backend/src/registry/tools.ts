export type JsonSchema = Record<string, unknown>;

export type ToolAnnotations = {
    title?: string;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    readOnlyHint?: boolean;
} | undefined;

export type ServerTransportType = "stdio" | "remote" | "sse";

export type RegisteredTool = {
    name: string;
    rawName: string;
    server: string;
    transport: ServerTransportType;
    description: string;
    inputSchema: JsonSchema;
    outputSchema?: JsonSchema;
    annotations?: ToolAnnotations;
};

export type RegisteredServer = {
    name: string;
    type: ServerTransportType;
    command?: string;
    args?: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    url?: string;
    headers?: Record<string, string>;
};

export type ServerHealth = {
    name: string;
    transport: ServerTransportType;
    status: "connecting" | "connected" | "disconnected" | "error";
    tools: number;
    latencyMs?: number;
    lastError?: string;
    url?: string;
    command?: string;
};

export type MergedToolDefinition = {
    name: string;
    description: string;
    inputSchema: JsonSchema;
};

export type McpClientLike = {
    listTools: (params?: Record<string, unknown>) => Promise<{
        tools: Array<Record<string, unknown>>;
    }>;
    callTool: (params: {
        name: string;
        arguments?: Record<string, unknown>;
    }) => Promise<Record<string, any>>;
    connect: (transport: unknown) => Promise<void>;
    close: () => Promise<void>;
};

export const toolRegistry = new Map<string, RegisteredTool>();
export const mcpClients = new Map<string, McpClientLike>();
export const serverRegistry = new Map<string, RegisteredServer>();
export const serverHealthRegistry = new Map<string, ServerHealth>();

export function buildNamespacedToolName(serverName: string, toolName: string) {
    return `${serverName}.${toolName}`;
}

export function upsertTool(tool: RegisteredTool) {
    toolRegistry.set(tool.name, tool);
}

export function upsertServer(server: RegisteredServer, client: McpClientLike) {
    serverRegistry.set(server.name, server);
    mcpClients.set(server.name, client);
}

export function updateServerHealth(name: string, health: Partial<ServerHealth>) {
    const existing = serverHealthRegistry.get(name);
    const base: ServerHealth = existing ?? {
        name,
        transport: "stdio",
        status: "disconnected",
        tools: 0
    };

    serverHealthRegistry.set(name, {
        ...base,
        ...health
    });
}

export function clearRegistry() {
    toolRegistry.clear();
    mcpClients.clear();
    serverRegistry.clear();
    serverHealthRegistry.clear();
}

export function getLLMTools(): MergedToolDefinition[] {
    return [...toolRegistry.values()].map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
    }));
}

export function listServerHealth() {
    return [...serverHealthRegistry.values()].sort((left, right) =>
        left.name.localeCompare(right.name)
    );
}
