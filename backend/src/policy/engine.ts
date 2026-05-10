import { createApproval, expireApproval, getApproval } from "../control-plane/approvals.js";
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

const APPROVAL_POLL_INTERVAL_MS = 1_000;
const DEFAULT_APPROVAL_TIMEOUT_MS = 5 * 60_000;
const RULE_PRIORITY_ORDER = ["safety", "compliance", "efficiency"] as const;
const ACTION_SEVERITY = {
    deny: 3,
    approval: 2,
    hold: 2,
    validate: 1,
    allow: 0
} as const;
type NormalizedRuleAction = keyof typeof ACTION_SEVERITY;
type RuleResolutionCandidate = {
    rule: RuleRecord;
    config: RuleConfig;
    priority: (typeof RULE_PRIORITY_ORDER)[number];
    action: NormalizedRuleAction;
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

    const matchedRules = getCachedRules().filter(rule =>
        matchesRule(rule, toolUse.name, tool.name)
    );

    if (matchedRules.length === 0) {
        return {
            status: "allow",
            reason: "Allowed by default policy"
        };
    }

    const resolution = resolveRuleDecision(matchedRules);

    if (resolution.conflict) {
        createLog({
            conversationId,
            type: "policy_conflict",
            payload: {
                tool: toolUse.name,
                conflict: resolution.conflict
            }
        });
    }

    if (resolution.decision === "deny") {
        createLog({
            conversationId,
            type: "blocked",
            payload: {
                tool: toolUse.name,
                ruleId: resolution.rule.id,
                reason: resolution.reason
            }
        });

        return {
            status: "deny",
            reason: resolution.reason,
            ruleId: resolution.rule.id
        };
    }

    if (resolution.decision === "validate") {
        const valid = validateToolInput(toolUse, resolution.config);

        if (!valid.ok) {
            createLog({
                conversationId,
                type: "blocked",
                payload: {
                    tool: toolUse.name,
                    ruleId: resolution.rule.id,
                    reason: valid.reason
                }
            });

            return {
                status: "deny",
                reason: valid.reason,
                ruleId: resolution.rule.id
            };
        }

        return {
            status: "validate",
            reason: "Validated by persisted rule",
            ruleId: resolution.rule.id
        };
    }

    if (resolution.decision === "approval" || resolution.decision === "hold") {
        const timeoutMs = normalizeApprovalTimeoutMs(
            resolution.config.approvalTimeoutMs
        );
        const expiresAt = new Date(Date.now() + timeoutMs).toISOString();
        const approval = createApproval({
            conversationId,
            toolName: toolUse.name,
            arguments: toolUse.input,
            expiresAt
        });

        createLog({
            conversationId,
            type: "approval_wait",
            payload: {
                tool: toolUse.name,
                approvalId: approval?.id,
                expiresAt
            }
        });

        return waitForApproval({
            conversationId,
            approvalId: approval?.id ?? "",
            toolName: toolUse.name,
            ruleId: resolution.rule.id,
            expiresAt,
            timeoutMs
        });
    }

    return {
        status: "allow",
        reason: "Allowed by policy"
    };
}

async function waitForApproval(input: {
    conversationId: string;
    approvalId: string;
    toolName: string;
    ruleId: string;
    expiresAt: string;
    timeoutMs: number;
}): Promise<PolicyOutcome> {
    const { conversationId, approvalId, toolName, ruleId, expiresAt, timeoutMs } = input;

    while (true) {
        const current = getApproval(approvalId);

        if (!current || current.status === "denied" || current.status === "expired") {
            createLog({
                conversationId,
                type: "approval_denied",
                payload: {
                    tool: toolName,
                    approvalId,
                    status: current?.status ?? "missing"
                }
            });

            return {
                status: "deny",
                reason: current?.status === "expired"
                    ? `Approval timed out after ${Math.ceil(timeoutMs / 1000)}s`
                    : "Denied by human approval",
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

        if (Date.now() >= Date.parse(expiresAt)) {
            expireApproval(approvalId);

            createLog({
                conversationId,
                type: "approval_timeout",
                payload: {
                    tool: toolName,
                    approvalId,
                    expiresAt
                }
            });

            return {
                status: "deny",
                reason: `Approval timed out after ${Math.ceil(timeoutMs / 1000)}s. Action remains queued until it expires; no tool call was executed.`,
                ruleId
            };
        }

        await sleep(APPROVAL_POLL_INTERVAL_MS);
    }
}

function matchesRule(rule: RuleRecord, toolName: string, fullToolName: string) {
    if (!rule.tool_pattern) {
        return false;
    }

    const normalizedPattern = rule.tool_pattern.replace(/[_-]/g, "__SEP__");
    const escaped = normalizedPattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/__SEP__/g, "[-_]");

    const matcher = new RegExp(`^${escaped}$`);
    const shortToolName = fullToolName.includes(".")
        ? fullToolName.split(".").slice(1).join(".")
        : toolName;

    return matcher.test(toolName) || matcher.test(shortToolName) || matcher.test(fullToolName);
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

function resolveRuleDecision(rules: RuleRecord[]) {
    const enriched: RuleResolutionCandidate[] = rules.map(rule => {
        const config = parseRuleConfig(rule.config);
        const priority = inferPriorityCategory(rule, config);
        return {
            rule,
            config,
            priority,
            action: normalizeRuleAction(rule.action)
        };
    });

    if (enriched.length === 0) {
        throw new Error("resolveRuleDecision requires at least one matched rule");
    }

    const highestPriority = Math.min(
        ...enriched.map(item => RULE_PRIORITY_ORDER.indexOf(item.priority))
    );
    const highestPriorityRules = enriched.filter(
        item => RULE_PRIORITY_ORDER.indexOf(item.priority) === highestPriority
    );
    const distinctActions = [...new Set(highestPriorityRules.map(item => item.action))];

    if (distinctActions.length > 1) {
        const chosen = highestPriorityRules.sort(compareRulePrecedence)[0] ?? enriched[0]!;
        const reasons = highestPriorityRules.map(item => ({
            ruleId: item.rule.id,
            action: item.action,
            priority: item.priority
        }));

        return {
            decision: "deny" as const,
            rule: chosen.rule,
            config: chosen.config,
            reason: `Conflicting ${RULE_PRIORITY_ORDER[highestPriority]} rules matched this tool call; denying by fail-safe policy`,
            conflict: reasons
        };
    }

    const chosen = highestPriorityRules.sort(compareRulePrecedence)[0] ?? enriched[0]!;
    const lowerPriorityConflicts = enriched
        .filter(item => item.rule.id !== chosen.rule.id && item.action !== chosen.action)
        .map(item => ({
            ruleId: item.rule.id,
            action: item.action,
            priority: item.priority
        }));

    return {
        decision: chosen.action,
        rule: chosen.rule,
        config: chosen.config,
        reason: chosen.action === "deny"
            ? "Blocked by persisted rule"
            : "Resolved by policy priority",
        ...(lowerPriorityConflicts.length > 0
            ? { conflict: [{ ruleId: chosen.rule.id, action: chosen.action, priority: chosen.priority }, ...lowerPriorityConflicts] }
            : {})
    };
}

function inferPriorityCategory(
    rule: RuleRecord,
    config: RuleConfig
): (typeof RULE_PRIORITY_ORDER)[number] {
    if (config.priorityCategory && RULE_PRIORITY_ORDER.includes(config.priorityCategory)) {
        return config.priorityCategory;
    }

    const normalizedType = rule.type.trim().toLowerCase();

    if (RULE_PRIORITY_ORDER.includes(normalizedType as (typeof RULE_PRIORITY_ORDER)[number])) {
        return normalizedType as (typeof RULE_PRIORITY_ORDER)[number];
    }

    if (rule.action === "deny") {
        return "safety";
    }

    if (rule.action === "approval" || rule.action === "hold") {
        return "compliance";
    }

    return "efficiency";
}

function normalizeRuleAction(action: string): NormalizedRuleAction {
    if (action === "deny" || action === "approval" || action === "hold" || action === "validate") {
        return action;
    }

    return "allow";
}

function compareRulePrecedence(
    left: RuleResolutionCandidate,
    right: RuleResolutionCandidate
) {
    const severityGap = ACTION_SEVERITY[right.action] - ACTION_SEVERITY[left.action];

    if (severityGap !== 0) {
        return severityGap;
    }

    return right.rule.created_at.localeCompare(left.rule.created_at);
}

function normalizeApprovalTimeoutMs(timeoutMs: number | undefined) {
    if (!Number.isFinite(timeoutMs) || timeoutMs === undefined || timeoutMs <= 0) {
        return DEFAULT_APPROVAL_TIMEOUT_MS;
    }

    return timeoutMs;
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
