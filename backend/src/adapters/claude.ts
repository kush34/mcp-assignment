import type { AgentMessage, NormalizedToolCall } from "../llm/provider.js";
import type { MergedToolDefinition } from "../registry/tools.js";

export function toClaudeTools(tools: MergedToolDefinition[]) {
    return tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema
    }));
}

export function toClaudeMessages(messages: AgentMessage[]) {
    return messages.map(message => {
        if (message.role === "tool") {
            return {
                role: "user",
                content: [
                    {
                        type: "tool_result",
                        tool_use_id: message.toolCallId,
                        content: message.content
                    }
                ]
            };
        }

        if (message.role === "assistant" && message.toolCalls) {
            return {
                role: "assistant",
                content: [
                    ...(message.content
                        ? [{ type: "text", text: message.content }]
                        : []),
                    ...message.toolCalls.map(toolCall => ({
                        type: "tool_use",
                        id: toolCall.id,
                        name: toolCall.name,
                        input: toolCall.input
                    }))
                ]
            };
        }

        return {
            role: message.role,
            content: message.content
        };
    });
}

export function fromClaudeResponse(response: Record<string, any>): {
    assistantMessage: AgentMessage;
    toolCalls: NormalizedToolCall[];
    text?: string;
} {
    const content = Array.isArray(response.content) ? response.content : [];
    const toolCalls = content
        .filter((item: Record<string, unknown>) => item.type === "tool_use")
        .map((item: Record<string, any>) => ({
            id: String(item.id),
            name: String(item.name),
            input: item.input ?? {}
        }));

    const text = content
        .filter((item: Record<string, unknown>) => item.type === "text")
        .map((item: Record<string, any>) => String(item.text ?? ""))
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
