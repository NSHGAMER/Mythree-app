import '@testing-library/jest-dom/vitest'

// jsdom lacks matchMedia
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// jsdom lacks scrollIntoView / scrollTo
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {}
window.scrollTo = (() => {}) as typeof window.scrollTo
