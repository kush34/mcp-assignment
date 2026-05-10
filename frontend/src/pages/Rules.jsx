import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import RuleTable from "../components/RuleTable.jsx";

export default function     Rules() {
    const queryClient = useQueryClient();
    const [toolPattern, setToolPattern] = useState("");
    const [action, setAction] = useState("deny");
    const [allowedPaths, setAllowedPaths] = useState("");

    const rulesQuery = useQuery({
        queryKey: ["rules"],
        queryFn: api.getRules,
        refetchInterval: 5_000
    });

    const createMutation = useMutation({
        mutationFn: api.createRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["rules"] });
            setToolPattern("");
            setAction("deny");
            setAllowedPaths("");
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }) => api.updateRule(id, payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rules"] })
    });

    const deleteMutation = useMutation({
        mutationFn: api.deleteRule,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rules"] })
    });

    const rules = rulesQuery.data ?? [];
    const configPreview = useMemo(() => buildConfig(action, allowedPaths), [action, allowedPaths]);

    return (
        <section className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
                <form
                    className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-panel"
                    onSubmit={event => {
                        event.preventDefault();
                        createMutation.mutate({
                            type: action === "validate" ? "validation" : action === "approval" ? "approval" : "block",
                            tool_pattern: toolPattern || "*",
                            action,
                            enabled: true,
                            config: configPreview
                        });
                    }}
                >
                    <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Create Rule</p>
                    <div className="mt-5 space-y-4">
                        <label className="block text-sm text-slate-200">
                            Tool Pattern
                            <input
                                value={toolPattern}
                                onChange={event => setToolPattern(event.target.value)}
                                placeholder="delete_*"
                                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
                            />
                        </label>
                        <label className="block text-sm text-slate-200">
                            Action
                            <select
                                value={action}
                                onChange={event => setAction(event.target.value)}
                                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
                            >
                                <option value="deny">deny</option>
                                <option value="approval">approval</option>
                                <option value="validate">validate</option>
                            </select>
                        </label>
                        {action === "validate" ? (
                            <label className="block text-sm text-slate-200">
                                Allowed Paths
                                <input
                                    value={allowedPaths}
                                    onChange={event => setAllowedPaths(event.target.value)}
                                    placeholder="/tmp,/workspace"
                                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
                                />
                            </label>
                        ) : null}
                    </div>
                    <button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="mt-6 rounded-full bg-amber-300 px-5 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
                    >
                        Save Rule
                    </button>
                </form>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-panel">
                    <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Config Preview</p>
                    <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-950/60 p-4 text-xs text-slate-200">
                        {JSON.stringify(configPreview, null, 2)}
                    </pre>
                </div>
            </div>

            <RuleTable
                rules={rules}
                onToggle={rule => updateMutation.mutate({ id: rule.id, payload: { enabled: !rule.enabled } })}
                onDelete={id => deleteMutation.mutate(id)}
            />
        </section>
    );
}

function buildConfig(action, allowedPaths) {
    if (action !== "validate") {
        return {};
    }

    return {
        allowedPaths: allowedPaths
            .split(",")
            .map(item => item.trim())
            .filter(Boolean)
    };
}
