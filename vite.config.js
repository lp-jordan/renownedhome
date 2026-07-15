import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local API port. `npm run dev` runs server.js and vite together via
// concurrently, so they share the same environment — server.js listens on
// PORT (default 3001), so default to that here too rather than a hardcoded
// 3001, or the proxy silently breaks whenever something assigns a non-default
// PORT (e.g. 3001 already in use). Override with API_PORT when running a
// second stack side by side (e.g. API_PORT=3002 alongside the default pair).
const apiPort = process.env.API_PORT || process.env.PORT || 3001;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      // DEV ONLY: serve real production art from the live asset endpoint
      // (public, redirects to signed S3). Keep listed before "/api" so it wins.
      "/api/assets": {
        target: "https://renownedcomic.com",
        changeOrigin: true,
        secure: true,
      },
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
  },
});
