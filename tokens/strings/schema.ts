/**
 * @file tokens/strings/schema.js
 * @description Schema.org / SEO JSON-LD string tokens — grouped subset of
 * STRINGS.
 */

/**
 * Schema.org / SEO JSON-LD string tokens. Sole declaration site — consumers import members
 * from this frozen map rather than re-declaring the literals
 * (zero-hardcoding rule).
 */
export const SCHEMA_STRINGS = Object.freeze({
  SCHEMA_CONTEXT: 'https://schema.org',
  NOINDEX_NOFOLLOW: 'noindex, nofollow',
  INDEX_RICH_DIRECTIVES:
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  JSON_LD_SCRIPT_TYPE: 'application/ld+json',
  JSON_LD_SCRIPT_ID: 'jsonld-graph',
  SCHEMA_SHARE_IMAGE: '/assets/icons/share.png',
  SCHEMA_ORG_LOGO: '/assets/icons/android-chrome-256x256.png',
  SCHEMA_SITE_DESCRIPTION:
    'Front-End Software Engineer specializing in performance, design systems, and animations.',
  /** Person entity facts — the sole author's knowledge-graph record. */
  SCHEMA_PERSON_ALT_NAME: 'Jacson Luis Krötz',
  SCHEMA_PERSON_JOB_TITLE: 'Front-End Software Engineer',
  SCHEMA_PERSON_NATIONALITY: 'Brazil',
  /** Comma-separated expertise list — split(', ') where the entity wants an array. */
  SCHEMA_PERSON_KNOWS_ABOUT:
    'JavaScript, TypeScript, CSS, WebGL, WebGPU, Three.js, design systems, UI/UX, performance optimization, creative coding',
  /** og:type values per route class. */
  SCHEMA_OG_WEBSITE: 'website',
  SCHEMA_OG_ARTICLE: 'article',
  SCHEMA_OG_PROFILE: 'profile',
  SCHEMA_OG_VIDEO: 'video.other',
  /** profile:* meta values for the about route's og:type=profile card. */
  SCHEMA_PROFILE_FIRST_NAME: 'Luis',
  SCHEMA_PROFILE_LAST_NAME: 'Krötz',
  SCHEMA_PROFILE_USERNAME: 'LuisKr1906',
  /** Article.articleSection + article:section for every portfolio page. */
  SCHEMA_ARTICLE_SECTION: 'Portfolio',
  /** Open Graph article timestamp metadata keys (used only with verified dates). */
  SCHEMA_ARTICLE_PUBLISHED_TIME: 'article:published_time',
  SCHEMA_ARTICLE_MODIFIED_TIME: 'article:modified_time',
})
