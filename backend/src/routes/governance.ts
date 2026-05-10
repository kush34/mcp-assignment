import { Router } from "express";
import { listRules, createRule, updateRule, deleteRule } from "../control-plane/rules.js";
import { listPendingApprovals, setApprovalStatus, getApproval } from "../control-plane/approvals.js";
import { listLogs } from "../control-plane/logs.js";
import { serializeApproval, serializeLog, serializeRule } from "../control-plane/format.js";

export const governanceRouter = Router();

governanceRouter.get("/rules", (_request, response) => {
    response.json(listRules().map(serializeRule));
});

governanceRouter.post("/rules", (request, response) => {
    const rule = createRule(request.body ?? {});
    response.status(201).json(serializeRule(rule));
});

governanceRouter.patch("/rules/:id", (request, response) => {
    const rule = updateRule(request.params.id, request.body ?? {});

    if (!rule) {
        response.status(404).json({ success: false, error: "Rule not found" });
        return;
    }

    response.json(serializeRule(rule));
});

governanceRouter.delete("/rules/:id", (request, response) => {
    deleteRule(request.params.id);
    response.status(204).send();
});

governanceRouter.get("/approvals/pending", (_request, response) => {
    response.json(listPendingApprovals().map(serializeApproval));
});

governanceRouter.post("/approvals/:id/approve", (request, response) => {
    const approval = setApprovalStatus(request.params.id, "approved");

    if (!approval) {
        response.status(404).json({ success: false, error: "Approval not found" });
        return;
    }

    response.json(serializeApproval(approval));
});

governanceRouter.post("/approvals/:id/deny", (request, response) => {
    const approval = setApprovalStatus(request.params.id, "denied");

    if (!approval) {
        response.status(404).json({ success: false, error: "Approval not found" });
        return;
    }

    response.json(serializeApproval(approval));
});

governanceRouter.get("/logs", (request, response) => {
    const type = typeof request.query.type === "string" ? request.query.type : undefined;
    const conversationId = typeof request.query.conversationId === "string"
        ? request.query.conversationId
        : undefined;

    const filters = {
        ...(type ? { type } : {}),
        ...(conversationId ? { conversationId } : {})
    };

    response.json(listLogs(filters).map(serializeLog));
});

governanceRouter.get("/logs/:conversationId", (request, response) => {
    response.json(listLogs({ conversationId: request.params.conversationId }).map(serializeLog));
});

governanceRouter.get("/approvals/:id", (request, response) => {
    const approval = getApproval(request.params.id);

    if (!approval) {
        response.status(404).json({ success: false, error: "Approval not found" });
        return;
    }

    response.json(serializeApproval(approval));
});
