export type RuleRecord = {
    id: string;
    type: string;
    tool_pattern: string | null;
    action: string;
    enabled: number;
    config: string | null;
    created_at: string;
};

export type ApprovalRecord = {
    id: string;
    conversation_id: string;
    tool_name: string;
    arguments: string;
    status: string;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
};

export type LogRecord = {
    id: string;
    conversation_id: string;
    type: string;
    payload: string;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    total_tokens: number | null;
    created_at: string;
};

export type RuleConfig = {
    allowedPaths?: string[];
    note?: string;
    priorityCategory?: "safety" | "compliance" | "efficiency";
    approvalTimeoutMs?: number;
};

export type PolicyOutcome =
    | { status: "allow"; reason: string }
    | { status: "deny"; reason: string; ruleId?: string }
    | { status: "approval"; reason: string; ruleId?: string; approvalId: string }
    | { status: "validate"; reason: string; ruleId?: string };
