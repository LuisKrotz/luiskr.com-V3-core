/**
 * @file tokens/playground/about.ts
 * @description JSON-LD `about` anchors for the experiment pages — the
 * Wikidata-linked Thing lists both the build-time emitter
 * (build-locale-pages.mjs) and the runtime graph builders
 * (core/utils/schema.ts) attach to each playground's WebPage so theme
 * searches resolve through the knowledge graph, not just page text.
 * Sole declaration site for these literals (zero-hardcoding rule);
 * kept import-free so the standalone Node build generators can consume
 * it under plain type-stripping.
 */

/**
 * Earth Playground WebPage anchors — Earth, Planet and the Computer
 * simulation concept the page is an instance of.
 */
export const EP_ABOUT = Object.freeze([
  { '@type': 'Thing', name: 'Earth', sameAs: 'https://www.wikidata.org/wiki/Q2' },
  { '@type': 'Thing', name: 'Planet', sameAs: 'https://www.wikidata.org/wiki/Q634' },
  {
    '@type': 'Thing',
    name: 'Computer simulation',
    sameAs: 'https://www.wikidata.org/wiki/Q925667',
  },
])

/**
 * Star Field WebPage anchors — the Star and Galaxy concepts the chart
 * visualizes.
 */
export const SF_ABOUT = Object.freeze([
  { '@type': 'Thing', name: 'Star', sameAs: 'https://www.wikidata.org/wiki/Q523' },
  { '@type': 'Thing', name: 'Galaxy', sameAs: 'https://www.wikidata.org/wiki/Q321' },
])
