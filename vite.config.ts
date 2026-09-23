import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // A suíte é dominada por testes de integração que montam o App inteiro; o
    // padrão de 5 s expira por carga da máquina, não por defeito do teste.
    testTimeout: 15_000,
    setupFiles: "./src/test/setup.ts",
    globals: true,
    css: true,
    env: {
      VITE_SENTINEL_API_URL: "",
    },
  },
});
