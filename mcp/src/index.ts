import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";

const main = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stdin.resume();

    const keepAlive = setInterval(() => {
        // Keep the stdio server process alive while the parent keeps the pipe open.
    }, 1 << 30);

    const shutdown = () => {
        clearInterval(keepAlive);
    };

    process.stdin.on("close", shutdown);
    process.stdin.on("end", shutdown);
};

main().catch((error: unknown) => {
    console.error("Server error:", error);
    process.exit(1);
});
