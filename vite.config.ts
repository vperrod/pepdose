import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/pepdose/',
  // Stamped into Settings so "is my phone on the new build?" is answerable.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  build: {
    rollupOptions: {
      output: {
        // node_modules deps go in their own vendor chunks, and the big static
        // peptide datasets (imported eagerly via utils/notifications.ts) get
        // pulled out of the entry chunk instead of bloating it — see
        // https://github.com/vperrod/pepdose (573 kB main / 311 kB chart chunk).
        manualChunks(id) {
          if (id.includes('/src/data/peptides.ts') || id.includes('/src/data/experienceTimelines.ts')) {
            return 'peptide-data';
          }
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
  },
  // ponytail: vitest 3.2's bundled vite@7 types don't match top-level vite@8; runtime works fine.
  // @ts-expect-error -- 'test' isn't in vite@8's UserConfig, only vitest's augmented one.
  test: { environment: 'node' },
})
