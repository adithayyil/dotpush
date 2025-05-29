# Icon Generation Guide

## dotpush now has dynamic icons! 🎯

Your extension will show:
- **🟢 Green Git icon**: When on LeetCode pages (ready to sync!)
- **⚫ Gray Git icon**: When on other pages (navigate to LeetCode)

## Generate Both Icon Sets

### Step 1: Generate Active Icons (Green)

1. Open `icons/dotpush-active.svg` in any SVG to PNG converter:
   - https://svgtopng.com/
   - https://convertio.co/svg-png/
   - https://cloudconvert.com/svg-to-png

2. Convert to these sizes:
   - **16x16** → Save as `icons/dotpush-active-16.png`
   - **32x32** → Save as `icons/dotpush-active-32.png`
   - **48x48** → Save as `icons/dotpush-active-48.png`
   - **128x128** → Save as `icons/dotpush-active-128.png`

### Step 2: Generate Inactive Icons (Gray)

1. Open `icons/dotpush-inactive.svg` in the same converter

2. Convert to these sizes:
   - **16x16** → Save as `icons/dotpush-inactive-16.png`
   - **32x32** → Save as `icons/dotpush-inactive-32.png`
   - **48x48** → Save as `icons/dotpush-inactive-48.png`
   - **128x128** → Save as `icons/dotpush-inactive-128.png`

## Command Line Method (if you have ImageMagick)

```bash
# Install ImageMagick first
brew install imagemagick  # on macOS

# Generate active icons (green)
magick icons/dotpush-active.svg -resize 16x16 icons/dotpush-active-16.png
magick icons/dotpush-active.svg -resize 32x32 icons/dotpush-active-32.png
magick icons/dotpush-active.svg -resize 48x48 icons/dotpush-active-48.png
magick icons/dotpush-active.svg -resize 128x128 icons/dotpush-active-128.png

# Generate inactive icons (gray)
magick icons/dotpush-inactive.svg -resize 16x16 icons/dotpush-inactive-16.png
magick icons/dotpush-inactive.svg -resize 32x32 icons/dotpush-inactive-32.png
magick icons/dotpush-inactive.svg -resize 48x48 icons/dotpush-inactive-48.png
magick icons/dotpush-inactive.svg -resize 128x128 icons/dotpush-inactive-128.png
```

## How It Works:

- Extension automatically detects when you're on `leetcode.com`
- **Green Git icon** = Ready to push solutions! 🚀
- **Gray Git icon** = Navigate to LeetCode first
- Tooltip changes to match the current state

Perfect UX - users know exactly when dotpush is ready to work! ✨ 