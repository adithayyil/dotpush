// Background script for DotPush Extension
// Handles OAuth authentication polling that persists when popup closes

class BackgroundAuth {
  constructor() {
    this.polling = false;
    this.pollInterval = null;
  }

  // Start polling for OAuth token in background
  async startPolling(deviceCode, clientId, interval = 5) {
    if (this.polling) {
      console.log('Already polling, stopping previous poll');
      this.stopPolling();
    }

    this.polling = true;
    console.log('Starting background polling for OAuth token');

    const poll = async () => {
      if (!this.polling) return;

      try {
        const response = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: `client_id=${clientId}&device_code=${deviceCode}&grant_type=urn:ietf:params:oauth:grant-type:device_code`
        });

        const data = await response.json();

        if (data.access_token) {
          console.log('✅ OAuth token received!');
          
          // Get user info
          const userResponse = await fetch("https://api.github.com/user", {
            headers: {
              "Authorization": `Bearer ${data.access_token}`,
              "User-Agent": "DotPush-Extension"
            }
          });
          
          if (userResponse.ok) {
            const userInfo = await userResponse.json();
            
            // Auto-create leetcode-sync repository
            await this.createLeetCodeRepository(data.access_token, userInfo.login);
            
            // Save authentication
            await chrome.storage.sync.set({
              github_token: data.access_token,
              github_username: userInfo.login,
              github_user_info: userInfo
            });
            
            console.log(`✅ Authentication saved for user: ${userInfo.login}`);
            
            // Notify popup if it's open
            this.notifyAuthComplete(data.access_token, userInfo);
          }
          
          this.stopPolling();
        } else if (data.error === "authorization_pending") {
          console.log('⏳ Authorization pending...');
          this.pollInterval = setTimeout(poll, interval * 1000);
        } else if (data.error === "slow_down") {
          console.log('🐌 Rate limited, slowing down...');
          this.pollInterval = setTimeout(poll, (interval + 5) * 1000);
        } else {
          console.error('❌ OAuth error:', data.error);
          this.stopPolling();
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
        this.stopPolling();
      }
    };

    // Start polling immediately
    poll();
  }

  stopPolling() {
    this.polling = false;
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('🛑 Stopped OAuth polling');
  }

  // Notify popup of completed authentication
  notifyAuthComplete(token, userInfo) {
    // Send message to popup if it's listening
    chrome.runtime.sendMessage({
      type: 'auth-complete',
      token: token,
      userInfo: userInfo
    }).catch(() => {
      // Popup might be closed, that's OK
    });
  }

  async createLeetCodeRepository(token, username) {
    const repoName = "leetcode-sync";
    const repoUrl = `https://api.github.com/repos/${username}/${repoName}`;
    
    try {
      // Check if repository already exists
      const checkResponse = await fetch(repoUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "DotPush-Extension"
        }
      });
      
      if (checkResponse.ok) {
        console.log("Repository already exists");
        return true;
      }
      
      if (checkResponse.status === 404) {
        console.log("Creating leetcode-sync repository...");
        
        const createResponse = await fetch("https://api.github.com/user/repos", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "DotPush-Extension"
          },
          body: JSON.stringify({
            name: repoName,
            description: "LeetCode solutions automatically synced from DotPush extension",
            private: false,
            auto_init: true
          })
        });
        
        if (createResponse.ok) {
          console.log("✅ Repository created successfully!");
          return true;
        } else {
          const errorData = await createResponse.json();
          console.error("❌ Failed to create repository:", errorData);
          return false;
        }
      }
      
      console.error("Unexpected response:", checkResponse.status);
      return false;
    } catch (error) {
      console.error("❌ Error checking/creating repository:", error);
      return false;
    }
  }
}

const backgroundAuth = new BackgroundAuth();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'start-oauth-polling') {
    backgroundAuth.startPolling(request.deviceCode, request.clientId, request.interval);
    sendResponse({ success: true });
  } else if (request.type === 'stop-oauth-polling') {
    backgroundAuth.stopPolling();
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open
}); 