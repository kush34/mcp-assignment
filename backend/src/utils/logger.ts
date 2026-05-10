type LogLevel = "BOOT" | "TOOLS" | "LLM" | "POLICY" | "MCP" | "HTTP";

export function log(level: LogLevel, message: string, detail?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();

    if (detail && Object.keys(detail).length > 0) {
        console.log(`[${timestamp}] [${level}] ${message}`, detail);
        return;
    }

    console.log(`[${timestamp}] [${level}] ${message}`);
}
