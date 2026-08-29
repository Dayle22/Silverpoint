import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    stdio: './src/stdio.ts'
  },
  platform: 'node',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: './dist',
  treeshake: false,
  deps: {
    neverBundle: [
      '@ai-sdk/harness',
      '@ai-sdk/harness-pi',
      '@ai-sdk/sandbox-just-bash',
      /^@ai-sdk\//,
      'ai',
      /^ai\//,
      'zod',
      /^zod\//,
      /^node:/
    ],
    onlyBundle: false
  }
})
