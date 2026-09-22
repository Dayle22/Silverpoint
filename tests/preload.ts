import { plugin } from 'bun'

await plugin({
  name: 'test-virtual-icons',
  setup(build) {
    build.onResolve({ filter: /^~icons\// }, ({ path }) => ({ path, namespace: 'test-icons' }))
    build.onLoad({ filter: /.*/, namespace: 'test-icons' }, ({ path }) => ({
      contents: `export default { name: ${JSON.stringify(path)} }`,
      loader: 'js'
    }))
  }
})
