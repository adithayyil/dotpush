# dotpush – Chrome Extension

This README gives a quick orientation to every file shipped in the production **`leetcode-sync/`** folder (the folder you will zip and upload to the Chrome Web Store).

## Directory structure

```
leetcode-sync/
├── icons/
│   ├── icon-128.png          # Toolbar icon shown when user is on LeetCode
│   └── inactive-128.png      # Greyed-out toolbar icon for all other sites
├── auth.js                   # Handles GitHub Device-Flow OAuth (no secret needed)
├── background.js             # Service-worker: icon switching + OAuth polling
├── content.js                # Lightweight detector injected into LeetCode pages
├── manifest.json             # Chrome-extension manifest (MV3)
├── popup.html                # Extension popup UI (HTML + inline CSS)
└── popup.js                  # Logic for popup: auth, code extraction, push-to-GitHub
```

### File details

| File | Purpose |
|------|---------|
| **manifest.json** | Declares MV3 permissions (`activeTab`, `scripting`, `tabs`, `storage`) & host-permissions for LeetCode/GitHub; wires `background.js`, `popup.html`, and default icons. |
| **popup.html** | Compact 240×300 UI with views for login, device-code, main push screen, non-LeetCode warning, and status banners. All styling is inline for ease of packaging. |
| **popup.js** | 1. Checks current tab; 2. Manages OAuth via `auth.js`; 3. Extracts code from Monaco/CodeMirror/TextArea/DOM; 4. Calls GitHub API to create/ update `leetcode/<slug>.<ext>` inside **`code-sync`** repo. |
| **auth.js** | Pure Device-Flow OAuth (only `client_id` hard-coded). Saves token/userinfo in `chrome.storage.sync`. Provides validation helper. |
| **background.js** | Runs persistently. Polls for OAuth token after the device-code step, creates `code-sync` repo if missing, and swaps toolbar icon based on current tab URL. |
| **content.js** | Currently just a placeholder: could be extended for future site integrations (e.g., NeetCode). |
| **icons/** | Two 128×128 PNGs; Chrome auto-downs­cales to smaller sizes, so only one active + one inactive asset is needed. |

## Build / publish

1. Make sure no Markdown or dev files are inside `leetcode-sync/` (this README lives outside and is **not** included in the ZIP).
2. Zip the **contents** of `leetcode-sync/` (not the folder itself).
3. Upload to the Chrome Web Store dashboard.

---

Feel free to delete or move this README before packaging; it's intended for developers, not end-users. 