console.log("🔧 DotPush popup loaded");

// Define UI Elements (new IDs added)
const authView = document.getElementById('authView');
const codeView = document.getElementById('codeView');
const mainView = document.getElementById('mainView');
const loadingView = document.getElementById('loadingView');

const loginBtn = document.getElementById('authButton') || document.getElementById('login-btn');
const pushBtn = document.getElementById('syncButton') || document.getElementById('push-btn');
const logoutBtn = document.getElementById('logoutButton') || document.getElementById('logout-btn');
const copyBtn = document.getElementById('copyButton'); // may be null now
const openGitHubBtn = document.getElementById('openGitHubBtn') || document.getElementById('openGitHubBtn');

const authCodeEl = document.getElementById('authCode') || document.getElementById('auth-code');
const userInfoEl = document.getElementById('userInfo') || document.getElementById('user-info');
const statusEl = document.getElementById('status');

// These elements no longer exist in new UI but references kept for logic safety
const cancelAuthBtn = document.getElementById('cancel-auth');
const authStatusEl = document.getElementById('auth-status');

// State
let currentDeviceCode = null;
let currentVerificationUri = null;
let pollTimeout = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
});

// Check if user is already authenticated
async function checkAuthStatus() {
  try {
    const auth = await githubAuth.loadAuth();
    
    if (auth.github_token && auth.github_username) {
      // Validate token
      const isValid = await githubAuth.validateToken(auth.github_token);
      if (isValid) {
        showLoggedInView(auth);
        return;
      } else {
        // Token expired, clear it
        await githubAuth.clearAuth();
      }
    }
    
    showLoginView();
  } catch (error) {
    console.error('Error checking auth status:', error);
    showLoginView();
  }
}

// Helpers to toggle views
function hideAllViews() {
  [authView, codeView, mainView, loadingView].forEach(v => v && v.classList.add('hidden'));
}

function showLoginView() {
  hideAllViews();
  if (authView) authView.classList.remove('hidden');
  hideStatus();
}

function showCodeView() {
  hideAllViews();
  if (codeView) codeView.classList.remove('hidden');
}

function showLoggedInView(auth) {
  hideAllViews();
  if (mainView) mainView.classList.remove('hidden');

  if (userInfoEl) {
    userInfoEl.innerHTML = `<div><strong>@${auth.github_username}</strong></div><div>ready</div>`;
  }

  if (copyBtn && authCodeEl) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(authCodeEl.textContent || '').then(() => {
        showStatus('Auth code copied!', 'success');
      });
    };
  }
}

// Show auth flow
function showAuthFlow() {
  hideAllViews();
  if (authView) authView.classList.add('hidden');
  if (codeView) codeView.classList.add('hidden');
  if (mainView) mainView.classList.add('hidden');
}

// Show status message
function showStatus(message, type = 'info') {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
  statusEl.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => hideStatus(), 5000);
}

// Hide status message
function hideStatus() {
  statusEl.classList.add('hidden');
}

// Login button click handler
loginBtn.addEventListener('click', async () => {
  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Starting...';
    
    console.log('Starting device flow...');
    const deviceFlow = await githubAuth.startDeviceFlow();
    console.log('Device flow response:', deviceFlow);
    
    if (!deviceFlow.user_code) {
      throw new Error('No user code received from GitHub');
    }
    
    currentDeviceCode = deviceFlow.device_code;
    currentVerificationUri = deviceFlow.verification_uri;
    
    // Update UI with the code
    if (authCodeEl) authCodeEl.textContent = deviceFlow.user_code;

    // auto copy to clipboard and notify
    try {
      await navigator.clipboard.writeText(deviceFlow.user_code);
      showStatus('Auth code copied!', 'success');
    } catch(e) { console.warn('Clipboard copy failed',e); }

    // openGitHubBtn opens verification URL
    if (openGitHubBtn) {
      openGitHubBtn.onclick = () => {
        if (currentVerificationUri) chrome.tabs.create({ url: currentVerificationUri });
      };
    }

    // Switch to main view so code & copy button are visible
    hideAllViews();
    if (codeView) codeView.classList.remove('hidden');

    // Start polling in background script (persists when popup closes)
    chrome.runtime.sendMessage({
      type: 'start-oauth-polling',
      deviceCode: deviceFlow.device_code,
      clientId: githubAuth.getClientId(),
      interval: deviceFlow.interval
    });
    
  } catch (error) {
    console.error('Error starting authentication:', error);
    showStatus(`Failed to start authentication: ${error.message}`, 'error');
    showLoginView();
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Connect to GitHub';
  }
});

// Cancel auth button click handler
if (cancelAuthBtn) {
  cancelAuthBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'stop-oauth-polling' });
    currentDeviceCode = null;
    currentVerificationUri = null;
    showLoginView();
  });
}

// Open GitHub button click handler
if (openGitHubBtn) {
  openGitHubBtn.addEventListener('click', () => {
    if (currentVerificationUri) {
      chrome.tabs.create({ url: currentVerificationUri });
    }
  });
}

// Logout button click handler
if (logoutBtn) logoutBtn.addEventListener('click', async () => {
  await githubAuth.clearAuth();
  showLoginView();
  showStatus('Successfully logged out', 'info');
});

// Push button click handler
if (pushBtn) pushBtn.addEventListener('click', async () => {
  console.log("🚀 Push button clicked!");
  
  try {
    pushBtn.disabled = true;
    pushBtn.textContent = 'Pushing...';
    showStatus('Extracting code from editor...', 'info');
    
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("📋 Active tab:", tabs[0]);
    
    if (!tabs[0].url.includes('leetcode.com')) {
      showStatus('Please navigate to a LeetCode problem page', 'error');
      return;
    }
    
    // First, try to clear any cached scripts by reloading the page content
    console.log("🔄 Refreshing page to clear cache...");
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        world: 'MAIN',
        func: () => {
          // Just a simple script to verify injection works
          console.log("🧹 DotPush: Cache clearing script ran");
        }
      });
    } catch (e) {
      console.log("Cache clear attempt failed:", e);
    }
    
    console.log("💉 Injecting V6 code extractor (MAIN world)…");

    const [{ result: extraction }] = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      world: 'MAIN',
      func: () => {
        // === DotPush V6 Extractor (runs in page MAIN world) ===
        const debug = [];
        let extractedCode = "";
        let method = "";

        function detectLanguage(code) {
          const clean = (code || "").toLowerCase();
          if (/class\s+solution\s*:/i.test(code) || /def\s+\w+\s*\(/.test(code)) return 'python';
          if (/public\s+class/.test(code)) return 'java';
          if (/function\s+\w+\s*\(/.test(code)) return 'javascript';
          if (/#include\s*</.test(code)) return 'cpp';
          return 'python';
        }

        // 1) Monaco
        try {
          if (window.monaco && window.monaco.editor) {
            const models = window.monaco.editor.getModels();
            debug.push('monaco models:' + models.length);
            for (const m of models) {
              const val = m.getValue();
              if (val && val.length > extractedCode.length) { extractedCode = val; method = 'Monaco'; }
            }
          }
        } catch (e) { debug.push('monaco error:' + e.message); }

        // 2) Textareas
        if (!extractedCode) {
          const tArr = Array.from(document.querySelectorAll('textarea'));
          debug.push('textareas:' + tArr.length);
          tArr.forEach((ta, idx) => {
            const v = ta.value || '';
            if (v.length > extractedCode.length) { extractedCode = v; method = 'Textarea #' + idx; }
          });
        }

        // 3) CodeMirror
        if (!extractedCode && window.CodeMirror) {
          try {
            const cmEls = Array.from(document.querySelectorAll('.CodeMirror'));
            debug.push('codemirror elements:' + cmEls.length);
            cmEls.forEach((el, idx) => {
              if (el.CodeMirror && el.CodeMirror.getValue) {
                const val = el.CodeMirror.getValue();
                if (val.length > extractedCode.length) { extractedCode = val; method = 'CodeMirror #' + idx; }
              }
            });
          } catch (e) { debug.push('cm error:' + e.message); }
        }

        // 4) DOM text fallback
        if (!extractedCode) {
          const candidates = Array.from(document.querySelectorAll('[class*="editor"], [id*="editor"], pre code'));
          debug.push('editor-like elements:' + candidates.length);
          candidates.forEach((el, idx) => {
            const txt = el.textContent || '';
            if (txt.trim().length > extractedCode.length) { extractedCode = txt.trim(); method = 'DOM text #' + idx; }
          });
        }

        return {
          ok: !!extractedCode,
          code: (extractedCode || '').trim(),
          language: detectLanguage(extractedCode),
          method,
          debug
        };
      }
    });

    if (!extraction || !extraction.ok) {
      console.error('❌ V6: Extraction failed', extraction && extraction.debug);
      showStatus('Failed to extract code. Please ensure the code editor is visible.', 'error');
      return;
    }

    console.log('✅ V6: Extracted', extraction.code.length, 'chars via', extraction.method);
    await pushToGitHub(extraction.code, tabs[0].url, extraction.language);
    
  } catch (error) {
    console.error('❌ Error pushing code:', error);
    showStatus(`Failed to push code: ${error.message}`, 'error');
  } finally {
    pushBtn.disabled = false;
    pushBtn.textContent = 'Push Solution';
  }
});

// Listen for messages from content script and background script
chrome.runtime.onMessage.addListener(async (request, sender) => {
  console.log("📨 Received message:", request.type, request.version || "unknown version");
  
  if (request.type === "leetcode-code-v5") {
    console.log("🎉 V5 SUCCESS! Received code from V5 script:");
    console.log("📊 V5 Method:", request.method);
    console.log("📊 V5 Debug info:", request.debug);
    console.log("📥 V5 Code length:", request.code.length, "characters");
    await pushToGitHub(request.code, request.url, request.language);
  } else if (request.type === "leetcode-code") {
    console.log("⚠️  OLD SCRIPT! Received code from old/cached script:");
    console.log("📥 Old script code:", request.code.substring(0, 100) + "...");
    console.log("🔄 This means the V5 script didn't run - still have caching issues!");
    await pushToGitHub(request.code, request.url, request.language);
  } else if (request.type === "error-v5") {
    console.error("❌ V5 Error:", request.message);
    console.error("📊 V5 Debug info:", request.debug);
    showStatus(request.message, 'error');
    
    // Re-enable push button on error
    const pushBtn = document.getElementById('push-btn');
    if (pushBtn) {
      pushBtn.disabled = false;
      pushBtn.textContent = 'Push Solution';
    }
  } else if (request.type === "auth-complete") {
    console.log("🎉 Authentication completed in background!");
    
    // Update auth status
    if (authStatusEl) {
      authStatusEl.textContent = "✅ Authentication successful!";
      authStatusEl.className = "status success";
    }
    
    // Show logged in view after a brief delay so user can see the success message
    setTimeout(() => {
      showLoggedInView({
        github_token: request.token,
        github_username: request.userInfo.login,
        github_user_info: request.userInfo
      });
      
      showStatus('Successfully authenticated with GitHub!', 'success');
    }, 1000);
  } else if (request.type === "error") {
    console.error("❌ Error from old script:", request.message);
    showStatus(request.message, 'error');
    
    // Re-enable push button on error
    const pushBtn = document.getElementById('push-btn');
    if (pushBtn) {
      pushBtn.disabled = false;
      pushBtn.textContent = 'Push Solution';
    }
  }
});

// Auto-create repository if it doesn't exist
async function ensureRepositoryExists(token, username, repoName) {
  const repoUrl = `https://api.github.com/repos/${username}/${repoName}`;
  
  try {
    const response = await fetch(repoUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "DotPush-Extension"
      }
    });
    
    if (response.ok) {
      console.log("Repository exists");
      return true;
    }
    
    if (response.status === 404) {
      console.log("Repository doesn't exist, creating it...");
      
      const createResponse = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "DotPush-Extension"
        },
        body: JSON.stringify({
          name: repoName,
          description: "LeetCode solutions auto-pushed from DotPush extension",
          private: false,
          auto_init: true
        })
      });
      
      if (createResponse.ok) {
        console.log("Repository created successfully!");
        showStatus(`Created repository: ${username}/${repoName}`, 'success');
        return true;
      } else {
        const errorData = await createResponse.json();
        console.error("Failed to create repository:", errorData);
        return false;
      }
    }
    
    console.error("Unexpected response:", response.status);
    return false;
  } catch (error) {
    console.error("Error checking/creating repository:", error);
    return false;
  }
}

// Push code to GitHub
async function pushToGitHub(code, url, language = 'python') {
  try {
    console.log("pushToGitHub()", { code, url, language });
    
    // Get authentication info
    const auth = await githubAuth.loadAuth();
    if (!auth.github_token || !auth.github_username) {
      showStatus('Please authenticate with GitHub first', 'error');
      return;
    }
    
    const slug = getProblemSlug(url);
    const fileExtension = getFileExtension(language);
    const fileName = `${slug}.${fileExtension}`;
    const path = `leetcode/${fileName}`;
    const repoName = "leetcode";
    const token = auth.github_token;
    const username = auth.github_username;
    const apiUrl = `https://api.github.com/repos/${username}/${repoName}/contents/${path}`;
    const contentB64 = btoa(unescape(encodeURIComponent(code)));

    // Ensure repository exists
    const repoExists = await ensureRepositoryExists(token, username, repoName);
    if (!repoExists) {
      showStatus('Could not create or access repository', 'error');
      return;
    }

    // Check if file already exists to get its SHA
    const checkResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "dotpush-extension"
      }
    });

    let sha = null;
    let exists = false;
    if (checkResponse.ok) {
      const data = await checkResponse.json();
      sha = data.sha;
      exists = true;
    } else if (checkResponse.status !== 404) {
      const errorData = await checkResponse.json();
      console.error(`GitHub API error (${checkResponse.status}):`, errorData);
      showStatus(`GitHub API error: ${errorData.message}`, 'error');
      return;
    }

    const commitMessage = exists ? `update ${slug} solution` : `Add solution for ${slug}`;
    const body = {
      message: commitMessage,
      content: contentB64,
      branch: 'main',
      ...(exists ? { sha } : {})
    };

    const putResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "dotpush-extension"
      },
      body: JSON.stringify(body)
    });

    const result = await putResponse.json();
    if (result.content) {
      console.log(`File pushed: ${result.content.path}`);
      showStatus(`✅ Pushed ${fileName} (${language}) to GitHub!`, 'success');
    } else {
      console.error('GitHub push error:', result);
      showStatus(`Failed to push: ${result.message || 'Unknown error'}`, 'error');
    }
  } catch (err) {
    console.error('Network/API error:', err);
    showStatus('Network error occurred', 'error');
  }
}

// Helper to extract problem slug from URL
function getProblemSlug(url) {
  const match = url.match(/leetcode\.com\/problems\/([^\/]+)/);
  return match ? match[1] : 'solution';
}

// Map language to file extension
function getFileExtension(language) {
  const map = {
    python: 'py',
    java: 'java',
    javascript: 'js',
    typescript: 'ts',
    cpp: 'cpp',
    c: 'c',
    go: 'go',
    rust: 'rs',
    kotlin: 'kt',
    swift: 'swift'
  };
  return map[language] || 'txt';
}