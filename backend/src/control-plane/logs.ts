import crypto from "node:crypto";
import { db } from "../db/index.js";
import type { LogRecord } from "../types/controlPlane.js";

export function createLog(input: {
    conversationId: string;
    type: string;
    payload: Record<string, unknown>;
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
}) {
    const id = crypto.randomUUID();

    db.prepare(`
        INSERT INTO logs (
            id,
            conversation_id,
            type,
            payload,
            prompt_tokens,
            completion_tokens,
            total_tokens
        ) VALUES (
            @id,
            @conversation_id,
            @type,
            @payload,
            @prompt_tokens,
            @completion_tokens,
            @total_tokens
        )
    `).run({
        id,
        conversation_id: input.conversationId,
        type: input.type,
        payload: JSON.stringify(input.payload),
        prompt_tokens: input.promptTokens ?? null,
        completion_tokens: input.completionTokens ?? null,
        total_tokens: input.totalTokens ?? null
    });

    return db.prepare("SELECT * FROM logs WHERE id = ?").get(id) as LogRecord;
}

export function listLogs(filters?: {
    conversationId?: string;
    type?: string;
}) {
    if (filters?.conversationId && filters?.type) {
        return db.prepare(`
            SELECT * FROM logs
            WHERE conversation_id = ? AND type = ?
            ORDER BY datetime(created_at) DESC
        `).all(filters.conversationId, filters.type) as LogRecord[];
    }

    if (filters?.conversationId) {
        return db.prepare(`
            SELECT * FROM logs
            WHERE conversation_id = ?
            ORDER BY datetime(created_at) DESC
        `).all(filters.conversationId) as LogRecord[];
    }

    if (filters?.type) {
        return db.prepare(`
            SELECT * FROM logs
            WHERE type = ?
            ORDER BY datetime(created_at) DESC
        `).all(filters.type) as LogRecord[];
    }

    return db.prepare(`
        SELECT * FROM logs
        ORDER BY datetime(created_at) DESC
        LIMIT 500
    `).all() as LogRecord[];
}
