import '@testing-library/jest-dom'

// Create a Storage implementation that has clear()
if (typeof localStorage === 'undefined' || !localStorage.clear) {
  const createStorage = () => {
    const store: Record<string, string> = {}

    return {
      get length() {
        return Object.keys(store).length
      },
      key(index: number) {
        const keys = Object.keys(store)
        return keys[index] || null
      },
      getItem(key: string) {
        return store[key] || null
      },
      setItem(key: string, value: string) {
        store[key] = value
      },
      removeItem(key: string) {
        delete store[key]
      },
      clear() {
        Object.keys(store).forEach(key => {
          delete store[key]
        })
      },
    }
  }

  // Only override if localStorage isn't a proper Storage implementation
  if (typeof localStorage.getItem !== 'function') {
    ;(globalThis as unknown as Storage).localStorage = createStorage()
  }
}
