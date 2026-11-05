import { defineConfig } from 'vite';
export default defineConfig({build:{lib:{entry:'src/index.ts',formats:['es'],fileName:'atlas'},rollupOptions:{external:['react','react-dom/client']}}});
