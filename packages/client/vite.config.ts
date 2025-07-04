import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
    return {
      root: 'src',
      base: '/echoBE/',
      build: {
        outDir: '../../electron/dist/app',
      },
      resolve: {
        alias: { '@': path.resolve(__dirname, 'src') }
      }
    };
});
