import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split the libraries out of the app bundle. They change far less
        // often than app code, so on a redeploy a returning visitor
        // re-downloads only the small app chunk instead of everything.
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
          motion: ["gsap", "lenis"],
        },
      },
    },
  },
});
