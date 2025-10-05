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
        'Database connection failed',
        'Database migration failed',
        'CUSTOM MIGRATOR] Database connection failed',
        'PGLite connection error',
        'RuntimeError: Aborted()',
        'Failed to run database migrations',
        // Entity creation errors for ElizaOS 1.6.1
        'Failed to create entity for agent',
        'Error creating entities'
    ];
    
    const dataStr = data.toString();
    
    // Don't treat port errors as database errors
    if (dataStr.includes('EADDRINUSE') || dataStr.includes('Port') && dataStr.includes('already in use')) {
        return false;
    }
    
    return errorPatterns.some(pattern => dataStr.includes(pattern));
}

function startServer(isDevMode = false) {
    return new Promise((resolve, reject) => {
        retryCount++;
        log(`\n🚀 Starting server (attempt ${retryCount}/${MAX_RETRIES + 1})...`, 'cyan');
        log(`Mode: ${isDevMode ? 'Development (elizaos dev)' : 'Production (elizaos start)'}`, 'cyan');
        
        // Use elizaos CLI commands with port configuration
        const command = isDevMode ? 'dev' : 'start';
        const args = [command];
        
        // Add port argument if SERVER_PORT is set in environment
        const serverPort = process.env.SERVER_PORT;
        if (serverPort) {
            args.push('--port', serverPort);
            log(`Using port: ${serverPort}`, 'cyan');
        }
        
        serverProcess = spawn('elizaos', args, {
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
                
                // Kill the server process immediately
                if (serverProcess && !serverProcess.killed) {
                    serverProcess.kill('SIGKILL'); // Use SIGKILL for immediate termination
                    serverProcess = null; // Clear the reference
                }
                
                // Don't trigger recovery here - let the 'exit' event handler do it
                // This prevents duplicate recovery attempts
                return true;
            }
            return false;
        };

        // Monitor stdout
        serverProcess.stdout.on('data', (data) => {
            process.stdout.write(data);
            outputBuffer += data.toString();
            
            // Check for database errors in output
            if (!errorDetected) {
                checkForDatabaseError();
            }
        });

        // Monitor stderr
        serverProcess.stderr.on('data', (data) => {
            process.stderr.write(data);
            outputBuffer += data.toString();
            
            // Check for database errors in output
            if (!errorDetected) {
                checkForDatabaseError();
            }
        });

        // Set a timeout to check for errors in the first 30 seconds
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
                
                // Check if this is actually a database error before attempting recovery
                const isDatabaseError = detectDatabaseError(outputBuffer);
                
                // Check if this is a port error
                const isPortError = outputBuffer.includes('EADDRINUSE') || 
                                  (outputBuffer.includes('Port') && outputBuffer.includes('already in use'));
                
                if (isPortError) {
                    log('❌ Port conflict detected. The port is already in use.', 'red');
                    log('💡 Please stop any other processes using the port or change SERVER_PORT in .env', 'yellow');
                    reject(new Error('Port already in use'));
                    return;
                }
                
                // Only attempt recovery for database errors
                if (isDatabaseError && retryCount <= MAX_RETRIES) {
                    log(`🔄 Attempting recovery (${retryCount}/${MAX_RETRIES})...`, 'yellow');
                    
                    if (resetDatabase()) {
                        log('⏳ Waiting 4 seconds before retry...', 'cyan');
                        // Ensure process is dead and port is freed
                        setTimeout(() => {
                            // Double-check the port is free before retrying
                            const checkPort = spawn('lsof', ['-i', ':3000'], { 
                                stdio: 'pipe',
                                shell: false 
                            });
                            
                            checkPort.on('close', (code) => {
                                if (code === 0) {
                                    // Port is still in use, try to kill it
                                    log('⚠️  Port 3000 still in use, attempting to free it...', 'yellow');
                                    const killCmd = spawn('sh', ['-c', 'lsof -i :3000 | grep -v COMMAND | awk \'{print $2}\' | xargs -r kill -9'], {
                                        stdio: 'inherit'
                                    });
                                    killCmd.on('close', () => {
                                        setTimeout(() => {
                                            startServer(isDevMode)
                                                .then(resolve)
                                                .catch(reject);
                                        }, 1000);
                                    });
                                } else {
                                    // Port is free, proceed with retry
                                    startServer(isDevMode)
                                        .then(resolve)
                                        .catch(reject);
                                }
                            });
                        }, 4000);
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