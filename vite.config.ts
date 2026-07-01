import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/pepdose/',
  // ponytail: vitest 3.2's bundled vite@7 types don't match top-level vite@8; runtime works fine.
  // @ts-expect-error -- 'test' isn't in vite@8's UserConfig, only vitest's augmented one.
  test: { environment: 'node' },
})
