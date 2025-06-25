#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_DIR = path.join(ROOT_DIR, 'chrome');
const FIREFOX_DIR = path.join(ROOT_DIR, 'firefox');

async function validateBrowser(browserName, dir) {
  console.log(`\n🔍 Validating ${browserName} build...`);
  
  try {
    // Check if directory exists
    if (!(await fs.pathExists(dir))) {
      throw new Error(`Build directory not found: ${dir}`);
    }
    
    // Check manifest
    const manifestPath = path.join(dir, 'manifest.json');
    if (!(await fs.pathExists(manifestPath))) {
      throw new Error('manifest.json not found');
    }
    
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    
    // Validate manifest version
    if (browserName === 'Chrome' && manifest.manifest_version !== 3) {
      throw new Error(`Expected manifest_version 3 for Chrome, got ${manifest.manifest_version}`);
    }
    if (browserName === 'Firefox' && manifest.manifest_version !== 2) {
      throw new Error(`Expected manifest_version 2 for Firefox, got ${manifest.manifest_version}`);
    }
    
    // Check required files
    const requiredFiles = [
      'background.js',
      'popup.js', 
      'popup.html',
      'auth.js',
      'content.js',
      'api-compat.js',
      'extract-code.js'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(dir, file);
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    
    // Firefox-specific checks
    if (browserName === 'Firefox') {
      const polyfillPath = path.join(dir, 'browser-polyfill.js');
      if (!(await fs.pathExists(polyfillPath))) {
        throw new Error('WebExtension polyfill missing for Firefox');
      }
      
      // Check if polyfill is injected in HTML
      const htmlContent = await fs.readFile(path.join(dir, 'popup.html'), 'utf8');
      if (!htmlContent.includes('browser-polyfill.js')) {
        throw new Error('WebExtension polyfill not injected in popup.html');
      }
    }
    
    // Chrome-specific checks
    if (browserName === 'Chrome') {
      if (manifest.background && !manifest.background.service_worker) {
        throw new Error('Chrome manifest missing service_worker');
      }
      if (!manifest.action) {
        throw new Error('Chrome manifest missing action');
      }
    }
    
    console.log(`✅ ${browserName} build validation passed`);
    return true;
    
  } catch (error) {
    console.error(`❌ ${browserName} build validation failed:`, error.message);
    return false;
  }
}

async function checkAPICompatibility() {
  console.log('\n🔧 Checking API compatibility...');
  
  try {
    const compatPath = path.join(ROOT_DIR, 'shared', 'api-compat.js');
    const compatContent = await fs.readFile(compatPath, 'utf8');
    
    // Check for key compatibility features
    const requiredFeatures = [
      'ExtensionAPI',
      'browser.action || browser.browserAction',
      'browser.scripting.executeScript',
      'browser.tabs.executeScript'
    ];
    
    const missingFeatures = requiredFeatures.filter(feature => 
      !compatContent.includes(feature.split('||')[0].trim())
    );
    
    if (missingFeatures.length > 0) {
      console.warn('⚠ Missing compatibility features:', missingFeatures);
    } else {
      console.log('✅ API compatibility layer complete');
    }
    
  } catch (error) {
    console.error('❌ API compatibility check failed:', error);
  }
}

async function generateReport() {
  console.log('\n📊 Cross-Browser Extension Report');
  console.log('===================================');
  
  try {
    // Get file sizes
    const chromeSize = await getDirectorySize(CHROME_DIR);
    const firefoxSize = await getDirectorySize(FIREFOX_DIR);
    
    console.log(`Chrome build size: ${formatBytes(chromeSize)}`);
    console.log(`Firefox build size: ${formatBytes(firefoxSize)}`);
    
    // Count files
    const chromeFiles = await countFiles(CHROME_DIR);
    const firefoxFiles = await countFiles(FIREFOX_DIR);
    
    console.log(`Chrome files: ${chromeFiles}`);
    console.log(`Firefox files: ${firefoxFiles}`);
    
    // Check manifests
    const chromeManifest = JSON.parse(await fs.readFile(path.join(CHROME_DIR, 'manifest.json'), 'utf8'));
    const firefoxManifest = JSON.parse(await fs.readFile(path.join(FIREFOX_DIR, 'manifest.json'), 'utf8'));
    
    console.log(`\nManifest Versions:`);
    console.log(`- Chrome: MV${chromeManifest.manifest_version}`);
    console.log(`- Firefox: MV${firefoxManifest.manifest_version}`);
    
    console.log(`\nPermissions:`);
    console.log(`- Chrome: ${chromeManifest.permissions?.length || 0} permissions, ${chromeManifest.host_permissions?.length || 0} host permissions`);
    console.log(`- Firefox: ${firefoxManifest.permissions?.length || 0} permissions`);
    
  } catch (error) {
    console.error('Error generating report:', error);
  }
}

async function getDirectorySize(dir) {
  let size = 0;
  const files = await fs.readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      size += await getDirectorySize(filePath);
    } else {
      const stats = await fs.stat(filePath);
      size += stats.size;
    }
  }
  
  return size;
}

async function countFiles(dir) {
  let count = 0;
  const files = await fs.readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    if (file.isDirectory()) {
      count += await countFiles(path.join(dir, file.name));
    } else {
      count++;
    }
  }
  
  return count;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
  console.log('🚀 Cross-Browser Extension Validator');
  console.log('=====================================');
  
  const chromeValid = await validateBrowser('Chrome', CHROME_DIR);
  const firefoxValid = await validateBrowser('Firefox', FIREFOX_DIR);
  
  await checkAPICompatibility();
  await generateReport();
  
  console.log('\n📋 Summary');
  console.log('==========');
  console.log(`Chrome build: ${chromeValid ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`Firefox build: ${firefoxValid ? '✅ Valid' : '❌ Invalid'}`);
  
  if (chromeValid && firefoxValid) {
    console.log('\n🎉 All builds are valid and ready for distribution!');
    console.log('\nNext steps:');
    console.log('- Chrome: Upload dist/dotpush-chrome.zip to Chrome Web Store');
    console.log('- Firefox: Upload dist/dotpush-firefox.zip to Firefox Add-ons');
  } else {
    console.log('\n❌ Some builds failed validation. Please fix the issues above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
