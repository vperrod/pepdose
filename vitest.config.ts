import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Node's own global Web Storage (stable since Node 24) shadows jsdom's
    // window.localStorage with a non-functional stub — disable it so jsdom's
    // real implementation wins. See --no-experimental-webstorage in `node --help`.
    execArgv: ['--no-experimental-webstorage'],
  },
});
