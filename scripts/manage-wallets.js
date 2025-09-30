#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

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
        filepath: filepath,
        address: data.address,
        createdAt: data.createdAt,
        purpose: data.purpose || 'polymarket-trading',
        name: data.name || 'unnamed',
        status: data.status || 'active',
        network: data.network || 'polygon',
        walletNumber: data.walletNumber || 0,
        encrypted: !!data.encrypted
      };
    } catch (error) {
      return null;
    }
  }).filter(wallet => wallet !== null);
  
  return wallets.sort((a, b) => a.walletNumber - b.walletNumber);
}

/**
 * Display wallet details
 */
function displayWalletDetails(wallets) {
  console.log(`\n${colors.bright}${colors.blue}📂 Wallet Manager${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  if (wallets.length === 0) {
    console.log(`${colors.yellow}No wallets found. Run 'npm run generate-wallet' to create one.${colors.reset}`);
    return;
  }
  
  wallets.forEach((wallet, index) => {
    const statusColor = wallet.status === 'banned' ? colors.red : 
                       wallet.status === 'inactive' ? colors.yellow : 
                       colors.green;
    const encryptedIcon = wallet.encrypted ? '🔒' : '🔓';
    
    console.log(`${colors.bright}${index + 1}. [#${wallet.walletNumber || '?'}] ${colors.cyan}${wallet.name}${colors.reset} ${encryptedIcon}`);
    console.log(`   Address: ${wallet.address}`);
    console.log(`   Status: ${statusColor}${wallet.status}${colors.reset}`);
    console.log(`   Purpose: ${wallet.purpose}`);
    console.log(`   Created: ${new Date(wallet.createdAt).toLocaleString()}`);
    console.log(`   File: ${wallet.filename}`);
    console.log('');
  });
  
  // Summary
  const active = wallets.filter(w => w.status === 'active').length;
  const banned = wallets.filter(w => w.status === 'banned').length;
  const inactive = wallets.filter(w => w.status === 'inactive').length;
  
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}Summary:${colors.reset}`);
  console.log(`  ${colors.green}Active: ${active}${colors.reset}`);
  console.log(`  ${colors.yellow}Inactive: ${inactive}${colors.reset}`);
  console.log(`  ${colors.red}Banned: ${banned}${colors.reset}`);
  console.log(`  ${colors.cyan}Total: ${wallets.length}${colors.reset}\n`);
}

/**
 * Update wallet status
 */
async function updateWalletStatus(wallet, newStatus) {
  try {
    const content = fs.readFileSync(wallet.filepath, 'utf8');
    const data = JSON.parse(content);
    data.status = newStatus;
    data.lastModified = new Date().toISOString();
    
    if (newStatus === 'banned') {
      data.bannedAt = new Date().toISOString();
    }
    
    fs.writeFileSync(wallet.filepath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`${colors.red}Error updating wallet: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Export wallet addresses
 */
function exportAddresses(wallets, status = null) {
  const filtered = status ? wallets.filter(w => w.status === status) : wallets;
  const addresses = filtered.map(w => ({
    name: w.name,
    address: w.address,
    status: w.status
  }));
  
  const filename = `wallet-addresses-${status || 'all'}-${Date.now()}.json`;
  const filepath = path.join(__dirname, '..', filename);
  
  fs.writeFileSync(filepath, JSON.stringify(addresses, null, 2));
  return filepath;
}

/**
 * Main menu
 */
async function mainMenu() {
  const wallets = getExistingWallets();
  displayWalletDetails(wallets);
  
  if (wallets.length === 0) {
    rl.close();
    return;
  }
  
  console.log(`${colors.bright}${colors.blue}Actions:${colors.reset}`);
  console.log(`  ${colors.cyan}1.${colors.reset} Mark wallet as BANNED`);
  console.log(`  ${colors.cyan}2.${colors.reset} Mark wallet as INACTIVE`);
  console.log(`  ${colors.cyan}3.${colors.reset} Mark wallet as ACTIVE`);
  console.log(`  ${colors.cyan}4.${colors.reset} Export addresses to file`);
  console.log(`  ${colors.cyan}5.${colors.reset} View wallet private key (requires file read)`);
  console.log(`  ${colors.cyan}6.${colors.reset} Delete wallet file`);
  console.log(`  ${colors.cyan}0.${colors.reset} Exit\n`);
  
  const choice = await question(`${colors.yellow}Select action (0-6): ${colors.reset}`);
  
  switch(choice) {
    case '1': // Mark as banned
    case '2': // Mark as inactive
    case '3': // Mark as active
      const newStatus = choice === '1' ? 'banned' : choice === '2' ? 'inactive' : 'active';
      const walletNum = await question(`${colors.yellow}Enter wallet number to mark as ${newStatus.toUpperCase()}: ${colors.reset}`);
      const index = parseInt(walletNum) - 1;
      
      if (index >= 0 && index < wallets.length) {
        const wallet = wallets[index];
        const confirm = await question(`${colors.red}Mark "${wallet.name}" as ${newStatus.toUpperCase()}? (yes/no): ${colors.reset}`);
        
        if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
          if (await updateWalletStatus(wallet, newStatus)) {
            console.log(`${colors.green}✅ Wallet status updated to ${newStatus.toUpperCase()}${colors.reset}`);
            
            if (newStatus === 'banned') {
              console.log(`${colors.yellow}💡 Tip: Run 'npm run generate-wallet' to create a replacement wallet${colors.reset}`);
            }
          }
        }
      } else {
        console.log(`${colors.red}Invalid wallet number${colors.reset}`);
      }
      break;
      
    case '4': // Export addresses
      const exportType = await question(`${colors.yellow}Export which wallets? (all/active/banned/inactive): ${colors.reset}`);
      const validTypes = ['all', 'active', 'banned', 'inactive'];
      
      if (validTypes.includes(exportType)) {
        const filepath = exportAddresses(wallets, exportType === 'all' ? null : exportType);
        console.log(`${colors.green}✅ Addresses exported to: ${filepath}${colors.reset}`);
      } else {
        console.log(`${colors.red}Invalid export type${colors.reset}`);
      }
      break;
      
    case '5': // View private key
      const viewNum = await question(`${colors.yellow}Enter wallet number to view: ${colors.reset}`);
      const viewIndex = parseInt(viewNum) - 1;
      
      if (viewIndex >= 0 && viewIndex < wallets.length) {
        const wallet = wallets[viewIndex];
        
        console.log(`${colors.red}⚠️  WARNING: This will display the private key!${colors.reset}`);
        const confirmView = await question(`${colors.red}Are you sure? (yes/no): ${colors.reset}`);
        
        if (confirmView.toLowerCase() === 'yes' || confirmView.toLowerCase() === 'y') {
          try {
            const content = fs.readFileSync(wallet.filepath, 'utf8');
            const data = JSON.parse(content);
            
            if (data.encrypted) {
              console.log(`${colors.yellow}This wallet is encrypted. Cannot display private key.${colors.reset}`);
            } else if (data.privateKey) {
              console.log(`\n${colors.bright}Wallet: ${wallet.name}${colors.reset}`);
              console.log(`${colors.cyan}Address:${colors.reset} ${data.address}`);
              console.log(`${colors.cyan}Private Key:${colors.reset} ${data.privateKey}`);
              if (data.mnemonic) {
                console.log(`${colors.cyan}Mnemonic:${colors.reset} ${data.mnemonic}`);
              }
            } else {
              console.log(`${colors.yellow}Private key not found in file${colors.reset}`);
            }
          } catch (error) {
            console.log(`${colors.red}Error reading wallet file: ${error.message}${colors.reset}`);
          }
        }
      } else {
        console.log(`${colors.red}Invalid wallet number${colors.reset}`);
      }
      break;
      
    case '6': // Delete wallet
      const deleteNum = await question(`${colors.yellow}Enter wallet number to DELETE: ${colors.reset}`);
      const deleteIndex = parseInt(deleteNum) - 1;
      
      if (deleteIndex >= 0 && deleteIndex < wallets.length) {
        const wallet = wallets[deleteIndex];
        
        console.log(`${colors.red}⚠️  WARNING: This will permanently delete the wallet file!${colors.reset}`);
        console.log(`${colors.red}Wallet: ${wallet.name} (${wallet.address})${colors.reset}`);
        const confirmDelete = await question(`${colors.red}Type "DELETE" to confirm: ${colors.reset}`);
        
        if (confirmDelete === 'DELETE') {
          try {
            fs.unlinkSync(wallet.filepath);
            console.log(`${colors.green}✅ Wallet file deleted${colors.reset}`);
          } catch (error) {
            console.log(`${colors.red}Error deleting file: ${error.message}${colors.reset}`);
          }
        } else {
          console.log(`${colors.yellow}Deletion cancelled${colors.reset}`);
        }
      } else {
        console.log(`${colors.red}Invalid wallet number${colors.reset}`);
      }
      break;
      
    case '0':
      console.log(`${colors.cyan}Goodbye!${colors.reset}`);
      break;
      
    default:
      console.log(`${colors.red}Invalid choice${colors.reset}`);
  }
  
  if (choice !== '0') {
    const continueChoice = await question(`\n${colors.yellow}Continue managing wallets? (yes/no): ${colors.reset}`);
    if (continueChoice.toLowerCase() === 'yes' || continueChoice.toLowerCase() === 'y') {
      console.clear();
      await mainMenu();
    }
  }
  
  rl.close();
}

// Run the script
mainMenu().catch((error) => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});