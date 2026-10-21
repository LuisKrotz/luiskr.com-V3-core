/**
 * @file string-tails.test.js
 * @description Coverage tails for core/utils/string.ts — iterated HTML
 * stripping, entity escaping, slug folding and the meta-description
 * compactor used by route head-sync and the locale-page generator.
 */
import {
  stripHtml,
  escapeHtml,
  slugify,
  mediaSlugSeq,
  splitDrawSentences,
  toMetaDescription,
} from '@core/utils/string.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { MEDIA_SLUG_MAX_LENGTH } from '@core/tokens/routes/aliases.js'

describe('string utils tails', () => {
  test('stripHtml iterates until no reassembled tag survives', () => {
    expect(stripHtml('<b>bold</b> and <scr<script>ipt> tail')).toBe('bold and ipt> tail')
    expect(stripHtml('plain')).toBe('plain')
    expect(stripHtml('')).toBe(CHAR_STRINGS.EMPTY)
    expect(stripHtml(42)).toBe(CHAR_STRINGS.EMPTY)
    expect(stripHtml(null)).toBe(CHAR_STRINGS.EMPTY)
  })

  test('escapeHtml escapes markup-significant characters once', () => {
    expect(escapeHtml('<a href="x">&amp;\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;amp;&#39;')
    expect(escapeHtml('')).toBe(CHAR_STRINGS.EMPTY)
    expect(escapeHtml(null)).toBe(CHAR_STRINGS.EMPTY)
  })

  test('slugify folds case, punctuation and whitespace runs', () => {
    expect(slugify('METCHA — Leather!')).toBe('metcha-leather')
    expect(slugify('  Sp ace_thing  ')).toBe('sp-ace-thing')
    expect(slugify('')).toBe(CHAR_STRINGS.EMPTY)
    expect(slugify(null)).toBe(CHAR_STRINGS.EMPTY)
  })

  test('slugify transliterates Cyrillic labels into latin slugs', () => {
    expect(slugify('фон бренда и структура макета')).toBe('fon-brenda-i-struktura-maketa')
    expect(slugify('Мелисса')).toBe('melissa')
    expect(slugify('вся страница')).toBe('vsya-stranica')
  })

  test('splitDrawSentences splits on terminal punctuation + whitespace only', () => {
    expect(splitDrawSentences('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?'])
    expect(splitDrawSentences('Built with Three.js today')).toEqual(['Built with Three.js today'])
    expect(splitDrawSentences('')).toEqual([])
    expect(splitDrawSentences(null)).toEqual([])
  })

  test('mediaSlugSeq numbers repeated label slugs in document order', () => {
    const seen = new Map()

    expect(mediaSlugSeq(seen, 'Fórum 2020, Full page')).toBe('forum-2020-full-page')
    expect(mediaSlugSeq(seen, 'Fórum 2020: Full Page')).toBe('forum-2020-full-page-2')
    expect(mediaSlugSeq(seen, 'forum 2020 FULL PAGE')).toBe('forum-2020-full-page-3')
    expect(mediaSlugSeq(seen, 'Mobile tour')).toBe('mobile-tour')
    expect(mediaSlugSeq(seen, '!!!')).toBe(CHAR_STRINGS.EMPTY)
    expect(mediaSlugSeq(seen, '')).toBe(CHAR_STRINGS.EMPTY)
  })

  test('mediaSlugSeq caps monster labels on a hyphen boundary', () => {
    const seen = new Map()
    const long = `${'word '.repeat(50)}tail` // 200+ char label → over-long slug

    const slug = mediaSlugSeq(seen, long)
    const full = slugify(long)

    expect(slug.length).toBeLessThanOrEqual(MEDIA_SLUG_MAX_LENGTH)
    expect(slug.endsWith('-')).toBe(false)
    // Ends on a word boundary: it is a prefix of the full slug followed by '-'.
    expect(full.startsWith(`${slug}-`)).toBe(true)
  })

  test('mediaSlugSeq still ordinals labels whose caps collide', () => {
    const seen = new Map()
    const sharedHead = 'same '.repeat(30)

    const first = mediaSlugSeq(seen, `${sharedHead}alpha`)
    const second = mediaSlugSeq(seen, `${sharedHead}beta`)

    expect(first.length).toBeLessThanOrEqual(MEDIA_SLUG_MAX_LENGTH)
    expect(second).toBe(`${first}-2`)
  })

  test('mediaSlugSeq leaves short labels untouched', () => {
    const seen = new Map()

    expect(mediaSlugSeq(seen, 'Mobile tour')).toBe('mobile-tour')
  })

  test('toMetaDescription strips markup, decodes entities, collapses whitespace', () => {
    const html = 'Hi, <b>I&#39;m</b> Luis,<br />a&nbsp; Software &amp; UX &quot;dev&quot;'

    expect(toMetaDescription(html)).toBe('Hi, I\'m Luis, a Software & UX "dev"')
  })

  test('toMetaDescription cuts overlong text at the last word boundary', () => {
    const long = `word${CHAR_STRINGS.SPACE_CHAR}`.repeat(60)

    const out = toMetaDescription(long)

    expect(out.length).toBeLessThanOrEqual(160)
    expect(out.endsWith('word')).toBe(true)
  })

  test('toMetaDescription honors a custom max and empty input', () => {
    expect(toMetaDescription('alpha beta gamma', 10)).toBe('alpha')
    expect(toMetaDescription('short', 160)).toBe('short')
    expect(toMetaDescription('')).toBe(CHAR_STRINGS.EMPTY)
    expect(toMetaDescription(null)).toBe(CHAR_STRINGS.EMPTY)
  })
})
