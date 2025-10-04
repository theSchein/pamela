#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_DIR = join(__dirname, '../.eliza/.elizadb');
const ELIZA_DIR = join(__dirname, '../.eliza');
const MAX_RETRIES = 3;
let retryCount = 0;
let serverProcess = null;

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function resetDatabase() {
    log('🔧 Resetting corrupted database...', 'yellow');
    try {
        if (existsSync(DB_DIR)) {
            rmSync(DB_DIR, { recursive: true, force: true });
            log('  ✓ Removed corrupted database', 'green');
        }
        
        if (!existsSync(ELIZA_DIR)) {
            mkdirSync(ELIZA_DIR, { recursive: true });
            log('  ✓ Created .eliza directory', 'green');
        }
        
        log('✅ Database reset successfully', 'green');
        return true;
    } catch (error) {
        log(`❌ Failed to reset database: ${error.message}`, 'red');
        return false;
    }
}

function detectDatabaseError(data) {
    const errorPatterns = [
        'Aborted(). Build with -sASSERTIONS',
        'CUSTOM MIGRATOR] Database connection failed',
        'PGLite connection error',
        'RuntimeError: Aborted()',
        // Only match actual failures, not info messages about migrations
        'Error: Failed to run database migrations',
        'Fatal: Database connection failed',
        'Critical: Database migration failed',
        // Add entity creation errors
        'Failed to create agent entity',
        'Failed to create entity for agent'
    ];
    
    const dataStr = data.toString();
    
    // Don't treat normal migration messages as errors
    if (dataStr.includes('Running database migrations') || 
        dataStr.includes('Checking database migrations') ||
        dataStr.includes('Database migrations completed')) {
        return false;
    }
    
    return errorPatterns.some(pattern => dataStr.includes(pattern));
}

function startServer(isDevMode = false) {
    return new Promise((resolve, reject) => {
        retryCount++;
        log(`\n🚀 Starting server (attempt ${retryCount}/${MAX_RETRIES + 1})...`, 'cyan');
        log(`Mode: ${isDevMode ? 'Development (elizaos dev)' : 'Production (elizaos start)'}`, 'cyan');
        
        // Use elizaos CLI commands
        const command = isDevMode ? 'dev' : 'start';
        serverProcess = spawn('elizaos', [command], {
            stdio: ['inherit', 'pipe', 'pipe'],
            cwd: join(__dirname, '..'),
            shell: true
        });

        let errorDetected = false;
        let outputBuffer = '';
        let errorCheckTimeout;

        // Function to check buffered output for database errors
        const checkForDatabaseError = () => {
            if (detectDatabaseError(outputBuffer)) {
                errorDetected = true;
                clearTimeout(errorCheckTimeout);
                
                log('\n❌ Database corruption detected!', 'red');
                
                // Kill the server process
                if (serverProcess && !serverProcess.killed) {
                    serverProcess.kill('SIGTERM');
                }
                
                // Trigger recovery
                if (retryCount <= MAX_RETRIES) {
                    log(`🔄 Attempting automatic recovery (${retryCount}/${MAX_RETRIES})...`, 'yellow');
                    
                    if (resetDatabase()) {
                        log('⏳ Waiting 2 seconds before retry...', 'cyan');
                        setTimeout(() => {
                            startServer(isDevMode)
                                .then(resolve)
                                .catch(reject);
                        }, 2000);
                    } else {
                        reject(new Error('Database reset failed'));
                    }
                } else {
                    reject(new Error('Max retries exceeded'));
                }
                
                return true;
            }
            return false;
        };

        // Monitor stdout
        serverProcess.stdout.on('data', (data) => {
            process.stdout.write(data);
            outputBuffer += data.toString();
            
            // Check for database errors in output (skip during grace period)
            if (!errorDetected && !graceperiodActive) {
                checkForDatabaseError();
            }
        });

        // Monitor stderr
        serverProcess.stderr.on('data', (data) => {
            process.stderr.write(data);
            outputBuffer += data.toString();
            
            // Check for database errors in output (skip during grace period)
            if (!errorDetected && !graceperiodActive) {
                checkForDatabaseError();
            }
        });

        // Set a longer initial grace period for database initialization
        // Don't check for errors in the first 5 seconds to allow normal startup
        let graceperiodActive = true;
        setTimeout(() => {
            graceperiodActive = false;
            log('👀 Now monitoring for database errors...', 'cyan');
        }, 5000);
        
        // Set a timeout to check for errors after initial startup
        errorCheckTimeout = setTimeout(() => {
            if (!errorDetected) {
                log('\n✅ Server started successfully', 'green');
                resolve(serverProcess);
            }
        }, 30000);

        serverProcess.on('error', (error) => {
            clearTimeout(errorCheckTimeout);
            if (!errorDetected) {
                errorDetected = true;
                log(`❌ Server process error: ${error.message}`, 'red');
                reject(error);
            }
        });

        serverProcess.on('exit', (code, signal) => {
            clearTimeout(errorCheckTimeout);
            
            if (!errorDetected && code !== 0) {
                errorDetected = true;
                const errorMsg = signal ? `killed by signal ${signal}` : `exited with code ${code}`;
                log(`⚠️  Server ${errorMsg}`, 'yellow');
                
                // Check if we should retry
                if (retryCount <= MAX_RETRIES) {
                    log(`🔄 Attempting recovery (${retryCount}/${MAX_RETRIES})...`, 'yellow');
                    
                    // Assume database corruption for early exits
                    if (resetDatabase()) {
                        log('⏳ Waiting 2 seconds before retry...', 'cyan');
                        setTimeout(() => {
                            startServer(isDevMode)
                                .then(resolve)
                                .catch(reject);
                        }, 2000);
                    } else {
                        reject(new Error('Database reset failed'));
                    }
                } else {
                    reject(new Error(`Server ${errorMsg}`));
                }
            }
        });
    });
}

async function main() {
    const isDevMode = process.argv.includes('--dev') || process.argv.includes('dev');
    
    log('═══════════════════════════════════════════════════════', 'magenta');
    log('  🤖 Pamela Trading Agent - Startup with Recovery', 'magenta');
    log('═══════════════════════════════════════════════════════', 'magenta');
    log(`Database: ${DB_DIR}`, 'cyan');
    log('Recovery: Automatic on database errors', 'cyan');
    log('Max retries: ' + MAX_RETRIES, 'cyan');
    
    try {
        const server = await startServer(isDevMode);
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            log('\n👋 Shutting down gracefully...', 'yellow');
            if (server && !server.killed) {
                server.kill('SIGINT');
            }
            setTimeout(() => process.exit(0), 1000);
        });

        process.on('SIGTERM', () => {
            if (server && !server.killed) {
                server.kill('SIGTERM');
            }
            process.exit(0);
        });
        
    } catch (error) {
        log(`\n❌ Failed to start server: ${error.message}`, 'red');
        
        if (retryCount > MAX_RETRIES) {
            log('\n💡 Recovery attempts exhausted. Manual intervention required:', 'yellow');
            log('   1. Check your .env configuration', 'yellow');
            log('   2. Run: rm -rf .eliza/.elizadb', 'yellow');
            log('   3. Restart with: npm start', 'yellow');
        }
        
        process.exit(1);
    }
}

// Start the server with recovery
main().catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
});