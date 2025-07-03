import path from 'path';
import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => {
    return {
        base: './',
        root: path.resolve(__dirname, 'src'),
        build: {
            outDir: '../electron/dist/app'
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        }
    };
});
