const JSON_HEADERS = {
    "content-type": "application/json"
};

async function request(path, options = {}) {
    const response = await fetch(path, {
        headers: {
            ...JSON_HEADERS,
            ...(options.headers ?? {})
        },
        ...options
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with ${response.status}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

export const api = {
    getRules: () => request("/rules"),
    createRule: payload => request("/rules", { method: "POST", body: JSON.stringify(payload) }),
    updateRule: (id, payload) => request(`/rules/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    deleteRule: id => request(`/rules/${id}`, { method: "DELETE" }),
    getPendingApprovals: () => request("/approvals/pending"),
    approve: id => request(`/approvals/${id}/approve`, { method: "POST" }),
    deny: id => request(`/approvals/${id}/deny`, { method: "POST" }),
    getServers: () => request("/servers"),
    getLogs: params => {
        const search = new URLSearchParams();

        if (params?.type) {
            search.set("type", params.type);
        }

        if (params?.conversationId) {
            search.set("conversationId", params.conversationId);
        }

        const query = search.toString();
        return request(`/logs${query ? `?${query}` : ""}`);
    }
};
