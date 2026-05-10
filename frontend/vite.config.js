import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const BACKEND_URL = env.BACKEND_URL;
  if(!BACKEND_URL){
    throw new Error("No Backend URL found in the env vars.")
  }
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/agent": BACKEND_URL,
        "/rules": BACKEND_URL,
        "/approvals": BACKEND_URL,
        "/logs": BACKEND_URL,
        "/servers": BACKEND_URL,
        "/health": BACKEND_URL
      }
    }
  };
});