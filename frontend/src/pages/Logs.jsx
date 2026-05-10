import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import LogViewer from "../components/LogViewer.jsx";

export default function Logs() {
    const [type, setType] = useState("");
    const [conversationId, setConversationId] = useState("");

    const logsQuery = useQuery({
        queryKey: ["logs", type, conversationId],
        queryFn: () => api.getLogs({
            type: type || undefined,
            conversationId: conversationId || undefined
        }),
        refetchInterval: 3_000
    });

    return (
        <section className="space-y-6">
            <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-panel md:grid-cols-2">
                <label className="block text-sm text-slate-200">
                    Event Type
                    <select
                        value={type}
                        onChange={event => setType(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
                    >
                        <option value="">all</option>
                        <option value="blocked">blocked</option>
                        <option value="tool_call">tool_call</option>
                        <option value="tool_result">tool_result</option>
                        <option value="approval_wait">approval_wait</option>
                        <option value="approval_granted">approval_granted</option>
                        <option value="approval_denied">approval_denied</option>
                        <option value="assistant_message">assistant_message</option>
                    </select>
                </label>
                <label className="block text-sm text-slate-200">
                    Conversation ID
                    <input
                        value={conversationId}
                        onChange={event => setConversationId(event.target.value)}
                        placeholder="Paste a conversation ID"
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
                    />
                </label>
            </div>
            <LogViewer logs={logsQuery.data ?? []} />
        </section>
    );
}
