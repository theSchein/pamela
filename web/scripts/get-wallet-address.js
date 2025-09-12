const { ethers } = require('ethers');
require('dotenv').config({ path: '../.env' });

const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
if (privateKey) {
  const wallet = new ethers.Wallet(privateKey);
  console.log('Wallet Address:', wallet.address);
} else {
  console.log('No POLYMARKET_PRIVATE_KEY found in .env');
}