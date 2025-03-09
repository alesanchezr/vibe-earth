/**
 * Database migration script
 * Run with: node migrate.js
 */
require('dotenv').config();
const { migrate } = require('node-pg-migrate');
const path = require('path');

async function runMigration() {
  try {
    console.log('Running database migrations...');
    
    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    // Run migrations
    await migrate({
      databaseUrl,
      dir: path.join(__dirname, 'migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      log: message => console.log(message)
    });
    
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration(); 