export default function ApprovalCard({ approval, onApprove, onDeny, isBusy }) {
    return (
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-panel">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Pending Approval</p>
            <h3 className="mt-3 text-lg font-semibold text-white">{approval.tool_name}</h3>
            <p className="mt-1 font-mono text-xs text-slate-400">{approval.conversation_id}</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950/60 p-4 text-xs text-slate-200">
                {JSON.stringify(approval.arguments, null, 2)}
            </pre>
            <div className="mt-4 flex gap-3">
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onApprove(approval.id)}
                    className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
                >
                    Approve
                </button>
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onDeny(approval.id)}
                    className="rounded-full border border-rose-400/40 px-4 py-2 text-sm text-rose-200 disabled:opacity-50"
                >
                    Deny
                </button>
            </div>
        </article>
    );
}
