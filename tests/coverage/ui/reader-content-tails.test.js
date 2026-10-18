/**
 * @file reader-content-tails.test.js
 * @description Covers core/locale/reader-content.ts — holder creation and
 * parked-article reuse, per-path markup caching, non-ok/throwing fetches,
 * and the generation guard that keeps a slow earlier fetch from
 * overwriting newer route content.
 */
import { jest } from '@jest/globals'

import { updateReaderContent } from '@core/locale/reader-content.js'

import { READER_CLASSES } from '@core/tokens/classes/reader.js'
import { HTML_TAGS } from '@core/tokens/elements/html.js'
import { ROUTE_PATHS } from '@core/tokens/routes/paths.js'
import { CHAR_STRINGS } from '@core/tokens/strings/chars.js'
import { TEST_PROJECTS, TEST_TEXT } from '@tests/fixtures/test-constants.js'

const pathA = `/${ROUTE_PATHS.PORTFOLIO_SEGMENT}/${TEST_PROJECTS.METCHA}`
const pathB = `/${ROUTE_PATHS.PORTFOLIO_SEGMENT}/${TEST_PROJECTS.SAGE}`
const pathC = `/${ROUTE_PATHS.PORTFOLIO_SEGMENT}/${TEST_PROJECTS.CICB}`
const pathD = `/${ROUTE_PATHS.PORTFOLIO_SEGMENT}/${TEST_PROJECTS.MINI_MELISSA}`

/** Minimal Response stand-in for the module's ok/text surface. */
const pageOf = (body, ok = true) => ({
  ok,
  text: async () => `<html><body>${body}</body></html>`,
})

/** Reader-article markup embedded in a fake prerendered page. */
const docOf = (markup) => `<article class="${READER_CLASSES.CONTENT}">${markup}</article>`

/** Current parked holder in the document (the module's observed surface). */
const parked = () => document.querySelector(`article.${READER_CLASSES.CONTENT}`)

describe('reader-content tails', () => {
  const realFetch = globalThis.fetch

  beforeEach(() => {
    document.querySelectorAll(`article.${READER_CLASSES.CONTENT}`).forEach((el) => el.remove())
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('creates an offscreen holder and leaves it empty for pages without an article', async () => {
    globalThis.fetch = jest.fn(async () => pageOf('<p></p>'))

    await updateReaderContent(pathA)

    const el = parked()

    expect(el).toBeTruthy()
    expect(el.classList.contains(READER_CLASSES.OFFSCREEN)).toBe(true)
    expect(el.innerHTML).toBe(CHAR_STRINGS.EMPTY)
  })

  test('swaps in the fetched article markup and serves repeat visits from cache', async () => {
    const markup = `<p>${TEST_TEXT.BODY}</p>`

    globalThis.fetch = jest.fn(async () => pageOf(docOf(markup)))

    await updateReaderContent(pathB)
    await updateReaderContent(pathB)

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(parked().innerHTML).toBe(markup)
  })

  test('a non-ok response clears the parked copy', async () => {
    const markup = `<p>${TEST_TEXT.SECOND}</p>`

    globalThis.fetch = jest
      .fn()
      .mockImplementationOnce(async () => pageOf(docOf(markup)))
      .mockImplementationOnce(async () => pageOf('<p></p>', false))

    await updateReaderContent(pathB + TEST_TEXT.SECOND)
    expect(parked().innerHTML).toBe(markup)

    await updateReaderContent(pathC)
    expect(parked().innerHTML).toBe(CHAR_STRINGS.EMPTY)
  })

  test('a stale earlier fetch never overwrites the newer navigation', async () => {
    const staleMarkup = `<p>${TEST_TEXT.STALE}</p>`
    const freshMarkup = `<p>${TEST_TEXT.HELLO}</p>`

    let resolveStale

    globalThis.fetch = jest
      .fn()
      .mockImplementationOnce(
        () => new Promise((res) => (resolveStale = () => res(pageOf(docOf(staleMarkup)))))
      )
      .mockImplementationOnce(async () => pageOf(docOf(freshMarkup)))

    const stale = updateReaderContent(pathA + TEST_TEXT.STALE)
    const fresh = updateReaderContent(pathB + TEST_TEXT.HELLO)

    await fresh
    resolveStale()
    await stale

    expect(parked().innerHTML).toBe(freshMarkup)
  })

  test('a rejecting fetch keeps whatever copy is already parked', async () => {
    const kept = `<p>${TEST_TEXT.HEADING}</p>`

    globalThis.fetch = jest
      .fn()
      .mockImplementationOnce(async () => pageOf(docOf(kept)))
      .mockImplementationOnce(async () => {
        throw new Error(TEST_TEXT.UNKNOWN)
      })

    await updateReaderContent(pathC + TEST_TEXT.HEADING)
    await updateReaderContent(pathD)

    expect(parked().innerHTML).toBe(kept)
  })

  test('reattaches to a parked article already present in the document', async () => {
    // Disconnect the module-held holder, then plant a different parked
    // article — ensureHolder must adopt it instead of creating a third one.
    const held = parked()

    if (held) held.remove()

    const planted = document.createElement(HTML_TAGS.ARTICLE)

    planted.classList.add(READER_CLASSES.CONTENT, READER_CLASSES.OFFSCREEN)
    document.body.appendChild(planted)

    const markup = `<p>${TEST_TEXT.LUIS_KROTZ}</p>`

    globalThis.fetch = jest.fn(async () => pageOf(docOf(markup)))

    await updateReaderContent(pathD + TEST_TEXT.LUIS_KROTZ)

    expect(planted.innerHTML).toBe(markup)
    expect(document.querySelectorAll(`article.${READER_CLASSES.CONTENT}`).length).toBe(1)
  })
})
