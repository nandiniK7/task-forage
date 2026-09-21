import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Guard against shipping a production bundle that talks to a developer machine.
  //  - A localhost URL coming from the real build environment (Netlify/CI variables) is a deployment mistake: fail.
  //  - A localhost URL that only comes from the git-ignored client/.env is normal local development: warn.
  const isLocal = (value = "") => /localhost|127\.0\.0\.1/.test(value);
  if (mode === "production" && isLocal(env.VITE_API_URL)) {
    const message = `VITE_API_URL points at a local address (${env.VITE_API_URL}). Use the deployed API URL for production builds.`;
    if (isLocal(process.env.VITE_API_URL)) throw new Error(message);
    console.warn(`\n[warning] ${message} (from client/.env; fine for local testing, do not deploy this build)\n`);
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173 },
    preview: { port: 4173 },
  };
});
