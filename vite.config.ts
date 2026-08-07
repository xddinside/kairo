import { defineConfig } from 'vite'

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: { host: true },
  plugins: [tanstackStart(), tailwindcss(), viteReact()],
})

export default config
