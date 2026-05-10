# MCP Control Plane

Runtime governance layer for MCP-based tool use. This repo combines:

- `backend/`: the orchestrator, policy engine, approval flow, audit logs, and server health APIs
- `frontend/`: a React control plane UI for servers, rules, approvals, and logs
- `mcp/`: a sample filesystem MCP server used by the backend

The core design principle is: fail closed, log everything, and never silently succeed when execution state is ambiguous.

## What It Does

The backend accepts a user message, sends it to an LLM with live MCP tool schemas, evaluates every requested tool call against governance rules, and then either:

- allows the tool call
- blocks it
- validates the arguments
- pauses for human approval

Every major step is logged to SQLite so the frontend can show approvals, logs, and server health in near real time.

## Repo Layout

```text
.
├── backend/   # Express API + orchestrator + policy engine + SQLite control plane
├── frontend/  # React/Tailwind governance dashboard
└── mcp/       # Example filesystem MCP server
```

Key backend files:

- [backend/src/agent.ts](/home/ck34/Desktop/mcp/backend/src/agent.ts): main orchestrator loop
- [backend/src/policy/engine.ts](/home/ck34/Desktop/mcp/backend/src/policy/engine.ts): rule matching, conflict handling, approvals
- [backend/src/mcp/execute.ts](/home/ck34/Desktop/mcp/backend/src/mcp/execute.ts): tool execution, timeout handling, retries
- [backend/src/control-plane/approvals.ts](/home/ck34/Desktop/mcp/backend/src/control-plane/approvals.ts): approval persistence
- [backend/src/db/index.ts](/home/ck34/Desktop/mcp/backend/src/db/index.ts): SQLite bootstrap and schema
- [backend/mcp.config.json](/home/ck34/Desktop/mcp/backend/mcp.config.json): MCP server configuration

## Architecture

1. A user sends a prompt to `POST /agent`.
2. The orchestrator asks the configured LLM what tools to call.
3. Each tool call goes through the policy engine.
4. If approved, the backend executes the MCP tool.
5. Tool results are sanitized before being fed back to the model.
6. All events are written to SQLite and exposed through governance APIs.

## Setup

## Prerequisites

- Node.js 18+
- npm

## Environment

Create:

- `backend/.env`
- `frontend/.env` if you want to override the frontend API base URL
- `mcp/.env` only if your custom MCP server needs it

Backend reads `backend/.env`. Useful variables from the current code:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173

# Pick one provider
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini

# Optional if using the remote Exa MCP server in backend/mcp.config.json
EXA_API_KEY=...
```

Frontend optionally reads:

```env
VITE_BACKEND_URL=http://localhost:3000
```

## Install

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../mcp && npm install
```

## Run

Start the sample MCP server build once so `backend/mcp.config.json` can launch `mcp/dist/index.js`:

```bash
cd mcp
npx tsc -p tsconfig.json
```

Run the backend:

```bash
cd backend
npm run build
npm start
```

Run the frontend:

```bash
cd frontend
npm run dev
```

## Frontend Views

- `Servers`: MCP connection status, latency, transport, and endpoint
- `Rules`: create or toggle deny, approval, and validate rules
- `Approvals`: review pending human approval requests
- `Logs`: inspect the execution trail

## Backend API

Agent:

- `POST /agent`

Governance:

- `GET /rules`
- `POST /rules`
- `PATCH /rules/:id`
- `DELETE /rules/:id`
- `GET /approvals/pending`
- `GET /approvals/:id`
- `POST /approvals/:id/approve`
- `POST /approvals/:id/deny`
- `GET /logs`
- `GET /logs/:conversationId`
- `GET /servers`

Health:

- `GET /health`

## Rule Model

Rules match tools by `tool_pattern` and can enforce:

- `deny`
- `approval`
- `validate`

Rule config currently supports:

```json
{
  "allowedPaths": ["/safe/path"],
  "priorityCategory": "safety",
  "approvalTimeoutMs": 300000,
  "note": "optional human-readable note"
}
```

Priority order is explicit:

- `safety`
- `compliance`
- `efficiency`

If multiple rules match and the system cannot resolve them safely, the tool call is denied.

## Edge Cases And How They’re Handled

### 1. MCP server crashes mid-tool-call

Handled in [backend/src/mcp/execute.ts](/home/ck34/Desktop/mcp/backend/src/mcp/execute.ts).

- Tool calls are wrapped in a timeout.
- Retryable transport failures use bounded exponential backoff.
- Retries only happen for tools marked `idempotentHint: true` or `readOnlyHint: true`.
- If retries still fail, the agent returns `isError: true` and logs the incomplete operation as `tool_incomplete`.

Why this is safe:

- Non-idempotent writes are not retried automatically.
- A partial or ambiguous execution never looks like success.

### 2. Prompt injection inside file content or tool output

Handled in [backend/src/agent.ts](/home/ck34/Desktop/mcp/backend/src/agent.ts).

- The system prompt explicitly tells the model that tool outputs are untrusted data.
- Tool results are sanitized before they are fed back into the model.
- Suspicious control-like strings such as fake role tags or instruction override phrases are redacted.
- Very large tool output is truncated before re-entry to the model.

Why this is safe:

- File content can still be read and reasoned about.
- It is much harder for external text to impersonate system or developer instructions.

### 3. Two guardrail rules conflict

Handled in [backend/src/policy/engine.ts](/home/ck34/Desktop/mcp/backend/src/policy/engine.ts).

- All matching rules are collected, not just the first one.
- The engine resolves by explicit priority: `safety > compliance > efficiency`.
- If equally important rules still conflict, the decision is `deny`.
- Conflicts are logged as `policy_conflict` for audit and follow-up.

Why this is safe:

- The runtime does not guess.
- Lower-priority efficiency rules cannot override higher-priority safety rules.

### 4. A tool requires human approval and nobody approves it

Handled in [backend/src/control-plane/approvals.ts](/home/ck34/Desktop/mcp/backend/src/control-plane/approvals.ts) and [backend/src/policy/engine.ts](/home/ck34/Desktop/mcp/backend/src/policy/engine.ts).

- Approval requests are persisted in SQLite.
- Each request gets an expiration time.
- The policy engine polls for a decision until approval, denial, or timeout.
- On timeout, the request is marked `expired`, the tool call is denied, and an `approval_timeout` log is recorded.

Why this is safe:

- The system does not wait forever.
- The action does not execute without explicit approval.

### 5. Partial writes from retried tools

Handled by combining executor policy and tool design.

- The executor only retries tools that advertise idempotency or read-only behavior.
- The sample filesystem MCP server marks safe tools with annotations.
- `write-file` short-circuits when the content is already identical.
- `delete-file` treats missing files as a safe no-op.

Why this is safe:

- Repeat execution converges to the same end state for the sample tools.

### 6. Path traversal attempts

Handled in both backend policy and the filesystem MCP server.

- The policy engine rejects `fileName` values containing `..`.
- The filesystem MCP server resolves paths against `files-example` and verifies the final path stays inside the base directory.

Why this is safe:

- A malformed request is rejected before or during execution.

## Logging And Audit Trail

The backend stores logs in SQLite under `backend/data/control-plane.db`.

Examples of logged events:

- `user_message`
- `assistant_message`
- `tool_call`
- `tool_result`
- `tool_incomplete`
- `blocked`
- `approval_wait`
- `approval_granted`
- `approval_denied`
- `approval_timeout`
- `policy_conflict`

## Notes

- The backend loads MCP servers from [backend/mcp.config.json](/home/ck34/Desktop/mcp/backend/mcp.config.json).
- The included config expects `mcp/dist/index.js` to exist.
- The backend currently refreshes rule cache every 5 seconds.
- The frontend polls approvals and server status for live updates.

## Verification

Commands used successfully after the latest changes:

```bash
cd backend && npm run build
cd mcp && npx tsc -p tsconfig.json
```
