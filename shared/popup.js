// Import API compatibility layer
// This ensures the extension works across Chrome and Firefox
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  globalThis.browser = chrome;
}

// Define UI Elements
const authView = document.getElementById('authView');
const codeView = document.getElementById('codeView');
const mainView = document.getElementById('mainView');
const loadingView = document.getElementById('loadingView');

// New view for non-LeetCode pages
const notLeetView = document.getElementById('notLeetView');
const goLeetBtn = document.getElementById('goLeetBtn');

const loginBtn = document.getElementById('authButton') || document.getElementById('login-btn');
const pushBtn = document.getElementById('syncButton') || document.getElementById('push-btn');
const logoutBtn = document.getElementById('logoutButton') || document.getElementById('logout-btn');
const repoBtn = document.getElementById('repoButton');
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
let currentFileUrl = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const onLeetCode = tab && tab.url && tab.url.includes('leetcode.com');

    if (!onLeetCode) {
      showNotLeetView();
      // Optional: open leetcode when button clicked
      if (goLeetBtn) {
        goLeetBtn.addEventListener('click', () => {
          browser.tabs.update(tab.id, { url: 'https://leetcode.com/' });
        });
      }
      return; // stop further init
    }
  } catch (e) {
    // fallback
  }

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
    console.error('Auth check failed:', error);
    showLoginView();
  }
}

// Firefox-specific: Periodically check for auth completion
function startAuthPolling() {
  console.log('Starting auth polling for Firefox compatibility');
  const pollInterval = setInterval(async () => {
    try {
      console.log('Checking auth status...');
      const auth = await githubAuth.loadAuth();
      if (auth.github_token && auth.github_username) {
        console.log('Auth found! Validating token...');
        clearInterval(pollInterval);
        const isValid = await githubAuth.validateToken(auth.github_token);
        if (isValid) {
          console.log('Token valid! Showing logged in view');
          showLoggedInView(auth);
          showStatus('Successfully authenticated with GitHub!', 'success');
        } else {
          console.log('Token invalid, clearing auth');
          await githubAuth.clearAuth();
        }
      }
    } catch (error) {
      console.log('Auth polling error:', error);
      // Continue polling
    }
  }, 2000); // Check every 2 seconds
  
  // Stop polling after 5 minutes
  setTimeout(() => {
    console.log('Auth polling timeout reached');
    clearInterval(pollInterval);
  }, 5 * 60 * 1000);
}

// Helpers to toggle views
function hideAllViews() {
  [authView, codeView, mainView, loadingView, notLeetView].forEach(v => v && v.classList.add('hidden'));
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

function showNotLeetView() {
  hideAllViews();
  if (notLeetView) notLeetView.classList.remove('hidden');
  hideStatus();
}

// Setup functions removed - no longer needed with direct authentication

async function showLoggedInView(auth) {
  // Skip setup flow and go directly to main view
  hideAllViews();
  if (mainView) mainView.classList.remove('hidden');

  if (userInfoEl) {
    userInfoEl.textContent = `Logged in as: @${auth.github_username}`;
  }
  
  // Hide repo button initially until a successful push
  if (repoBtn) {
    repoBtn.classList.add('hidden');
  }

  if (copyBtn && authCodeEl) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(authCodeEl.textContent || '').then(() => {
        showStatus('Auth code copied!', 'success');
      });
    };
  }
}

// Show status message
function showStatus(message, type = 'info') {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
  statusEl.classList.remove('hidden');
  
  // Auto-hide after different durations based on type
  const duration = type === 'warning' ? 8000 : type === 'error' ? 7000 : 5000;
  setTimeout(() => hideStatus(), duration);
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
    
    const deviceFlow = await githubAuth.startDeviceFlow();
    
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
    } catch(e) { }

    // Switch to main view so code & copy button are visible
    hideAllViews();
    if (codeView) codeView.classList.remove('hidden');

    // Start polling in background script (persists when popup closes)
    try {
      browser.runtime.sendMessage({
        type: 'start-oauth-polling',
        deviceCode: deviceFlow.device_code,
        clientId: githubAuth.getClientId(),
        interval: deviceFlow.interval
      });
    } catch (msgError) {
      console.warn('Background message failed (continuing with local polling):', msgError);
    }
    
    // Start local polling for Firefox compatibility
    startAuthPolling();
    
  } catch (error) {
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
    browser.runtime.sendMessage({ type: 'stop-oauth-polling' });
    currentDeviceCode = null;
    currentVerificationUri = null;
    showLoginView();
  });
}

// Open GitHub button click handler
if (openGitHubBtn) {
  openGitHubBtn.addEventListener('click', () => {
    if (currentVerificationUri) {
      browser.tabs.create({ url: currentVerificationUri });
    }
  });
}

// Logout button click handler
if (logoutBtn) logoutBtn.addEventListener('click', async () => {
  await githubAuth.clearAuth();
  currentFileUrl = null;
  if (repoBtn) {
    repoBtn.classList.add('hidden');
  }
  showLoginView();
  showStatus('Successfully logged out', 'info');
});

// Push button click handler
if (pushBtn) pushBtn.addEventListener('click', async () => {
  
  try {
    pushBtn.disabled = true;
    pushBtn.textContent = 'Pushing...';
    showStatus('extracting code...', 'info');
    
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    
    const currentUrl = tabs[0].url || '';

    // Require LeetCode problem page
    if (!currentUrl.includes('leetcode.com')) {
      showStatus('Go to LeetCode first', 'error');
      return;
    }

    if (!/leetcode\.com\/problems\//.test(currentUrl)) {
      showStatus('Open a specific LeetCode problem page before pushing', 'error');
      return;
    }
    
    // First, try to clear any cached scripts by reloading the page content
    try {
      if (browser.scripting && browser.scripting.executeScript) {
        // Chrome MV3 way
        await browser.scripting.executeScript({
          target: { tabId: tabs[0].id },
          world: 'MAIN',
          func: () => {
            // Just a simple script to verify injection works
          }
        });
      } else if (browser.tabs.executeScript) {
        // Firefox MV2 way
        await browser.tabs.executeScript(tabs[0].id, {
          code: '// Just a simple script to verify injection works'
        });
      }
    } catch (e) {
    }
    

    // Execute code extraction script cross-browser
    let extraction;
    try {
      if (browser.scripting && browser.scripting.executeScript) {
        // Chrome MV3 way
        const [{ result }] = await browser.scripting.executeScript({
          target: { tabId: tabs[0].id },
          world: 'MAIN',
          func: () => {
            // Inline the extraction function for Chrome
            const debug = [];
            let extractedCode = "";
            let method = "";

            function detectLanguage(code) {
              const clean = code || "";
              
              // C++ detection
              if (/#include\s*<.*>/.test(code) && (/std::/.test(code) || /cout/.test(code) || /cin/.test(code))) return 'cpp';
              if (/class\s+Solution\s*{/.test(code) && /#include/.test(code)) return 'cpp';
              
              // Java detection  
              if (/public\s+class\s+\w+/.test(code) && /public\s+\w+.*\(/.test(code)) return 'java';
              if (/class\s+Solution\s*{/.test(code) && /public\s+/.test(code)) return 'java';
              
              // C# detection
              if (/using\s+System/.test(code) || /namespace\s+\w+/.test(code)) return 'csharp';
              if (/public\s+class\s+\w+/.test(code) && /Console\./.test(code)) return 'csharp';
              
              // JavaScript detection
              if (/var\s+\w+\s*=\s*function/.test(code) || /function\s+\w+\s*\(/.test(code)) return 'javascript';
              if (/const\s+\w+\s*=\s*\(/.test(code) || /=>\s*{/.test(code)) return 'javascript';
              if (/let\s+\w+/.test(code) && /=>\s*/.test(code)) return 'javascript';
              
              // TypeScript detection
              if (/:\s*(number|string|boolean)\s*[,\)]/.test(code)) return 'typescript';
              if (/interface\s+\w+/.test(code) || /type\s+\w+\s*=/.test(code)) return 'typescript';
              
              // PHP detection
              if (/<\?php/.test(code) || /\$\w+/.test(code)) return 'php';
              
              // Swift detection
              if (/func\s+\w+\s*\(/.test(code) && (/class\s+Solution/.test(code) || /var\s+\w+:\s*/.test(code))) return 'swift';
              if (/import\s+Foundation/.test(code) || /\[\w+\]/.test(code)) return 'swift';
              
              // Kotlin detection
              if (/fun\s+\w+\s*\(/.test(code) && /class\s+Solution/.test(code)) return 'kotlin';
              if (/class\s+Solution\s*{/.test(code) && /fun\s+/.test(code)) return 'kotlin';
              
              // Dart detection
              if (/void\s+main\s*\(\s*\)/.test(code) || /class\s+\w+\s*{/.test(code) && /dart/.test(code)) return 'dart';
              if (/import\s+'dart:/.test(code)) return 'dart';
              
              // Go detection
              if (/func\s+\w+\s*\(/.test(code) && /\*\w+/.test(code)) return 'go';
              if (/package\s+main/.test(code) || /func\s+main\s*\(\s*\)/.test(code)) return 'go';
              if (/import\s+\(/.test(code) || /fmt\./.test(code)) return 'go';
              
              // Ruby detection
              if (/def\s+\w+/.test(code) && /end/.test(code)) return 'ruby';
              if (/class\s+\w+/.test(code) && /def\s+/.test(code) && /end/.test(code)) return 'ruby';
              
              // Scala detection
              if (/object\s+\w+/.test(code) || /def\s+\w+\s*\(/.test(code) && /scala/.test(code)) return 'scala';
              if (/import\s+scala\./.test(code)) return 'scala';
              
              // Rust detection
              if (/fn\s+\w+\s*\(/.test(code) && (/impl\s+/.test(code) || /struct\s+/.test(code))) return 'rust';
              if (/use\s+std::/.test(code) || /let\s+mut\s+/.test(code)) return 'rust';
              
              // Racket detection
              if (/\(define\s+/.test(code) || /\(lambda\s+/.test(code)) return 'racket';
              if (/#lang\s+racket/.test(code)) return 'racket';
              
              // Erlang detection
              if (/-module\s*\(/.test(code) || /-export\s*\(/.test(code)) return 'erlang';
              if (/\w+\s*\(\s*\)\s*->/.test(code) && /\./.test(code)) return 'erlang';
              
              // Elixir detection
              if (/defmodule\s+\w+/.test(code) || /def\s+\w+\s*do/.test(code)) return 'elixir';
              if (/IO\.puts/.test(code) || /Enum\./.test(code)) return 'elixir';
              
              // Python detection (including Python3)
              if (/class\s+Solution\s*:/.test(code) || /def\s+\w+\s*\(/.test(code)) return 'python';
              if (/import\s+\w+/.test(code) || /from\s+\w+\s+import/.test(code)) return 'python';
              
              // C detection
              if (/#include\s*<.*\.h>/.test(code) && !/std::/.test(code) && !/cout/.test(code)) return 'c';
              if (/int\s+main\s*\(\s*(void)?\s*\)/.test(code)) return 'c';
              
              // Default fallback
              if (/def\s+/.test(code)) return 'python';
              if (/func\s+/.test(code) && !/fun\s+/.test(code)) return 'go';
              if (/fun\s+/.test(code)) return 'kotlin';
              if (/public\s+class/.test(code)) return 'java';
              if (/function\s+/.test(code)) return 'javascript';
              
              return 'python';
            }

            // Monaco Editor extraction
            try {
              if (window.monaco && window.monaco.editor) {
                const models = window.monaco.editor.getModels();
                debug.push('monaco models:' + models.length);
                for (const m of models) {
                  const val = m.getValue();
                  if (val && val.trim().length > 10 && val.length > extractedCode.length) { 
                    extractedCode = val; 
                    method = 'Monaco Editor'; 
                  }
                }
              }
            } catch (e) { debug.push('monaco error:' + e.message); }

            // CodeMirror extraction
            if (!extractedCode && window.CodeMirror) {
              try {
                const cmEls = Array.from(document.querySelectorAll('.CodeMirror'));
                debug.push('codemirror elements:' + cmEls.length);
                cmEls.forEach((el, idx) => {
                  if (el.CodeMirror && el.CodeMirror.getValue) {
                    const val = el.CodeMirror.getValue();
                    if (val && val.trim().length > 10 && val.length > extractedCode.length) { 
                      extractedCode = val; 
                      method = 'CodeMirror #' + idx; 
                    }
                  }
                });
              } catch (e) { debug.push('cm error:' + e.message); }
            }

            // Textarea extraction
            if (!extractedCode) {
              const tArr = Array.from(document.querySelectorAll('textarea'));
              debug.push('textareas:' + tArr.length);
              tArr.forEach((ta, idx) => {
                const v = ta.value || '';
                if (v.trim().length > 10 && v.length > extractedCode.length && 
                    (v.includes('{') || v.includes('def ') || v.includes('func ') || v.includes('class '))) {
                  extractedCode = v; 
                  method = 'Textarea #' + idx;
                }
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
        extraction = result;
      } else if (browser.tabs.executeScript) {
        // Firefox MV2 way - read and execute the script content
        const [result] = await browser.tabs.executeScript(tabs[0].id, {
          file: 'extract-code.js'
        });
        extraction = result;
      }
    } catch (e) {
      console.error('Script execution failed:', e);
      showStatus('Failed to extract code. Please try again.', 'error');
      return;
    }

    if (!extraction || !extraction.ok) {
      let errorMsg = 'Failed to extract code. ';
      if (extraction && extraction.debug) {
        console.log('Extraction debug info:', extraction.debug);
        errorMsg += 'Debug: ' + extraction.debug.join(', ');
      }
      errorMsg += ' Please ensure the code editor is visible and contains your solution.';
      showStatus(errorMsg, 'error');
      return;
    }

    console.log('Extracted code:', {
      language: extraction.language,
      method: extraction.method,
      codeLength: extraction.code.length,
      codePreview: extraction.code.substring(0, 100) + '...'
    });

    await pushToGitHub(extraction.code, tabs[0].url, extraction.language);
    
  } catch (error) {
    showStatus(`Failed to push code: ${error.message}`, 'error');
  } finally {
    pushBtn.disabled = false;
    pushBtn.textContent = 'PUSH TO GITHUB';
  }
});

// Listen for messages from content script and background script
browser.runtime.onMessage.addListener(async (request, sender) => {
  
  if (request.type === "leetcode-code-v5") {
    await pushToGitHub(request.code, request.url, request.language);
  } else if (request.type === "leetcode-code") {
    await pushToGitHub(request.code, request.url, request.language);
  } else if (request.type === "error-v5") {
    showStatus(request.message, 'error');
    
    // Re-enable push button on error
    const pushBtn = document.getElementById('push-btn');
    if (pushBtn) {
      pushBtn.disabled = false;
      pushBtn.textContent = 'PUSH TO GITHUB';
    }
  } else if (request.type === "auth-complete") {
    
    // Update auth status
    if (authStatusEl) {
      authStatusEl.textContent = "✅ Authentication successful!";
      authStatusEl.className = "status success";
    }
    
    // Wait a moment for background script to save auth data, then reload from storage
    setTimeout(async () => {
      const auth = await githubAuth.loadAuth();
      if (auth.github_token && auth.github_username) {
        showLoggedInView(auth);
        showStatus('Successfully authenticated with GitHub!', 'success');
      } else {
        // Fallback if storage hasn't been updated yet
        showLoggedInView({
          github_token: request.token,
          github_username: request.userInfo.login,
          github_user_info: request.userInfo
        });
        showStatus('Successfully authenticated with GitHub!', 'success');
      }
    }, 1500);
  } else if (request.type === "error") {
    showStatus(request.message, 'error');
    
    // Re-enable push button on error
    const pushBtn = document.getElementById('push-btn');
    if (pushBtn) {
      pushBtn.disabled = false;
      pushBtn.textContent = 'PUSH TO GITHUB';
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
        "User-Agent": "dotpush-Extension"
      }
    });
    
    if (response.ok) {
      return true;
    }
    
    if (response.status === 404) {
      
      const createResponse = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "dotpush-Extension"
        },
        body: JSON.stringify({
          name: repoName,
          description: "LeetCode solutions automatically synced from dotpush extension - https://dotpush.ca/",
          private: false,
          auto_init: true
        })
      });
      
      if (createResponse.ok) {
        showStatus(`Created repository: ${username}/${repoName}`, 'success');
        return true;
      } else {
        const errorData = await createResponse.json();
        return false;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// Push code to GitHub
async function pushToGitHub(code, url, language = 'python') {
  try {
    
    const auth = await githubAuth.loadAuth();
    if (!auth.github_token || !auth.github_username) {
      showStatus('Please authenticate with GitHub first', 'error');
      return;
    }
    
    const slug = getProblemSlug(url);
    const fileExtension = getFileExtension(language);
    const fileName = `${slug}.${fileExtension}`;
    const path = `leetcode/${fileName}`;
    const repoName = "code-sync";
    const username = auth.github_username;
    
    // Store the direct file URL for the repo button
    currentFileUrl = `https://github.com/${username}/${repoName}/blob/main/${path}`;
    
    // Ensure repository exists (create if it doesn't)
    const repoExists = await ensureRepositoryExists(auth.github_token, username, repoName);
    if (!repoExists) {
      showStatus('Failed to create or access repository', 'error');
      return;
    }
    
    // Clean and validate the extracted code
    if (!code || code.trim().length < 5) {
      showStatus('No valid code found. Please ensure the code editor is visible and contains code.', 'error');
      return;
    }
    
    // Ensure we have the complete code (check for common truncation indicators)
    const codeLines = code.split('\n');
    const lastLine = codeLines[codeLines.length - 1];
    if (lastLine && lastLine.trim() && !lastLine.trim().match(/[;})\]]/)) {
      showStatus('⚠ Code may be incomplete. Please scroll to see the full solution before pushing.', 'warning');
    }
    
    // Use user's token for repository operations
    const apiUrl = `https://api.github.com/repos/${username}/${repoName}/contents/${path}`;
    
    // Proper UTF-8 encoding for GitHub API
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(code);
    const contentB64 = btoa(String.fromCharCode(...utf8Bytes));

    // Check if file already exists to get its SHA
    const checkResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${auth.github_token}`,
        "User-Agent": "dotpush-Extension"
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
      showStatus(`GitHub API error: ${errorData.message}`, 'error');
      return;
    }

    // Create commit message
    const commitMessage = exists ? 
      `Update solution for ${slug}` : 
      `Add solution for ${slug}`;
      
    const body = {
      message: commitMessage,
      content: contentB64,
      branch: 'main',
      ...(exists ? { sha } : {})
    };

    const putResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${auth.github_token}`,
        "Content-Type": "application/json",
        "User-Agent": "dotpush-Extension"
      },
      body: JSON.stringify(body)
    });

    const result = await putResponse.json();
    if (result.content) {
      showStatus('Successfully pushed to GitHub!', 'success');
      // Show the repo button after successful push
      if (repoBtn) {
        repoBtn.classList.remove('hidden');
      }
    } else {
      showStatus(`Failed to push: ${result.message || 'Unknown error'}`, 'error');
    }
  } catch (err) {
    showStatus('Network error occurred', 'error');
  }
}

// Helper to extract problem slug from URL
function getProblemSlug(url) {
  const match = url.match(/leetcode\.com\/problems\/([^\/]+)/);
  return match ? match[1] : 'solution';
}

// Map language to file extension (LeetCode supported languages only)
function getFileExtension(language) {
  const map = {
    // Core languages
    'cpp': 'cpp',
    'c++': 'cpp',
    'java': 'java',
    'python': 'py',
    'python3': 'py',
    'c': 'c',
    'csharp': 'cs',
    'c#': 'cs',
    'javascript': 'js',
    'typescript': 'ts',
    'php': 'php',
    'swift': 'swift',
    'kotlin': 'kt',
    'dart': 'dart',
    'go': 'go',
    'golang': 'go',
    'ruby': 'rb',
    'scala': 'scala',
    'rust': 'rs',
    'racket': 'rkt',
    'erlang': 'erl',
    'elixir': 'ex'
  };
  return map[language.toLowerCase()] || 'txt';
}

// Repo button click handler
if (repoBtn) {
  repoBtn.addEventListener('click', () => {
    if (currentFileUrl) {
      browser.tabs.create({ url: currentFileUrl });
    }
  });
}