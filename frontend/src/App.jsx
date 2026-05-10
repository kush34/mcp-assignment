import { useState } from "react";
import Rules from "./pages/Rules.jsx";
import Approvals from "./pages/Approvals.jsx";
import Logs from "./pages/Logs.jsx";
import Servers from "./pages/Servers.jsx";

const tabs = [
    { id: "servers", label: "Servers" },
    { id: "rules", label: "Rules" },
    { id: "approvals", label: "Approvals" },
    { id: "logs", label: "Logs" }
];

export default function App() {
    const [activeTab, setActiveTab] = useState("servers");

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_30%),linear-gradient(180deg,#09111f_0%,#0f172a_40%,#111827_100%)] text-slate-100">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-panel backdrop-blur">
                    <p className="font-body text-xs uppercase tracking-[0.35em] text-amber-300">Governance Layer</p>
                    <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">MCP Control Plane</h1>
                    <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
                        Runtime policy, human approvals, and execution logs for the orchestrator.
                    </p>
                </header>

                <nav className="mb-8 flex flex-wrap gap-3">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`rounded-full border px-4 py-2 text-sm transition ${
                                activeTab === tab.id
                                    ? "border-amber-300 bg-amber-300 text-slate-950"
                                    : "border-white/10 bg-white/5 text-slate-200 hover:border-amber-200/50 hover:bg-white/10"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>

                {activeTab === "servers" ? <Servers /> : null}
                {activeTab === "rules" ? <Rules /> : null}
                {activeTab === "approvals" ? <Approvals /> : null}
                {activeTab === "logs" ? <Logs /> : null}
            </div>
        </div>
    );
}
