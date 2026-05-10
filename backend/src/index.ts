import express from "express";
import { RuntimeMcpOrchestrator } from "./agent.js";
import { startRuleCacheRefresh } from "./control-plane/cache.js";
import "./db/index.js";
import { governanceRouter } from "./routes/governance.js";
import { loadEnv } from "./utils/env.js";
import { log } from "./utils/logger.js";

loadEnv();

const app = express();
const orchestrator = new RuntimeMcpOrchestrator();

app.use(express.json());
app.use(governanceRouter);

app.get("/health", (_request, response) => {
    response.json({
        ok: true
    });
});

app.post("/agent", async (request, response) => {
    const message = request.body?.message;
    const conversationId = typeof request.body?.conversationId === "string"
        ? request.body.conversationId
        : undefined;

    if (typeof message !== "string" || message.trim().length === 0) {
        response.status(400).json({
            success: false,
            error: "Request body must include a non-empty string message"
        });
        return;
    }

    try {
        const result = await orchestrator.runAgent(message, conversationId);

        response.json({
            success: true,
            conversationId: result.conversationId,
            text: result.text
        });
    } catch (error) {
        response.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

const port = Number(process.env.PORT ?? 3000);
startRuleCacheRefresh();

orchestrator.boot()
    .then(() => {
        app.listen(port, () => {
            log("HTTP", `runtime MCP orchestrator listening on ${port}`);
        });
    })
    .catch(error => {
        log("BOOT", "failed to boot orchestrator", {
            error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
    });
