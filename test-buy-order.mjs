#!/usr/bin/env node

/**
 * Official ElizaOS API Test Script
 * Based on eliza.how documentation for programmatic agent interaction
 */

import { io } from 'socket.io-client';
import axios from 'axios';

const ELIZA_URL = 'http://localhost:3000';
const TEST_USER_ID = 'test-user-' + Math.random().toString(36).substr(2, 9);
const TEST_ROOM_ID = 'test-room-' + Math.random().toString(36).substr(2, 9);

class ElizaOfficialClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.messageResponses = new Map();
  }

  async connect() {
    console.log('🔌 Connecting to ElizaOS via Socket.IO (official method)...');
    
    return new Promise((resolve, reject) => {
      this.socket = io(ELIZA_URL, {
        timeout: 10000,
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to ElizaOS successfully');
        this.connected = true;
        this.setupEventHandlers();
        resolve(true);
      });

      this.socket.on('connect_error', (error) => {
        console.log('❌ Connection failed:', error.message);
        reject(error);
      });

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  setupEventHandlers() {
    // Official ElizaOS event handlers from documentation
    
    this.socket.on('messageBroadcast', (data) => {
      console.log('📨 Message broadcast:', data);
    });

    this.socket.on('messageComplete', (data) => {
      console.log('✅ Message processing complete:', data);
      // Store response for retrieval
      if (data.messageId) {
        this.messageResponses.set(data.messageId, data);
      }
    });

    this.socket.on('world-state', (data) => {
      console.log('🌍 World state update:', Object.keys(data));
    });

    this.socket.on('logEntry', (data) => {
      console.log('📝 Log:', data.message);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  }

  async joinRoom() {
    console.log(`🚪 Joining room: ${TEST_ROOM_ID}`);
    
    return new Promise((resolve) => {
      this.socket.emit('join', {
        roomId: TEST_ROOM_ID,
        userId: TEST_USER_ID,
        userName: 'Test User'
      }, (response) => {
        console.log('✅ Joined room:', response);
        resolve(response);
      });
    });
  }

  async sendMessage(text) {
    if (!this.connected) {
      throw new Error('Not connected to ElizaOS');
    }

    console.log(`📤 Sending message: "${text}"`);
    const messageId = 'msg-' + Date.now();
    
    return new Promise((resolve, reject) => {
      this.socket.emit('message', {
        text: text,
        roomId: TEST_ROOM_ID,
        userId: TEST_USER_ID,
        userName: 'Test User',
        messageId: messageId
      }, (response) => {
        console.log('📥 Message sent response:', response);
        
        // Wait for message processing to complete
        const checkComplete = () => {
          if (this.messageResponses.has(messageId)) {
            const result = this.messageResponses.get(messageId);
            this.messageResponses.delete(messageId);
            resolve(result);
          } else {
            setTimeout(checkComplete, 500);
          }
        };
        
        setTimeout(checkComplete, 1000);
        
        // Timeout after 30 seconds
        setTimeout(() => {
          reject(new Error('Message processing timeout'));
        }, 30000);
      });
    });
  }

  async testRESTApi() {
    console.log('🌐 Testing REST API endpoint...');
    
    try {
      const response = await axios.post(`${ELIZA_URL}/api/messaging/submit`, {
        text: 'Hello via REST API',
        userId: TEST_USER_ID,
        roomId: TEST_ROOM_ID
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ REST API response:', response.data);
      return response.data;
    } catch (error) {
      console.log('⚠️  REST API not available:', error.message);
      return null;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.emit('leave', { roomId: TEST_ROOM_ID, userId: TEST_USER_ID });
      this.socket.disconnect();
      console.log('🔌 Disconnected from ElizaOS');
    }
  }
}

async function runOfficialTests() {
  const client = new ElizaOfficialClient();
  
  try {
    console.log('🚀 Starting ElizaOS official API tests...\n');
    
    // Connect using official Socket.IO method
    await client.connect();
    
    // Join room (official pattern)
    await client.joinRoom();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test REST API
    await client.testRESTApi();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test wallet balance check
    console.log('\n💰 Testing wallet balance...');
    await client.sendMessage('What is my wallet balance?');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test market listing
    console.log('\n📊 Testing market listing...');
    await client.sendMessage('Show me 3 open markets');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test small buy order
    console.log('\n🛒 Testing buy order...');
    await client.sendMessage('Buy YES for $1 in any market with low risk');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('\n✅ All official API tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    client.disconnect();
    process.exit(0);
  }
}

// Run tests
runOfficialTests();