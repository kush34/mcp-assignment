import crypto from "node:crypto";
import { db } from "../db/index.js";
import type { ApprovalRecord } from "../types/controlPlane.js";

export function createApproval(input: {
    conversationId: string;
    toolName: string;
    arguments: Record<string, unknown>;
}) {
    const id = crypto.randomUUID();

    db.prepare(`
        INSERT INTO approvals (id, conversation_id, tool_name, arguments, status)
        VALUES (@id, @conversation_id, @tool_name, @arguments, 'pending')
    `).run({
        id,
        conversation_id: input.conversationId,
        tool_name: input.toolName,
        arguments: JSON.stringify(input.arguments)
    });

    return getApproval(id);
}

export function listPendingApprovals() {
    return db.prepare(`
        SELECT * FROM approvals
        WHERE status = 'pending'
        ORDER BY datetime(created_at) ASC
    `).all() as ApprovalRecord[];
}

export function getApproval(id: string) {
    return db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as ApprovalRecord | undefined;
}

export function setApprovalStatus(id: string, status: "approved" | "denied") {
    db.prepare(`
        UPDATE approvals
        SET status = @status,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
    `).run({ id, status });

    return getApproval(id);
}
