import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    return {
      base: './',
      root: path.resolve(__dirname, 'src'),
      build: {
        outDir: '../../electron/app'
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
