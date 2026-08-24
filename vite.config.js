import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// During the Neon migration, existing pages keep their query-builder calls while
// Vite resolves the old Supabase package import to our Netlify API adapter.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@supabase/supabase-js': path.resolve(__dirname, 'src/lib/supabase.js'),
    },
  },
})
