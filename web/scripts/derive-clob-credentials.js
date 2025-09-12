const { ethers } = require('ethers');
const { ClobClient } = require('@polymarket/clob-client');
require('dotenv').config({ path: '../.env' });

async function deriveCredentials() {
  try {
    const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
    if (!privateKey) {
      console.error('No POLYMARKET_PRIVATE_KEY found in .env');
      return;
    }

    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey);
    console.log('Wallet Address:', wallet.address);

    // Derive API credentials
    console.log('\nDeriving CLOB API credentials...');
    const host = 'https://clob.polymarket.com';
    const chainId = 137; // Polygon mainnet
    
    // Create a provider for Polygon
    const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
    const signer = wallet.connect(provider);
    
    // Add the missing _signTypedData method for ethers v6 compatibility
    if (!signer._signTypedData) {
      signer._signTypedData = signer.signTypedData;
    }

    // Create a CLOB client instance
    const client = new ClobClient(host, chainId, signer);
    
    // Derive credentials using the instance method
    const creds = await client.deriveApiKey();
    
    console.log('\n✅ API Credentials Generated:');
    console.log('================================');
    console.log('API Key:', creds.key);
    console.log('API Secret:', creds.secret);
    console.log('API Passphrase:', creds.passphrase);
    console.log('================================');
    
    console.log('\nAdd these to your web/.env.local file:');
    console.log(`CLOB_API_KEY=${creds.key}`);
    console.log(`CLOB_API_SECRET=${creds.secret}`);
    console.log(`CLOB_API_PASSPHRASE=${creds.passphrase}`);
    
    return creds;
  } catch (error) {
    console.error('Error deriving credentials:', error);
  }
}

deriveCredentials();