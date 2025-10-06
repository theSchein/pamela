#!/usr/bin/env node

/**
 * One-time setup script to create agent in database
 * This resolves the ElizaOS 1.6.1 foreign key constraint issue
 * where entities.agent_id requires agents.id to exist
 */

import { PGlite } from '@electric-sql/pglite';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupAgentDatabase() {
    const AGENT_CHARACTER = process.env.AGENT_CHARACTER || 'pamela';
    const DB_SUFFIX = AGENT_CHARACTER ? `-${AGENT_CHARACTER}` : '';
    const DB_DIR = process.env.PGLITE_DATA_DIR || join(__dirname, `../.eliza/.elizadb${DB_SUFFIX}`);
    const ELIZA_DIR = join(__dirname, '../.eliza');
    
    console.log('===========================================');
    console.log('  Agent Database Setup');
    console.log('===========================================');
    console.log(`Agent: ${AGENT_CHARACTER}`);
    console.log(`Database: ${DB_DIR}`);
    console.log('');
    
    // Ensure .eliza directory exists
    if (!existsSync(ELIZA_DIR)) {
        mkdirSync(ELIZA_DIR, { recursive: true });
        console.log('✓ Created .eliza directory');
    }
    
    // Create database directory
    if (!existsSync(DB_DIR)) {
        mkdirSync(DB_DIR, { recursive: true });
        console.log('✓ Created database directory');
    }
    
    // Load agent config
    const configPath = join(__dirname, `../agents/${AGENT_CHARACTER}/agent-config.json`);
    if (!existsSync(configPath)) {
        console.error(`✗ No agent config found at ${configPath}`);
        process.exit(1);
    }
    
    const configData = readFileSync(configPath, 'utf-8');
    const agentConfig = JSON.parse(configData);
    
    console.log(`Loading config for: ${agentConfig.name} (${agentConfig.id})`);
    
    try {
        const db = new PGlite(DB_DIR);
        
        // Wait for database to be ready
        await db.ready;
        console.log('✓ Database connection established');
        
        // Create agents table if it doesn't exist
        await db.query(`
            CREATE TABLE IF NOT EXISTS agents (
                id UUID PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(255),
                bio JSONB DEFAULT '[]',
                message_examples JSONB DEFAULT '[]',
                post_examples JSONB DEFAULT '[]',
                topics JSONB DEFAULT '[]',
                adjectives JSONB DEFAULT '[]',
                knowledge JSONB DEFAULT '[]',
                plugins JSONB DEFAULT '[]',
                settings JSONB DEFAULT '{}',
                style JSONB DEFAULT '{}',
                system TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ Agents table ready');
        
        // Check if agent exists
        const agentExists = await db.query(
            `SELECT id FROM agents WHERE id = $1`,
            [agentConfig.id]
        );
        
        if (agentExists.rows.length === 0) {
            // Delete any agent with same name but different ID
            const deleted = await db.query(
                `DELETE FROM agents WHERE name = $1 AND id != $2 RETURNING id`,
                [agentConfig.name, agentConfig.id]
            );
            
            if (deleted.rows.length > 0) {
                console.log(`✓ Removed conflicting agent with same name`);
            }
            
            // Create the agent record
            await db.query(`
                INSERT INTO agents (
                    id, name, username, bio, message_examples, 
                    post_examples, topics, adjectives, knowledge, 
                    plugins, settings, style, system
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
                agentConfig.id,
                agentConfig.name,
                agentConfig.name.toLowerCase().replace(/\s+/g, '_'),
                JSON.stringify(agentConfig.bio || []),
                JSON.stringify(agentConfig.messageExamples || []),
                JSON.stringify(agentConfig.postExamples || []),
                JSON.stringify(agentConfig.topics || []),
                JSON.stringify(agentConfig.adjectives || []),
                JSON.stringify(agentConfig.knowledge || []),
                JSON.stringify(agentConfig.plugins || []),
                JSON.stringify(agentConfig.settings || {}),
                JSON.stringify(agentConfig.style || {}),
                agentConfig.system || ''
            ]);
            
            console.log('✓ Agent record created successfully');
        } else {
            console.log('✓ Agent record already exists');
        }
        
        // Verify the agent exists
        const verification = await db.query(
            `SELECT id, name FROM agents WHERE id = $1`,
            [agentConfig.id]
        );
        
        if (verification.rows.length > 0) {
            console.log(`✓ Verified: Agent "${verification.rows[0].name}" exists in database`);
        }
        
        await db.close();
        console.log('✓ Database setup complete');
        console.log('');
        console.log('You can now start your agent with:');
        console.log(`  export AGENT_CHARACTER=${AGENT_CHARACTER} && npm run dev`);
        
    } catch (error) {
        console.error(`✗ Database setup failed: ${error.message}`);
        process.exit(1);
    }
}

// Run setup
setupAgentDatabase().catch(console.error);