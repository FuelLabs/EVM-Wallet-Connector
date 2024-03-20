// vite.config.js
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import path from 'path';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [
    dts({
      include: [resolve(__dirname, 'src/')]
    })
  ],
  define: {
    __dirname: JSON.stringify(path.dirname(__filename)),
    __filename: JSON.stringify(fileURLToPath(import.meta.url))
  },
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/index.ts'),
      name: '@fuels/wallet-connector-evm',
      // the proper extensions will be added
      fileName: 'wallet-connector-evm'
    }
  },
  test: {
    environment: "jsdom",
    env: {
      // TODO: update genesis secret
      GENESIS_SECRET: '0x6e48a022f9d4ae187bca4e2645abd62198ae294ee484766edbdaadf78160dc68'
    }
  }
});
