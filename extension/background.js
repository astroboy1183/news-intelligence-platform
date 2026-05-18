// Service worker for the NewsIntel extension.
// Currently minimal: just seeds default settings on install.

const DEFAULTS = {
  apiUrl: "http://localhost:8000",
  webUrl: "http://localhost:3000",
};

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(["apiUrl", "webUrl"]);
  const next = {};
  if (!existing.apiUrl) next.apiUrl = DEFAULTS.apiUrl;
  if (!existing.webUrl) next.webUrl = DEFAULTS.webUrl;
  if (Object.keys(next).length) {
    await chrome.storage.local.set(next);
  }
});
