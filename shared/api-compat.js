// Cross-browser API compatibility layer
// This file ensures consistent behavior across Chrome and Firefox

// Import webextension-polyfill for Firefox compatibility
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  // Chrome environment - use chrome namespace directly
  globalThis.browser = chrome;
} else if (typeof browser !== 'undefined') {
  // Firefox environment - browser namespace is already available
  // No action needed
}

// Extension API wrapper to handle differences between browsers
class ExtensionAPI {
  static get runtime() {
    return browser.runtime;
  }

  static get tabs() {
    return browser.tabs;
  }

  static get storage() {
    return browser.storage;
  }

  static get action() {
    // Chrome MV3 uses 'action', Firefox MV2 uses 'browserAction'
    return browser.action || browser.browserAction;
  }

  // Handle messaging differences
  static sendMessage(message) {
    return browser.runtime.sendMessage(message).catch(() => {
      // Ignore errors when popup is closed
    });
  }

  // Handle storage with promises (consistent across browsers)
  static async getStorage(keys) {
    try {
      // Try sync storage first
      const result = await browser.storage.sync.get(keys);
      return result;
    } catch (syncError) {
      // Fallback to local storage for Firefox
      console.warn('ExtensionAPI: Sync storage failed, using local:', syncError);
      try {
        const result = await browser.storage.local.get(keys);
        return result;
      } catch (localError) {
        console.error('ExtensionAPI: Both storage methods failed:', localError);
        return {};
      }
    }
  }

  static async setStorage(items) {
    try {
      // Try sync storage first
      await browser.storage.sync.set(items);
    } catch (syncError) {
      // Fallback to local storage for Firefox
      console.warn('ExtensionAPI: Sync storage failed, using local:', syncError);
      await browser.storage.local.set(items);
    }
  }

  // Handle tab queries consistently
  static async queryTabs(queryInfo) {
    return await browser.tabs.query(queryInfo);
  }

  // Handle icon setting (action vs browserAction)
  static async setIcon(details) {
    const actionAPI = browser.action || browser.browserAction;
    return await actionAPI.setIcon(details);
  }

  static async setTitle(details) {
    const actionAPI = browser.action || browser.browserAction;
    return await actionAPI.setTitle(details);
  }

  // Handle content script injection differences
  static async executeScript(details) {
    if (browser.scripting && browser.scripting.executeScript) {
      // Chrome MV3 way
      return await browser.scripting.executeScript(details);
    } else if (browser.tabs.executeScript) {
      // Firefox MV2 way
      return await browser.tabs.executeScript(details.target.tabId, {
        code: details.code,
        file: details.files ? details.files[0] : undefined
      });
    }
  }
}

// Make ExtensionAPI globally available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionAPI;
} else {
  globalThis.ExtensionAPI = ExtensionAPI;
}
