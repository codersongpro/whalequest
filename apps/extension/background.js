/* global chrome */
// No persistent timer or server runs in the service worker.
chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.set({installedVersion:chrome.runtime.getManifest().version});
});
