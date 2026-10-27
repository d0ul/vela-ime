/*
 * Hand-off to the IME scene (pages/ime): open it with a title and starting text, and read the typed text
 * back when the caller's page is shown again. The text travels through storage because a page that is
 * navigated back to cannot receive router params.
 */
import router from '@system.router'
import storage from '@system.storage'

const KEY = 'ime.result'

/** The result is emptied first, so a leftover from an earlier session is never taken as this one's. */
export function openIme(opts) {
  const go = () => router.push({ uri: 'pages/ime', params: { title: opts.title || '', init: opts.text || '' } })
  storage.set({ key: KEY, value: '', success: go, fail: go })
}

/** Called by the IME scene on confirm. */
export function finishIme(text) {
  const back = () => router.back()
  storage.set({ key: KEY, value: text, success: back, fail: back })
}

/** The text typed in the IME since the last call, or '' if it was left without confirming. */
export function takeImeResult() {
  return new Promise((resolve) => {
    storage.get({
      key: KEY,
      success: (v) => {
        if (v) storage.set({ key: KEY, value: '' }) // taken: reset to empty
        resolve(v || '')
      },
      fail: () => resolve('')
    })
  })
}
