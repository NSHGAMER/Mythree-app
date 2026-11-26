// Test stub for the vite-plugin-pwa virtual module.
export function useRegisterSW() {
  return { needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: async () => {} }
}
