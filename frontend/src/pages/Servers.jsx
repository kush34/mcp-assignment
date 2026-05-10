import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

export default function Servers() {
    const serversQuery = useQuery({
        queryKey: ["servers"],
        queryFn: api.getServers,
        refetchInterval: 5_000
    });

    const servers = serversQuery.data ?? [];

    return (
        <section className="rounded-3xl border border-white/10 bg-white/5 shadow-panel">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                    <thead className="bg-white/5 text-slate-300">
                        <tr>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Transport</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Tools</th>
                            <th className="px-4 py-3 font-medium">Latency</th>
                            <th className="px-4 py-3 font-medium">Endpoint</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {servers.map(server => (
                            <tr key={server.name} className="text-slate-100">
                                <td className="px-4 py-4">{server.name}</td>
                                <td className="px-4 py-4">{server.transport}</td>
                                <td className="px-4 py-4">
                                    <span className={`rounded-full px-3 py-1 text-xs ${
                                        server.status === "connected"
                                            ? "bg-emerald-400/20 text-emerald-200"
                                            : server.status === "error"
                                                ? "bg-rose-400/20 text-rose-200"
                                                : "bg-slate-600/30 text-slate-300"
                                    }`}>
                                        {server.status}
                                    </span>
                                </td>
                                <td className="px-4 py-4">{server.tools}</td>
                                <td className="px-4 py-4">{server.latencyMs ?? "-"}</td>
                                <td className="px-4 py-4 font-mono text-xs text-slate-400">
                                    {server.url ?? server.command ?? "-"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
