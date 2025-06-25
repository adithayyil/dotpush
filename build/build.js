#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SHARED_DIR = path.join(ROOT_DIR, 'shared');
const CHROME_DIR = path.join(ROOT_DIR, 'chrome');
const FIREFOX_DIR = path.join(ROOT_DIR, 'firefox');

// Browser-specific configurations
const BROWSER_CONFIGS = {
  chrome: {
    manifestSrc: 'manifest.chrome.json',
    manifestDest: 'manifest.json',
    outputDir: CHROME_DIR,
    webAccessibleResources: true,
    needsPolyfill: false
  },
  firefox: {
    manifestSrc: 'manifest.firefox.json', 
    manifestDest: 'manifest.json',
    outputDir: FIREFOX_DIR,
    webAccessibleResources: false,
    needsPolyfill: true
  }
};

async function cleanDirectory(dir) {
  try {
    await fs.emptyDir(dir);
    console.log(`✓ Cleaned ${dir}`);
  } catch (error) {
    console.error(`Error cleaning ${dir}:`, error);
  }
}

async function copySharedFiles(config) {
  try {
    // Copy all files from shared directory
    await fs.copy(SHARED_DIR, config.outputDir, {
      filter: (src) => {
        const basename = path.basename(src);
        // Don't copy manifest templates
        return !basename.startsWith('manifest.');
      }
    });
    
    console.log(`✓ Copied shared files to ${config.outputDir}`);
  } catch (error) {
    console.error(`Error copying shared files:`, error);
    throw error;
  }
}

async function processManifest(config) {
  try {
    const manifestSrc = path.join(SHARED_DIR, config.manifestSrc);
    const manifestDest = path.join(config.outputDir, config.manifestDest);
    
    // Read and parse manifest
    const manifestContent = await fs.readFile(manifestSrc, 'utf8');
    let manifest = JSON.parse(manifestContent);
    
    // Add browser-specific configurations
    if (config.webAccessibleResources) {
      manifest.web_accessible_resources = [{
        resources: ["extract-code.js", "api-compat.js"],
        matches: ["*://leetcode.com/*"]
      }];
    }
    
    // Write processed manifest
    await fs.writeFile(manifestDest, JSON.stringify(manifest, null, 2));
    console.log(`✓ Processed manifest for ${path.basename(config.outputDir)}`);
  } catch (error) {
    console.error(`Error processing manifest:`, error);
    throw error;
  }
}

async function addWebExtensionPolyfill(config) {
  if (!config.needsPolyfill) return;
  
  try {
    // Copy webextension-polyfill from node_modules
    const polyfillSrc = path.join(ROOT_DIR, 'node_modules', 'webextension-polyfill', 'dist', 'browser-polyfill.min.js');
    const polyfillDest = path.join(config.outputDir, 'browser-polyfill.js');
    
    if (await fs.pathExists(polyfillSrc)) {
      await fs.copy(polyfillSrc, polyfillDest);
      console.log(`✓ Added webextension-polyfill to ${path.basename(config.outputDir)}`);
      
      // Update HTML files to include polyfill
      await injectPolyfillIntoHTML(config.outputDir);
    } else {
      console.warn('⚠ Webextension-polyfill not found. Run npm install first.');
    }
  } catch (error) {
    console.error('Error adding webextension-polyfill:', error);
  }
}

async function injectPolyfillIntoHTML(outputDir) {
  try {
    const htmlFiles = await fs.readdir(outputDir);
    
    for (const file of htmlFiles) {
      if (file.endsWith('.html')) {
        const htmlPath = path.join(outputDir, file);
        let htmlContent = await fs.readFile(htmlPath, 'utf8');
        
        // Inject polyfill script tag before any other scripts
        if (!htmlContent.includes('browser-polyfill.js')) {
          htmlContent = htmlContent.replace(
            /<head>/i,
            '<head>\\n  <script src="browser-polyfill.js"></script>'
          );
          
          await fs.writeFile(htmlPath, htmlContent);
          console.log(`✓ Injected polyfill into ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Error injecting polyfill into HTML:', error);
  }
}

async function validateBuild(config) {
  try {
    const manifestPath = path.join(config.outputDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    
    // Basic validation
    const required = ['name', 'version', 'manifest_version'];
    const missing = required.filter(field => !manifest[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required manifest fields: ${missing.join(', ')}`);
    }
    
    console.log(`✓ Validated ${path.basename(config.outputDir)} build`);
    return true;
  } catch (error) {
    console.error(`❌ Build validation failed for ${path.basename(config.outputDir)}:`, error);
    return false;
  }
}

async function buildForBrowser(browserName) {
  const config = BROWSER_CONFIGS[browserName];
  if (!config) {
    throw new Error(`Unknown browser: ${browserName}`);
  }
  
  console.log(`\\n📦 Building for ${browserName}...`);
  
  try {
    // Clean output directory
    await cleanDirectory(config.outputDir);
    
    // Copy shared files
    await copySharedFiles(config);
    
    // Process manifest
    await processManifest(config);
    
    // Add webextension-polyfill for Firefox
    if (config.needsPolyfill) {
      await addWebExtensionPolyfill(config);
      
      // Modify background.js to import the polyfill for Firefox
      const backgroundPath = path.join(config.outputDir, 'background.js');
      if (await fs.pathExists(backgroundPath)) {
        let backgroundContent = await fs.readFile(backgroundPath, 'utf8');
        
        // Add polyfill import at the top for Firefox
        const polyfillImport = `// Firefox polyfill import
if (typeof importScripts !== 'undefined') {
  try {
    importScripts('browser-polyfill.js');
  } catch (e) {
    console.error('Failed to import browser-polyfill:', e);
  }
}

`;
        if (!backgroundContent.includes('browser-polyfill.js')) {
          backgroundContent = polyfillImport + backgroundContent;
          await fs.writeFile(backgroundPath, backgroundContent);
          console.log('✓ Added polyfill import to background.js');
        }
      }
    }
    
    // Validate build
    const isValid = await validateBuild(config);
    
    if (isValid) {
      console.log(`✅ Successfully built for ${browserName}`);
    } else {
      throw new Error(`Build validation failed for ${browserName}`);
    }
    
  } catch (error) {
    console.error(`❌ Build failed for ${browserName}:`, error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const targetBrowser = args[0];
  
  try {
    // Check if shared directory exists
    if (!(await fs.pathExists(SHARED_DIR))) {
      throw new Error(`Shared directory not found: ${SHARED_DIR}`);
    }
    
    if (targetBrowser && BROWSER_CONFIGS[targetBrowser]) {
      // Build for specific browser
      await buildForBrowser(targetBrowser);
    } else if (!targetBrowser) {
      // Build for all browsers
      console.log('🚀 Building for all browsers...');
      for (const browser of Object.keys(BROWSER_CONFIGS)) {
        await buildForBrowser(browser);
      }
      console.log('\\n🎉 All builds completed successfully!');
    } else {
      console.error(`❌ Unknown browser: ${targetBrowser}`);
      console.log('Available browsers:', Object.keys(BROWSER_CONFIGS).join(', '));
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Build process failed:', error);
    process.exit(1);
  }
}

// API Incompatibility Detection
function detectAPIIncompatibilities() {
  console.log('\\n🔍 Checking for API incompatibilities...');
  
  const incompatibleAPIs = [
    'declarativeNetRequest',
    'scripting.executeScript',  // Different between MV2/MV3
    'action'  // vs browserAction
  ];
  
  // This would be expanded to actually scan files
  console.log('⚠ Potential incompatibilities detected:');
  console.log('- scripting.executeScript (MV3) vs tabs.executeScript (MV2)');
  console.log('- action (MV3) vs browserAction (MV2)');
  console.log('- Different permission models');
  console.log('\\n💡 These are handled by the compatibility layer in api-compat.js');
}

if (require.main === module) {
  main().then(() => {
    detectAPIIncompatibilities();
  });
}

module.exports = { buildForBrowser, BROWSER_CONFIGS };
