import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RegisteredServer } from "../registry/tools.js";

type RawConfig = {
    servers?: Array<{
        name: string;
        type: "stdio" | "remote" | "sse";
        command?: string;
        args?: string[];
        cwd?: string;
        url?: string;
        headers?: Record<string, string>;
    }>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");
const projectRoot = path.resolve(backendRoot, "..");    
const configPath = path.join(backendRoot, "mcp.config.json");

export function loadMcpConfig(): { servers: RegisteredServer[] } {
    const rawFile = fs.readFileSync(configPath, "utf-8");
    const rawConfig = JSON.parse(rawFile) as RawConfig;

    return {
        servers: (rawConfig.servers ?? []).map(server => ({
            name: server.name,
            type: server.type,
            ...(server.command ? { command: server.command } : {}),
            ...(server.args ? { args: server.args } : {}),
            ...(server.cwd ? { cwd: resolveRelativeToProject(server.cwd) } : {}),
            ...(server.url ? { url: resolveEnvString(server.url) } : {}),
            ...(server.headers ? { headers: resolveHeaders(server.headers) } : {})
        }))
    };
}

function resolveHeaders(headers: Record<string, string>) {
    return Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key, resolveEnvString(value)])
    );
}

function resolveRelativeToProject(value: string) {
    if (path.isAbsolute(value)) {
        return value;
    }

    return path.resolve(projectRoot, value);
}

function resolveEnvString(value: string) {
    const interpolated = value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key: string) => {
        return process.env[key] ?? "";
    });

    if (process.env[interpolated]) {
        return process.env[interpolated] as string;
    }

    return interpolated;
}
