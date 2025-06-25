// GitHub Device Flow OAuth for dotpush Extension
// This provides a user-friendly way to authenticate without client secrets

// Import API compatibility layer
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  globalThis.browser = chrome;
}

class GitHubAuth {
  constructor() {
    this.clientId = "Ov23liF5VVlXCN41NE79";
    this.deviceCodeUrl = "https://github.com/login/device/code";
    this.tokenUrl = "https://github.com/login/oauth/access_token";
  }

  // Getter for clientId
  getClientId() {
    return this.clientId;
  }

  // Start the OAuth device flow
  async startDeviceFlow() {
    // Check if client ID is configured
    if (!this.clientId || this.clientId === "YOUR_GITHUB_OAUTH_CLIENT_ID") {
      throw new Error("GitHub OAuth Client ID not configured. Please follow the setup instructions in README.md");
    }

    // Check if we have the necessary permissions
    try {
      // Note: Firefox doesn't have runtime permissions API like Chrome
      if (browser.permissions && browser.permissions.contains) {
        const hasPermissions = await browser.permissions.contains({
          origins: ["https://github.com/*"]
        });
        
        if (!hasPermissions) {
          const granted = await browser.permissions.request({
            origins: ["https://github.com/*"]
          });
          
          if (!granted) {
            throw new Error("GitHub permissions not granted. Please allow access to GitHub.");
          }
        }
      }
    } catch (permError) {
      // Continue anyway - might be in development mode or Firefox
    }

    try {
      const response = await fetch(this.deviceCodeUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `client_id=${this.clientId}&scope=public_repo`
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      // Check if we got an error in the response
      if (data.error) {
        throw new Error(`GitHub error: ${data.error_description || data.error}`);
      }
      
      // Validate that we got all required fields
      if (!data.device_code || !data.user_code || !data.verification_uri) {
        throw new Error("Invalid response from GitHub: missing required fields");
      }

      return {
        device_code: data.device_code,
        user_code: data.user_code,
        verification_uri: data.verification_uri,
        expires_in: data.expires_in,
        interval: data.interval
      };
    } catch (error) {
      throw error;
    }
  }

  // Poll for the access token
  async pollForToken(deviceCode, interval = 5) {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const response = await fetch(this.tokenUrl, {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: `client_id=${this.clientId}&device_code=${deviceCode}&grant_type=urn:ietf:params:oauth:grant-type:device_code`
          });

          const data = await response.json();

          if (data.access_token) {
            resolve(data.access_token);
          } else if (data.error === "authorization_pending") {
            setTimeout(poll, interval * 1000);
          } else if (data.error === "slow_down") {
            setTimeout(poll, (interval + 5) * 1000);
          } else {
            reject(new Error(data.error_description || data.error));
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  // Get user info using the token
  async getUserInfo(token) {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": "dotpush-Extension"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Save token and user info to browser storage
  async saveAuth(token, userInfo) {
    try {
      // Use both storage.sync and storage.local for Firefox compatibility
      const authData = {
        github_token: token,
        github_username: userInfo.login,
        github_user_info: userInfo
      };
      
      // Try storage.sync first (preferred)
      try {
        await browser.storage.sync.set(authData);
      } catch (syncError) {
        // Fallback to storage.local if sync fails (common in Firefox)
        console.warn('Storage.sync failed, using storage.local:', syncError);
        await browser.storage.local.set(authData);
      }
    } catch (error) {
      console.error('Failed to save auth:', error);
      throw error;
    }
  }

  // Load saved authentication
  async loadAuth() {
    try {
      let result;
      // Try storage.sync first
      try {
        result = await browser.storage.sync.get(['github_token', 'github_username', 'github_user_info']);
        console.log('Auth: Loaded from storage.sync:', !!result.github_token);
      } catch (syncError) {
        // Fallback to storage.local
        console.warn('Storage.sync get failed, using storage.local:', syncError);
        result = await browser.storage.local.get(['github_token', 'github_username', 'github_user_info']);
        console.log('Auth: Loaded from storage.local:', !!result.github_token);
      }
      return result || {};
    } catch (error) {
      console.error('Failed to load auth:', error);
      return {};
    }
  }

  // Clear saved authentication
  async clearAuth() {
    try {
      const keys = ['github_token', 'github_username', 'github_user_info'];
      // Clear from both storage types
      try {
        await browser.storage.sync.remove(keys);
      } catch (syncError) {
        console.warn('Storage.sync remove failed:', syncError);
      }
      try {
        await browser.storage.local.remove(keys);
      } catch (localError) {
        console.warn('Storage.local remove failed:', localError);
      }
    } catch (error) {
      console.error('Failed to clear auth:', error);
    }
  }

  // Check if token is still valid
  async validateToken(token) {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": "dotpush-Extension"
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Global auth instance
const githubAuth = new GitHubAuth(); 