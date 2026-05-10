import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { log } from "./logger.js";

let loaded = false;

export function loadEnv() {
    if (loaded) {
        return;
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const backendRoot = path.resolve(__dirname, "../..");
    const envPath = path.join(backendRoot, ".env");

    const result = dotenv.config({ path: envPath });

    if (result.error) {
        log("BOOT", "no .env file loaded", { envPath });
    } else {
        log("BOOT", "loaded environment file", { envPath });
    }

    loaded = true;
}
