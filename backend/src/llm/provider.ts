import { fromClaudeResponse, toClaudeMessages, toClaudeTools } from "../adapters/claude.js";
import { fromGeminiResponse, toGeminiContents, toGeminiTools } from "../adapters/gemini.js";
import { fromOpenAIResponse, toOpenAIMessages, toOpenAITools } from "../adapters/openai.js";
import type { MergedToolDefinition } from "../registry/tools.js";
import { loadEnv } from "../utils/env.js";
import { log } from "../utils/logger.js";

export type NormalizedToolCall = {
    id: string;
    name: string;
    input: Record<string, unknown>;
};

export type AgentMessage = {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    toolCallId?: string;
    toolCalls?: NormalizedToolCall[];
    name?: string;
};

export type LlmTurnResponse = {
    assistantMessage: AgentMessage;
    toolCalls: NormalizedToolCall[];
    text?: string;
};

export type ChatRequest = {
    messages: AgentMessage[];
    tools: MergedToolDefinition[];
};

export interface LlmProvider {
    readonly provider: string;
    chat(request: ChatRequest): Promise<LlmTurnResponse>;
}

class OpenAIProvider implements LlmProvider {
    readonly provider = "openai";

    async chat(request: ChatRequest): Promise<LlmTurnResponse> {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error("OPENAI_API_KEY is not set");
        }

        const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: toOpenAIMessages(request.messages),
                tools: toOpenAITools(request.tools),
                tool_choice: "auto"
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI request failed with ${response.status}`);
        }

        const payload = await response.json();
        return fromOpenAIResponse(payload);
    }
}

class ClaudeProvider implements LlmProvider {
    readonly provider = "claude";

    async chat(request: ChatRequest): Promise<LlmTurnResponse> {
        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (!apiKey) {
            throw new Error("ANTHROPIC_API_KEY is not set");
        }

        const model = process.env.ANTHROPIC_MODEL ?? "claude-3-7-sonnet-latest";
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model,
                max_tokens: 1024,
                messages: toClaudeMessages(request.messages.filter(message => message.role !== "system")),
                tools: toClaudeTools(request.tools),
                system: request.messages
                    .filter(message => message.role === "system")
                    .map(message => message.content)
                    .join("\n")
            })
        });

        if (!response.ok) {
            throw new Error(`Anthropic request failed with ${response.status}`);
        }

        const payload = await response.json();
        return fromClaudeResponse(payload);
    }
}

class GeminiProvider implements LlmProvider {
    readonly provider = "gemini";

    async chat(request: ChatRequest): Promise<LlmTurnResponse> {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not set");
        }

        const model = normalizeGeminiModel(
            process.env.GEMINI_MODEL ?? "gemini-2.5-pro"
        );
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: request.messages
                            .filter(message => message.role === "system")
                            .map(message => ({ text: message.content }))
                    },
                    contents: toGeminiContents(request.messages.filter(message => message.role !== "system")),
                    tools: toGeminiTools(request.tools)
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Gemini request failed with ${response.status}: ${errorText}`
            );
        }

        const payload = await response.json();
        return fromGeminiResponse(payload);
    }
}

class MockProvider implements LlmProvider {
    readonly provider = "mock";

    async chat(): Promise<LlmTurnResponse> {
        return {
            assistantMessage: {
                role: "assistant",
                content: "No LLM provider configured. Set LLM_PROVIDER plus provider API credentials."
            },
            toolCalls: [],
            text: "No LLM provider configured. Set LLM_PROVIDER plus provider API credentials."
        };
    }
}

export function createProvider(): LlmProvider {
    loadEnv();

    const configuredProvider = process.env.LLM_PROVIDER?.toLowerCase();
    const provider = configuredProvider
        ?? detectProviderFromEnvironment()
        ?? "mock";

    log("LLM", `using provider ${provider}`);

    switch (provider) {
        case "openai":
            return new OpenAIProvider();
        case "claude":
        case "anthropic":
            return new ClaudeProvider();
        case "gemini":
            return new GeminiProvider();
        default:
            return new MockProvider();
    }
}

function detectProviderFromEnvironment() {
    if (process.env.GEMINI_API_KEY || process.env.GEMINI_MODEL) {
        return "gemini";
    }

    if (process.env.OPENAI_API_KEY || process.env.OPENAI_MODEL) {
        return "openai";
    }

    if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_MODEL) {
        return "claude";
    }

    return undefined;
}

function normalizeGeminiModel(model: string) {
    return model
        .trim()
        .replace(/^models\//, "")
        .replace(/:generateContent$/, "");
}
