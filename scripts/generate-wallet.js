#!/usr/bin/env node

import { ethers } from 'ethers';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    name: null,
    purpose: 'polymarket-trading',
    password: null,
    skipEnv: false,
    skipFile: false,
    showOnly: false,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch(arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--name':
      case '-n':
        options.name = args[++i];
        break;
      case '--purpose':
      case '-p':
        options.purpose = args[++i];
        break;
      case '--password':
      case '--pass':
        options.password = args[++i];
        break;
      case '--skip-env':
        options.skipEnv = true;
        break;
      case '--skip-file':
        options.skipFile = true;
        break;
      case '--show-only':
        options.showOnly = true;
        options.skipEnv = true;
        options.skipFile = true;
        break;
    }
  }
  
  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
${colors.bright}${colors.blue}🔑 Ethereum Wallet Generator for Polymarket Trading${colors.reset}
${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}

${colors.bright}Usage:${colors.reset}
  npm run generate-wallet [options]

${colors.bright}Options:${colors.reset}
  ${colors.cyan}-h, --help${colors.reset}         Show this help message
  ${colors.cyan}-n, --name${colors.reset}         Wallet name (default: auto-generated)
  ${colors.cyan}-p, --purpose${colors.reset}      Wallet purpose (default: polymarket-trading)
  ${colors.cyan}--password${colors.reset}         Encrypt wallet file with password
  ${colors.cyan}--skip-env${colors.reset}         Don't update .env file
  ${colors.cyan}--skip-file${colors.reset}        Don't save wallet to file
  ${colors.cyan}--show-only${colors.reset}        Only display wallet, don't save anywhere

${colors.bright}Examples:${colors.reset}
  ${colors.green}# Quick generate (saves to file and updates .env)${colors.reset}
  npm run generate-wallet

  ${colors.green}# Generate with custom name${colors.reset}
  npm run generate-wallet --name "pamela-backup"

  ${colors.green}# Generate replacement for banned wallet${colors.reset}
  npm run generate-wallet --name "pamela-new" --purpose "replacement-for-banned"

  ${colors.green}# Generate encrypted wallet${colors.reset}
  npm run generate-wallet --password "mySecurePassword"

  ${colors.green}# Generate and display only (no saving)${colors.reset}
  npm run generate-wallet --show-only

${colors.bright}Default Behavior:${colors.reset}
  • Automatically saves to ${colors.cyan}wallets/${colors.reset} directory
  • Updates ${colors.cyan}.env${colors.reset} with new private key
  • Backs up previous keys as comments
  • Assigns sequential wallet numbers
  • Creates wallet with 'active' status
`);
}

/**
 * Get existing wallets from the wallets directory
 */
function getExistingWallets() {
  const walletsDir = path.join(__dirname, '..', 'wallets');
  
  if (!fs.existsSync(walletsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(walletsDir);
  const walletFiles = files.filter(file => file.endsWith('.json'));
  
  const wallets = walletFiles.map(file => {
    try {
      const filepath = path.join(walletsDir, file);
      const content = fs.readFileSync(filepath, 'utf8');
      const data = JSON.parse(content);
      return {
        filename: file,
        address: data.address,
        createdAt: data.createdAt,
        purpose: data.purpose || 'polymarket-trading',
        name: data.name || 'unnamed',
        status: data.status || 'active',
        network: data.network || 'polygon',
        walletNumber: data.walletNumber || 0
      };
    } catch (error) {
      return null;
    }
  }).filter(wallet => wallet !== null);
  
  return wallets;
}

/**
 * Generate a new Ethereum wallet with strong entropy
 */
function generateWallet() {
  // Generate additional entropy for extra security
  const extraEntropy = crypto.randomBytes(32);
  
  // Create a new random wallet
  const wallet = ethers.Wallet.createRandom({
    extraEntropy: extraEntropy
  });
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic.phrase
  };
}

/**
 * Save wallet details to a file (encrypted)
 */
function saveWalletToFile(wallet, name, purpose, walletNumber, password = null) {
  const walletData = {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic,
    createdAt: new Date().toISOString(),
    network: 'polygon',
    purpose: purpose,
    name: name,
    walletNumber: walletNumber,
    status: 'active'
  };
  
  let dataToSave;
  
  if (password) {
    // Encrypt the private key and mnemonic with password
    const cipher = crypto.createCipher('aes-256-cbc', password);
    let encrypted = cipher.update(JSON.stringify({
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic
    }), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    dataToSave = {
      address: wallet.address,
      encrypted: encrypted,
      createdAt: walletData.createdAt,
      network: walletData.network,
      purpose: walletData.purpose,
      name: walletData.name,
      walletNumber: walletData.walletNumber,
      status: walletData.status
    };
  } else {
    dataToSave = walletData;
  }
  
  // Generate filename with wallet number and name
  const timestamp = Date.now();
  const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const filename = `wallet-${walletNumber.toString().padStart(3, '0')}-${safeName}-${timestamp}.json`;
  const filepath = path.join(__dirname, '..', 'wallets', filename);
  
  // Create wallets directory if it doesn't exist
  const walletsDir = path.join(__dirname, '..', 'wallets');
  if (!fs.existsSync(walletsDir)) {
    fs.mkdirSync(walletsDir, { recursive: true });
  }
  
  // Write wallet data to file
  fs.writeFileSync(filepath, JSON.stringify(dataToSave, null, 2));
  
  // Set restrictive permissions (read/write for owner only)
  fs.chmodSync(filepath, 0o600);
  
  return filepath;
}

/**
 * Update .env file with new wallet
 */
function updateEnvFile(privateKey, walletAddress, walletName) {
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  // Check if .env exists, if not create from example
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
    } else {
      fs.writeFileSync(envPath, '');
    }
  }
  
  // Read current .env content
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check if POLYMARKET_PRIVATE_KEY exists
  const hasPolymarketKey = /^POLYMARKET_PRIVATE_KEY=/m.test(envContent);
  const hasEvmKey = /^EVM_PRIVATE_KEY=/m.test(envContent);
  
  // Backup old keys if they exist
  if (hasPolymarketKey || hasEvmKey) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Backup existing keys as comments
    envContent = envContent.replace(
      /^(POLYMARKET_PRIVATE_KEY=.*)$/m,
      `# Previous key (backed up ${timestamp})\n# $1\nPOLYMARKET_PRIVATE_KEY=${privateKey}`
    );
    
    if (!hasPolymarketKey) {
      envContent += `\n# Generated by generate-wallet.js on ${timestamp}\n# Wallet: ${walletName} (${walletAddress})\nPOLYMARKET_PRIVATE_KEY=${privateKey}\n`;
    }
    
    if (hasEvmKey) {
      envContent = envContent.replace(
        /^(EVM_PRIVATE_KEY=.*)$/m,
        `# $1\nEVM_PRIVATE_KEY=${privateKey}`
      );
    } else {
      envContent += `EVM_PRIVATE_KEY=${privateKey}\n`;
    }
  } else {
    const timestamp = new Date().toISOString();
    envContent += `\n# Generated by generate-wallet.js on ${timestamp}\n# Wallet: ${walletName} (${walletAddress})\nPOLYMARKET_PRIVATE_KEY=${privateKey}\nEVM_PRIVATE_KEY=${privateKey}\n`;
  }
  
  // Write updated content back
  fs.writeFileSync(envPath, envContent);
  
  return envPath;
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();
  
  // Show help if requested
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  console.log(`${colors.bright}${colors.blue}🔑 Ethereum Wallet Generator for Polymarket Trading${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  // Get existing wallets
  const existingWallets = getExistingWallets();
  const walletNumber = existingWallets.length + 1;
  
  // Display existing wallet summary
  if (existingWallets.length > 0) {
    const activeWallets = existingWallets.filter(w => w.status === 'active');
    const bannedWallets = existingWallets.filter(w => w.status === 'banned');
    
    console.log(`${colors.bright}Existing Wallets:${colors.reset}`);
    console.log(`  ${colors.green}Active: ${activeWallets.length}${colors.reset}`);
    console.log(`  ${colors.red}Banned: ${bannedWallets.length}${colors.reset}`);
    console.log(`  ${colors.cyan}Total: ${existingWallets.length}${colors.reset}\n`);
    
    if (bannedWallets.length > 0) {
      console.log(`${colors.yellow}⚠️  Note: You have ${bannedWallets.length} banned wallet(s)${colors.reset}\n`);
    }
  }
  
  // Generate wallet
  console.log(`${colors.yellow}Generating wallet #${walletNumber}...${colors.reset}`);
  const wallet = generateWallet();
  
  // Determine wallet name
  const walletName = options.name || `wallet-${walletNumber}`;
  
  console.log(`\n${colors.green}✅ Wallet Generated Successfully!${colors.reset}\n`);
  
  // Display wallet details
  console.log(`${colors.bright}Wallet Details:${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}Wallet #:${colors.reset}    ${walletNumber}`);
  console.log(`${colors.bright}Name:${colors.reset}        ${walletName}`);
  console.log(`${colors.bright}Address:${colors.reset}     ${wallet.address}`);
  console.log(`${colors.bright}Private Key:${colors.reset} ${wallet.privateKey}`);
  console.log(`${colors.bright}Mnemonic:${colors.reset}    ${wallet.mnemonic}`);
  console.log(`${colors.bright}Purpose:${colors.reset}     ${options.purpose}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  // Save to file unless skipped
  if (!options.skipFile) {
    const filepath = saveWalletToFile(wallet, walletName, options.purpose, walletNumber, options.password);
    console.log(`${colors.green}✅ Saved to file:${colors.reset} ${filepath}`);
    
    if (options.password) {
      console.log(`${colors.yellow}   🔒 File encrypted with password${colors.reset}`);
    }
  }
  
  // Update .env unless skipped
  if (!options.skipEnv) {
    const envPath = updateEnvFile(wallet.privateKey, wallet.address, walletName);
    console.log(`${colors.green}✅ Updated .env:${colors.reset} ${envPath}`);
    console.log(`${colors.cyan}   • POLYMARKET_PRIVATE_KEY updated${colors.reset}`);
    console.log(`${colors.cyan}   • EVM_PRIVATE_KEY updated${colors.reset}`);
    console.log(`${colors.cyan}   • Previous keys backed up as comments${colors.reset}`);
  }
  
  // Display next steps
  console.log(`\n${colors.bright}${colors.blue}📋 Next Steps:${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`1. ${colors.bright}Fund your wallet on Polygon:${colors.reset}`);
  console.log(`   • Send MATIC to: ${colors.cyan}${wallet.address}${colors.reset}`);
  console.log(`   • Send USDC.e to: ${colors.cyan}${wallet.address}${colors.reset}`);
  console.log(`\n2. ${colors.bright}Verify funding:${colors.reset}`);
  console.log(`   ${colors.blue}https://polygonscan.com/address/${wallet.address}${colors.reset}`);
  console.log(`\n3. ${colors.bright}Start trading:${colors.reset}`);
  console.log(`   ${colors.green}npm start${colors.reset}`);
  
  if (existingWallets.filter(w => w.status === 'banned').length > 0) {
    console.log(`\n${colors.yellow}💡 Tip: Use 'npm run wallets' to manage wallet statuses${colors.reset}`);
  }
  
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  // Show security warning if not encrypted
  if (!options.skipFile && !options.password) {
    console.log(`${colors.red}⚠️  Security Note: Wallet saved unencrypted. Consider using --password for encryption.${colors.reset}\n`);
  }
}

// Run the script
main().catch((error) => {
  console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
  process.exit(1);
});