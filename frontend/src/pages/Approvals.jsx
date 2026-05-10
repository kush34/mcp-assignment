import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import ApprovalCard from "../components/ApprovalCard.jsx";

export default function Approvals() {
    const queryClient = useQueryClient();

    const approvalsQuery = useQuery({
        queryKey: ["approvals", "pending"],
        queryFn: api.getPendingApprovals,
        refetchInterval: 2_000
    });

    const approveMutation = useMutation({
        mutationFn: api.approve,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] })
    });

    const denyMutation = useMutation({
        mutationFn: api.deny,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] })
    });

    const approvals = approvalsQuery.data ?? [];

    if (approvals.length === 0) {
        return (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-300 shadow-panel">
                No pending approvals right now.
            </section>
        );
    }

    return (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {approvals.map(approval => (
                <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    isBusy={approveMutation.isPending || denyMutation.isPending}
                    onApprove={id => approveMutation.mutate(id)}
                    onDeny={id => denyMutation.mutate(id)}
                />
            ))}
        </section>
    );
}
