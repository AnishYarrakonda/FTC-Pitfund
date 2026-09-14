// `server-only` throws unless Next's react-server export condition is active. Scripts, tests
// and drizzle-kit legitimately run lib/server code outside Next, so resolve it to an empty
// module there. Registered with `--import`; covers both import and require.
import { registerHooks } from 'node:module'

const empty = new URL('./empty.cjs', import.meta.url).href

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: empty, format: 'commonjs', shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
