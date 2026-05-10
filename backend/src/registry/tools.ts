export type JsonSchema = Record<string, unknown>;

export type ToolAnnotations = {
    title?: string;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    readOnlyHint?: boolean;
} | undefined;

export type RegisteredTool = {
    name: string;
    server: string;
    description: string;
    inputSchema: JsonSchema;
    outputSchema?: JsonSchema;
    annotations?: ToolAnnotations;
};

export type RegisteredServer = {
    name: string;
    command: string;
    args: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
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

export function upsertTool(tool: RegisteredTool) {
    toolRegistry.set(tool.name, tool);
}

export function upsertServer(server: RegisteredServer, client: McpClientLike) {
    serverRegistry.set(server.name, server);
    mcpClients.set(server.name, client);
}

export function clearRegistry() {
    toolRegistry.clear();
    mcpClients.clear();
    serverRegistry.clear();
}

export function getLLMTools(): MergedToolDefinition[] {
    return [...toolRegistry.values()].map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
    }));
}
