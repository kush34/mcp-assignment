export default function RuleTable({ rules, onToggle, onDelete }) {
    return (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-panel">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                    <thead className="bg-white/5 text-slate-300">
                        <tr>
                            <th className="px-4 py-3 font-medium">Enabled</th>
                            <th className="px-4 py-3 font-medium">Tool Pattern</th>
                            <th className="px-4 py-3 font-medium">Action</th>
                            <th className="px-4 py-3 font-medium">Config</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {rules.map(rule => (
                            <tr key={rule.id} className="text-slate-100">
                                <td className="px-4 py-4">
                                    <button
                                        type="button"
                                        onClick={() => onToggle(rule)}
                                        className={`rounded-full px-3 py-1 text-xs ${
                                            rule.enabled
                                                ? "bg-emerald-400/20 text-emerald-200"
                                                : "bg-slate-600/30 text-slate-300"
                                        }`}
                                    >
                                        {rule.enabled ? "On" : "Off"}
                                    </button>
                                </td>
                                <td className="px-4 py-4 font-mono text-xs">{rule.tool_pattern || "*"}</td>
                                <td className="px-4 py-4">{rule.action}</td>
                                <td className="px-4 py-4">
                                    <pre className="max-w-md whitespace-pre-wrap font-mono text-xs text-slate-300">
                                        {JSON.stringify(rule.config, null, 2)}
                                    </pre>
                                </td>
                                <td className="px-4 py-4">
                                    <button
                                        type="button"
                                        onClick={() => onDelete(rule.id)}
                                        className="rounded-full border border-rose-400/30 px-3 py-1 text-xs text-rose-200 hover:bg-rose-400/10"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
