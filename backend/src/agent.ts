import crypto from "node:crypto";
import { createLog } from "./control-plane/logs.js";
import { createProvider, type AgentMessage, type LlmProvider } from "./llm/provider.js";
import { connectAllServers } from "./mcp/connect.js";
import { executeTool } from "./mcp/execute.js";
import { policyEngine, type ToolUseRequest } from "./policy/engine.js";
import { getLLMTools } from "./registry/tools.js";

const BASE_SYSTEM_PROMPT = [
    "You are a runtime MCP orchestrator.",
    `Today's date is ${new Date().toISOString().split("T")[0]}.`,
    "Use tools when needed.",
    "If a tool is denied, adjust your plan and continue.",
    "Use the live tool schemas provided at runtime.",
    "For ANY sports scores, live events, news, or real-time data, you MUST use tools. Do NOT answer from memory.",
    "Do not claim a current fact unless the latest tool output clearly supports it.",
    "If tool results are conflicting, noisy, or stale, say that explicitly instead of guessing."
].join(" ");

export class RuntimeMcpOrchestrator {
    private readonly llm: LlmProvider;
    private booted = false;

    constructor(llm = createProvider()) {
        this.llm = llm;
    }

    async boot() {
        if (this.booted) {
            return;
        }

        await connectAllServers();
        this.booted = true;
    }

    async runAgent(userMessage: string, conversationId: string = crypto.randomUUID()) {
        if (!this.booted) {
            await this.boot();
        }

        createLog({
            conversationId,
            type: "user_message",
            payload: {
                message: userMessage
            }
        });

        const messages: AgentMessage[] = [
            {
                role: "system",
                content: buildSystemPrompt(userMessage)
            },
            {
                role: "user",
                content: userMessage
            }
        ];

        while (true) {
            const response = await this.llm.chat({
                messages,
                tools: getLLMTools()
            });

            messages.push(response.assistantMessage);

            createLog({
                conversationId,
                type: "assistant_message",
                payload: {
                    message: response.assistantMessage.content,
                    toolCalls: response.toolCalls
                }
            });

            if (response.toolCalls.length === 0) {
                return {
                    conversationId,
                    text: response.text ?? response.assistantMessage.content
                };
            }

            for (const toolUse of response.toolCalls) {
                createLog({
                    conversationId,
                    type: "tool_call",
                    payload: {
                        tool: toolUse.name,
                        arguments: toolUse.input
                    }
                });

                const decision = await policyEngine({
                    conversationId,
                    toolUse
                });

                if (decision.status === "deny") {
                    messages.push({
                        role: "tool",
                        toolCallId: toolUse.id,
                        name: toolUse.name,
                        content: JSON.stringify({
                            success: false,
                            denied: true,
                            reason: decision.reason
                        })
                    });

                    continue;
                }

                const result = await this.handleToolUse(toolUse);

                createLog({
                    conversationId,
                    type: "tool_result",
                    payload: result
                });

                messages.push({
                    role: "tool",
                    toolCallId: toolUse.id,
                    name: toolUse.name,
                    content: JSON.stringify(result)
                });
            }
        }
    }

    private async handleToolUse(toolUse: ToolUseRequest) {
        try {
            return await executeTool(toolUse);
        } catch (error) {
            return {
                success: false,
                tool: toolUse.name,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

export async function runAgent(userMessage: string, conversationId?: string) {
    const orchestrator = new RuntimeMcpOrchestrator();
    return conversationId
        ? orchestrator.runAgent(userMessage, conversationId)
        : orchestrator.runAgent(userMessage);
}

function buildSystemPrompt(userMessage: string) {
    if (!isTimeSensitiveQuery(userMessage)) {
        return BASE_SYSTEM_PROMPT;
    }

    return [
        BASE_SYSTEM_PROMPT,
        "This request is time-sensitive.",
        "You must base the answer on tool evidence only.",
        "Prefer the freshest timestamps or clearly live sources.",
        "If the fetched data does not confirm the exact live score, say that you cannot verify the live score yet."
    ].join(" ");
}

function isTimeSensitiveQuery(userMessage: string) {
    return /\b(today|latest|current|live|score|now|breaking|price|news)\b/i.test(userMessage);
}
