import { defineConfig } from "vite";

export default defineConfig({
  root: "src/client",
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/token": "http://localhost:3000",
      "/voice": "http://localhost:3000",
    },
  },
});
