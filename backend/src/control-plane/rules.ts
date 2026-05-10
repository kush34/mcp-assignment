import crypto from "node:crypto";
import { db } from "../db/index.js";
import type { RuleRecord } from "../types/controlPlane.js";

type UpsertRuleInput = {
    type: string;
    tool_pattern?: string | null;
    action: string;
    enabled?: boolean;
    config?: Record<string, unknown> | null;
};

export function listRules() {
    return db.prepare("SELECT * FROM rules ORDER BY datetime(created_at) DESC").all() as RuleRecord[];
}

export function getEnabledRules() {
    return db.prepare("SELECT * FROM rules WHERE enabled = 1 ORDER BY datetime(created_at) DESC").all() as RuleRecord[];
}

export function createRule(input: UpsertRuleInput) {
    const id = crypto.randomUUID();

    db.prepare(`
        INSERT INTO rules (id, type, tool_pattern, action, enabled, config)
        VALUES (@id, @type, @tool_pattern, @action, @enabled, @config)
    `).run({
        id,
        type: input.type,
        tool_pattern: input.tool_pattern ?? null,
        action: input.action,
        enabled: input.enabled === false ? 0 : 1,
        config: input.config ? JSON.stringify(input.config) : null
    });

    return db.prepare("SELECT * FROM rules WHERE id = ?").get(id) as RuleRecord;
}

export function updateRule(id: string, input: Partial<UpsertRuleInput>) {
    const existing = db.prepare("SELECT * FROM rules WHERE id = ?").get(id) as RuleRecord | undefined;

    if (!existing) {
        return null;
    }

    db.prepare(`
        UPDATE rules
        SET type = @type,
            tool_pattern = @tool_pattern,
            action = @action,
            enabled = @enabled,
            config = @config
        WHERE id = @id
    `).run({
        id,
        type: input.type ?? existing.type,
        tool_pattern: input.tool_pattern ?? existing.tool_pattern,
        action: input.action ?? existing.action,
        enabled: input.enabled === undefined ? existing.enabled : (input.enabled ? 1 : 0),
        config: input.config === undefined
            ? existing.config
            : input.config
                ? JSON.stringify(input.config)
                : null
    });

    return db.prepare("SELECT * FROM rules WHERE id = ?").get(id) as RuleRecord;
}

export function deleteRule(id: string) {
    db.prepare("DELETE FROM rules WHERE id = ?").run(id);
}
