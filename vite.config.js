import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Legacy UI modules still use the old query-builder import shape, but Vite resolves
// it entirely to the local Netlify API adapter. No external Supabase project, URL,
// key, package runtime, or data migration is required.
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('local-netlify-adapter'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('not-used'),
  },
  resolve: {
    alias: {
      '@supabase/supabase-js': path.resolve(__dirname, 'src/lib/supabase.js'),
    },
  },
})
