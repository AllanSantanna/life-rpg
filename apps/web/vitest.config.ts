import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
    // Fluxos de integração (Finanças, Estatísticas, Treinos) levam 1–3 s cada.
    // Com o padrão (núcleos − 1 processos jsdom), a disputa de CPU com o Vite e
    // o editor os empurrava além de 5 s de forma intermitente. Limitar a
    // concorrência remove a causa sem alterar nenhum tempo limite.
    maxWorkers: '50%',
  },
});
