import type { AgentMessage, NormalizedToolCall } from "../llm/provider.js";
import type { MergedToolDefinition } from "../registry/tools.js";

export function toGeminiTools(tools: MergedToolDefinition[]) {
    return [
        {
            functionDeclarations: tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                parameters: sanitizeGeminiSchema(tool.inputSchema)
            }))
        }
    ];
}

export function toGeminiContents(messages: AgentMessage[]) {
    return messages.map(message => {
        if (message.role === "tool") {
            const parsedContent = tryParseJson(message.content);

            return {
                role: "user",
                parts: [
                    {
                        functionResponse: {
                            id: message.toolCallId,
                            name: message.name ?? "tool_result",
                            response: parsedContent ?? {
                                result: message.content
                            }
                        }
                    }
                ]
            };
        }

        if (message.role === "assistant" && message.toolCalls?.length) {
            return {
                role: "model",
                parts: [
                    ...(message.content ? [{ text: message.content }] : []),
                    ...message.toolCalls.map(toolCall => ({
                        functionCall: {
                            id: toolCall.id,
                            name: toolCall.name,
                            args: toolCall.input
                        }
                    }))
                ]
            };
        }

        return {
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }]
        };
    });
}

export function fromGeminiResponse(response: Record<string, any>): {
    assistantMessage: AgentMessage;
    toolCalls: NormalizedToolCall[];
    text?: string;
} {
    const candidate = response.candidates?.[0] ?? {};
    const parts = candidate.content?.parts ?? [];
    const toolCalls = parts
        .filter((part: Record<string, unknown>) => "functionCall" in part)
        .map((part: Record<string, any>, index: number) => ({
            id: String(part.functionCall?.id ?? `${part.functionCall?.name ?? "tool"}-${index}`),
            name: String(part.functionCall?.name),
            input: part.functionCall?.args ?? {}
        }));

    const text = parts
        .filter((part: Record<string, unknown>) => "text" in part)
        .map((part: Record<string, any>) => String(part.text ?? ""))
        .join("\n");

    const result: {
        assistantMessage: AgentMessage;
        toolCalls: NormalizedToolCall[];
        text?: string;
    } = {
        assistantMessage: {
            role: "assistant" as const,
            content: text,
            toolCalls
        },
        toolCalls,
        ...(toolCalls.length === 0 ? { text } : {})
    };

    return result;
}

function tryParseJson(value: string) {
    try {
        return JSON.parse(value) as Record<string, unknown>;
    } catch {
        return undefined;
    }
}

function sanitizeGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const entries = Object.entries(schema)
        .filter(([key]) => !DISALLOWED_SCHEMA_KEYS.has(key))
        .map(([key, value]) => [key, sanitizeGeminiValue(value)]);

    return Object.fromEntries(entries);
}

function sanitizeGeminiValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(item => sanitizeGeminiValue(item));
    }

    if (value && typeof value === "object") {
        return sanitizeGeminiSchema(value as Record<string, unknown>);
    }

    return value;
}

const DISALLOWED_SCHEMA_KEYS = new Set([
  'additionalProperties',
  '$schema',
  '$id',
  'examples',
  'default',
  'definitions',
  '$defs',
]);