export default defineContentScript({
  // Development fixture only. Replace with the verified store's exact origins.
  matches: ['http://localhost/*'],
  main() {
    // A: check local consent before observing products; mount UI in Shadow DOM.
    console.info('Unhaul development content script ready');
  },
});
