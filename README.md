# dotpush – Sync Your LeetCode to GitHub

**dotpush** is a Chrome extension that automatically pushes the code you write on LeetCode straight to a dedicated GitHub repository – keeping your portfolio up-to-date without any manual copy-paste.

---

## What does it do?

1. **Detects when you are on a LeetCode problem page.**  
   The toolbar icon lights up to show the extension is ready.
2. **Grabs your solution code** from the LeetCode editor (supports Monaco, CodeMirror, plain `<textarea>` and fallback DOM capture).
3. **Creates / updates** a file named `leetcode/<slug>.<ext>` in your personal **`code-sync`** repository on GitHub.
4. **Commits with a friendly message** (e.g. `Add solution for two-sum`).  
   Subsequent pushes update the file instead of creating duplicates.
5. **Works with minimal GitHub permissions** via Device-Flow OAuth – you never paste a personal access token.

---

## Quick install (for users)

1. Install from the Chrome Web Store (or load `leetcode-sync/` as an unpacked extension in `chrome://extensions`).
2. Click the toolbar icon while on any LeetCode problem.
3. Go through the one-time GitHub Device-Flow – copy the 8-character code and paste it on GitHub's page.
4. Hit **PUSH TO GITHUB** – your solution appears in `https://github.com/&lt;you&gt;/code-sync` within seconds.

---

## Repository layout (this repo)

<details>
<summary>production bundle <code>leetcode-sync/</code></summary>

```
leetcode-sync/
├── icons/
│   ├── icon-128.png          # Active toolbar icon (green)
│   └── inactive-128.png      # Inactive toolbar icon (grey)
├── auth.js                   # Device-Flow OAuth helper
├── background.js             # MV3 service-worker (icon switching + OAuth polling)
├── content.js                # Page detector placeholder (future site support)
├── manifest.json             # Extension manifest (MV3)
├── popup.html                # UI markup & inline CSS
└── popup.js                  # Popup logic – auth, extraction, push
```
</details>

### Key files explained

| File | Purpose |
|------|---------|
| **manifest.json** | Declares permissions, host-permissions, service-worker, popup and icons. |
| **popup.js** | Main controller: checks current tab, handles auth UI, scrapes code, calls GitHub API. |
| **auth.js** | Stand-alone class implementing GitHub Device-Flow. Stores token in `chrome.storage.sync`. |
| **background.js** | Runs even when popup is closed – continues OAuth polling, switches toolbar icon per tab. |
| **icons/** | Only two 128×128 PNGs required, Chrome downsizes them automatically. |

---

## Developer setup

```bash
# Clone repo
$ git clone https://github.com/yourname/dotpush.git
$ cd dotpush/leetcode-sync

# Open Chrome → chrome://extensions → Enable Developer mode
# "Load unpacked" → select the leetcode-sync folder
```

For iterative development use the Chrome Extension "Reload" button after edits.

---

## Security & Privacy

* **No browsing history stored** – the `tabs` permission is used solely to read the URL of the active tab so we know when you're on LeetCode (Chrome's install prompt calls this "read your browsing history").
* **Minimum OAuth scope** – only `public_repo` is requested. Private repos are untouched.
* **Token stored by Chrome** – saved via `chrome.storage.sync`, encrypted by the browser and sync'd with your profile (switch to `storage.local` if you prefer local-only).

---

## Coming next

* **NeetCode support** (planned)  
* Auto-push on submission

---

## Packaging for release

1. Ensure *only* the files listed above exist inside `leetcode-sync/` (no Markdown or dev assets).  
2. Delete any residual `.DS_Store` or the unused `icons/A/` folder if present.  
3. Zip the **contents** of `leetcode-sync/`, not the folder itself.
4. Upload zip to the Chrome Web Store dashboard → publish.

---

## License

MIT © 2024 dotpush contributors 