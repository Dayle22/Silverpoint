export const BASE = 'https://openpencil.dev'

export const siteHead: [string, Record<string, string>][] = [
  ['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],
  ['link', { rel: 'alternate', type: 'text/plain', title: 'llms.txt', href: '/llms.txt' }],
  ['link', { rel: 'alternate', type: 'text/plain', title: 'llms-full.txt', href: '/llms-full.txt' }],
  ['meta', { property: 'og:type', content: 'website' }],
  ['meta', { property: 'og:site_name', content: 'OpenPencil' }],
  ['meta', { property: 'og:image', content: `${BASE}/screenshot.png` }],
  ['meta', { property: 'og:image:width', content: '2784' }],
  ['meta', { property: 'og:image:height', content: '1824' }],
  ['meta', { property: 'og:image:alt', content: 'OpenPencil — AI-Native Design Editor' }],
  ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ['meta', { name: 'twitter:site', content: '@openpencildev' }],
  ['meta', { name: 'twitter:image', content: `${BASE}/screenshot.png` }]
]

type PageDataLike = {
  relativePath: string
  title?: string
  description?: string
  frontmatter: {
    head?: [string, Record<string, string>][]
  }
}

function slugForPath(path: string): string {
  return path
    .replace(/\.md$/, '')
    .replace(/\/index$/, '')
    .replace(/^index$/, '')
    .replace(/\/$/, '')
}

export function applyPageSeo(pageData: PageDataLike): void {
  const slug = slugForPath(pageData.relativePath)
  const pageUrl = slug ? `${BASE}/${slug}` : BASE

  pageData.frontmatter.head ??= []
  const head = pageData.frontmatter.head

  head.push(['link', { rel: 'canonical', href: pageUrl }])
  head.push(['meta', { property: 'og:url', content: pageUrl }])
  head.push(['meta', { property: 'og:locale', content: 'en_US' }])

  if (pageData.title) {
    const ogTitle = `${pageData.title} — OpenPencil`
    head.push(['meta', { property: 'og:title', content: ogTitle }])
    head.push(['meta', { name: 'twitter:title', content: ogTitle }])
  }

  if (pageData.description) {
    head.push(['meta', { property: 'og:description', content: pageData.description }])
    head.push(['meta', { name: 'twitter:description', content: pageData.description }])
    head.push(['meta', { name: 'description', content: pageData.description }])
  }
}
