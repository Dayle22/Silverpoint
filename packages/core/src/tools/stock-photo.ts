import * as v from 'valibot'

import { defineTool } from './schema'
import { applyPhoto } from './stock-photo/apply'
import { getActiveProvider } from './stock-photo/providers'
import { parsePhotoRequests } from './stock-photo/requests'

export { applyPhoto, type PhotoRequest, type PhotoResult } from './stock-photo/apply'
export { parsePhotoRequests } from './stock-photo/requests'
export {
  getStockPhotoProviders,
  registerStockPhotoProvider,
  setActiveStockPhotoProvider,
  setPexelsAPIKey,
  setUnsplashAccessKey,
  type StockPhotoProvider,
  type StockPhotoResult
} from './stock-photo/providers'

export const stockPhoto = defineTool({
  name: 'stock_photo',

  description:
    'Search stock photos and apply to leaf shape nodes. Returns {applied, failed, provider, results: [{id, photo?, error?}]}. Pass a JSON array of requests to fetch in parallel.',
  execution: { kind: 'async', mutation: 'document' },
  capabilities: ['document:write', 'network:access'],
  input: v.object({
    requests: v.pipe(
      v.string(),
      v.description(
        'JSON array: [{"id":"0:5","query":"mountain sunset"},{"id":"0:8","query":"business team","orientation":"square"}]'
      )
    )
  }),
  execute: async (figma, { requests }) => {
    const provider = getActiveProvider()
    if (!provider) {
      return {
        error: `No stock photo provider configured. Ask the user to add an API key in AI chat settings. Available providers: Pexels, Unsplash.`
      }
    }

    const reqs = parsePhotoRequests(requests)
    if ('error' in reqs) return reqs

    const results = await Promise.all(reqs.map((request) => applyPhoto(figma, provider, request)))
    const ok = results.filter((result) => result.photo).length

    return { applied: ok, failed: results.length - ok, provider: provider.name, results }
  }
})
