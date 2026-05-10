export default function LogViewer({ logs }) {
    return (
        <div className="space-y-4">
            {logs.map(log => (
                <article key={log.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-panel">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-amber-300">{log.type}</p>
                            <p className="mt-1 font-mono text-xs text-slate-400">{log.conversation_id}</p>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                            <p>{log.created_at}</p>
                            <p>
                                Tokens: {log.total_tokens ?? 0}
                            </p>
                        </div>
                    </div>
                    <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950/60 p-4 text-xs text-slate-200">
                        {JSON.stringify(log.payload, null, 2)}
                    </pre>
                </article>
            ))}
        </div>
    );
}
