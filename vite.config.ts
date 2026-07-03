import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { realpathSync } from "node:fs";

export default defineConfig({
  root: realpathSync(process.cwd()),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true
      },
      "/healthz": "http://localhost:3000"
    }
  }
});
