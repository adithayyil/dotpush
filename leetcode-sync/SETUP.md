# DotPush Bot Setup Guide

## 🤖 Creating the Bot Account

1. **Create a new GitHub account** for your bot (e.g., `dotpush-bot`)
2. **Generate a Personal Access Token:**
   - Go to Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Set expiration (recommend "No expiration" for production)
   - Select scopes:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `user:email` (Access to user email addresses)
   - Click "Generate token"
   - **Copy the token** (starts with `ghp_`) - you won't see it again!

## ⚙️ Configuration

1. **Copy the config template:**
   ```bash
   cp config.example.js config.js
   ```

2. **Edit `config.js` with your bot credentials:**
   ```javascript
   const DOTPUSH_CONFIG = {
     GITHUB_TOKEN: "ghp_your_actual_bot_token_here",
     GITHUB_USERNAME: "your_bot_username_here", 
     GITHUB_REPO: "dotpush"
   };
   ```

3. **Update the UI text** in `popup.html` to show your bot username:
   - Find "pravinl23" in the setup instructions
   - Replace with your bot username

## 🔐 Security Notes

- The `config.js` file is already in `.gitignore` 
- Never commit your actual bot token to the repository
- The bot only gets access to repos where users explicitly add it as collaborator
- Users only grant `user:email` permission (no repo access)

## 🚀 How It Works

1. User authenticates with minimal `user:email` scope
2. User creates `leetcode-sync` repository
3. User adds your bot as collaborator  
4. Bot commits using its token with `Co-authored-by: User <email>`
5. User gets full commit credit! 