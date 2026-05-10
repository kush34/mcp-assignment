import { createApproval, getApproval } from "../control-plane/approvals.js";
import { getCachedRules } from "../control-plane/cache.js";
import { createLog } from "../control-plane/logs.js";
import { toolRegistry } from "../registry/tools.js";
import type { PolicyOutcome, RuleConfig, RuleRecord } from "../types/controlPlane.js";
import { sleep } from "../utils/sleep.js";

export type ToolUseRequest = {
    id: string;
    name: string;
    input: Record<string, unknown>;
};

export async function policyEngine(input: {
    conversationId: string;
    toolUse: ToolUseRequest;
}): Promise<PolicyOutcome> {
    const { conversationId, toolUse } = input;
    const tool = toolRegistry.get(toolUse.name);

    if (!tool) {
        createLog({
            conversationId,
            type: "blocked",
            payload: {
                tool: toolUse.name,
                reason: "Unknown tool"
            }
        });

        return {
            status: "deny",
            reason: `Unknown tool: ${toolUse.name}`
        };
    }

    const unsafePath = toolUse.input.fileName;

    if (typeof unsafePath === "string" && unsafePath.includes("..")) {
        createLog({
            conversationId,
            type: "blocked",
            payload: {
                tool: toolUse.name,
                reason: "Relative parent paths are not allowed"
            }
        });

        return {
            status: "deny",
            reason: "Relative parent paths are not allowed"
        };
    }

    const matchedRule = getCachedRules().find(rule => matchesRule(rule, toolUse.name));

    if (!matchedRule) {
        return {
            status: "allow",
            reason: "Allowed by default policy"
        };
    }

    const config = parseRuleConfig(matchedRule.config);

    if (matchedRule.action === "deny") {
        createLog({
            conversationId,
            type: "blocked",
            payload: {
                tool: toolUse.name,
                ruleId: matchedRule.id,
                reason: "Blocked by persisted rule"
            }
        });

        return {
            status: "deny",
            reason: "Blocked by persisted rule",
            ruleId: matchedRule.id
        };
    }

    if (matchedRule.action === "validate") {
        const valid = validateToolInput(toolUse, config);

        if (!valid.ok) {
            createLog({
                conversationId,
                type: "blocked",
                payload: {
                    tool: toolUse.name,
                    ruleId: matchedRule.id,
                    reason: valid.reason
                }
            });

            return {
                status: "deny",
                reason: valid.reason,
                ruleId: matchedRule.id
            };
        }

        return {
            status: "validate",
            reason: "Validated by persisted rule",
            ruleId: matchedRule.id
        };
    }

    if (matchedRule.action === "approval" || matchedRule.action === "hold") {
        const approval = createApproval({
            conversationId,
            toolName: toolUse.name,
            arguments: toolUse.input
        });

        createLog({
            conversationId,
            type: "approval_wait",
            payload: {
                tool: toolUse.name,
                approvalId: approval?.id
            }
        });

        return waitForApproval(conversationId, approval?.id ?? "", toolUse.name, matchedRule.id);
    }

    return {
        status: "allow",
        reason: "Allowed by policy"
    };
}

async function waitForApproval(
    conversationId: string,
    approvalId: string,
    toolName: string,
    ruleId: string
): Promise<PolicyOutcome> {
    while (true) {
        const current = getApproval(approvalId);

        if (!current || current.status === "denied") {
            createLog({
                conversationId,
                type: "approval_denied",
                payload: {
                    tool: toolName,
                    approvalId
                }
            });

            return {
                status: "deny",
                reason: "Denied by human approval",
                ruleId
            };
        }

        if (current.status === "approved") {
            createLog({
                conversationId,
                type: "approval_granted",
                payload: {
                    tool: toolName,
                    approvalId
                }
            });

            return {
                status: "approval",
                reason: "Approved by human",
                ruleId,
                approvalId
            };
        }

        await sleep(1_000);
    }
}

function matchesRule(rule: RuleRecord, toolName: string) {
    if (!rule.tool_pattern) {
        return false;
    }

    const normalizedPattern = rule.tool_pattern.replace(/[_-]/g, "__SEP__");
    const escaped = normalizedPattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/__SEP__/g, "[-_]");

    return new RegExp(`^${escaped}$`).test(toolName);
}

function parseRuleConfig(rawConfig: string | null): RuleConfig {
    if (!rawConfig) {
        return {};
    }

    try {
        return JSON.parse(rawConfig) as RuleConfig;
    } catch {
        return {};
    }
}

function validateToolInput(toolUse: ToolUseRequest, config: RuleConfig) {
    if (!config.allowedPaths || config.allowedPaths.length === 0) {
        return { ok: true as const };
    }

    const fileName = toolUse.input.fileName;

    if (typeof fileName !== "string") {
        return { ok: false as const, reason: "Validation rule requires a fileName argument" };
    }

    const allowed = config.allowedPaths.some(path => fileName.startsWith(path));

    if (!allowed) {
        return {
            ok: false as const,
            reason: `Path ${fileName} is outside allowed paths`
        };
    }

    return { ok: true as const };
}
