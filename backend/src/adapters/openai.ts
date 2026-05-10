import type { AgentMessage, NormalizedToolCall } from "../llm/provider.js";
import type { MergedToolDefinition } from "../registry/tools.js";

export function toOpenAITools(tools: MergedToolDefinition[]) {
    return tools.map(tool => ({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
        }
    }));
}

export function toOpenAIMessages(messages: AgentMessage[]) {
    return messages.map(message => {
        if (message.role === "tool") {
            return {
                role: "tool",
                tool_call_id: message.toolCallId,
                content: message.content
            };
        }

        if (message.role === "assistant" && message.toolCalls) {
            return {
                role: "assistant",
                content: message.content,
                tool_calls: message.toolCalls.map(toolCall => ({
                    id: toolCall.id,
                    type: "function",
                    function: {
                        name: toolCall.name,
                        arguments: JSON.stringify(toolCall.input)
                    }
                }))
            };
        }

        return {
            role: message.role,
            content: message.content
        };
    });
}

export function fromOpenAIResponse(response: Record<string, any>): {
    assistantMessage: AgentMessage;
    toolCalls: NormalizedToolCall[];
    text?: string;
} {
    const message = response.choices?.[0]?.message ?? {};
    const toolCalls = (message.tool_calls ?? []).map((toolCall: Record<string, any>) => ({
        id: String(toolCall.id),
        name: String(toolCall.function?.name),
        input: toolCall.function?.arguments
            ? JSON.parse(toolCall.function.arguments)
            : {}
    }));

    const text = typeof message.content === "string" ? message.content : "";

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
