import cloudflare from '@astrojs/cloudflare';
// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vue from '@astrojs/vue';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    define: {
      'process.env.POCKETBASE_URL': JSON.stringify(process.env.POCKETBASE_URL)
    }
  },
  output: 'server',
  adapter: cloudflare(),
  integrations: [vue({ devtools: true })]
});