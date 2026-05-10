import type { RuleRecord } from "../types/controlPlane.js";
import { getEnabledRules } from "./rules.js";
import { log } from "../utils/logger.js";

let cachedRules: RuleRecord[] = [];
let started = false;

export function startRuleCacheRefresh(intervalMs = 5_000) {
    if (started) {
        return;
    }

    const refresh = () => {
        cachedRules = getEnabledRules();
        log("POLICY", `reloaded ${cachedRules.length} active rules`);
    };

    refresh();
    setInterval(refresh, intervalMs);
    started = true;
}

export function getCachedRules() {
    return cachedRules;
}
