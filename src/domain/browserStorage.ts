// Defer access to the browser getter so repository recovery can handle denied storage.
export const browserStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: key => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  removeItem: key => globalThis.localStorage.removeItem(key),
}
