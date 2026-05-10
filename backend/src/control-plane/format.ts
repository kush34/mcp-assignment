import type { ApprovalRecord, LogRecord, RuleRecord } from "../types/controlPlane.js";

export function serializeRule(rule: RuleRecord) {
    return {
        ...rule,
        enabled: Boolean(rule.enabled),
        config: parseMaybeJson(rule.config)
    };
}

export function serializeApproval(approval: ApprovalRecord) {
    return {
        ...approval,
        arguments: parseMaybeJson(approval.arguments)
    };
}

export function serializeLog(log: LogRecord) {
    return {
        ...log,
        payload: parseMaybeJson(log.payload)
    };
}

function parseMaybeJson(value: string | null) {
    if (!value) return {};
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}