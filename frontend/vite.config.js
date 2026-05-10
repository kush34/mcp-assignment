import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/agent": "http://localhost:3000",
            "/rules": "http://localhost:3000",
            "/approvals": "http://localhost:3000",
            "/logs": "http://localhost:3000",
            "/health": "http://localhost:3000"
        }
    }
});
