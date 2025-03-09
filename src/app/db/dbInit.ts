import { initializeDatabase, getDbConnection } from './sqliteSetup';
import * as indexedDb from './database'; // Import the old IndexedDB database
import { APIKey, Group } from '../types';

// Initialize the database when this module is imported
(async () => {
  console.log('Initializing SQLite database...');
  try {
    const db = await initializeDatabase();
    console.log('SQLite database initialization complete');
    
    // Check if we need to migrate data from IndexedDB
    await migrateFromIndexedDB(db);
  } catch (error) {
    console.error('Failed to initialize SQLite database:', error);
  }
})();

// Function to migrate data from IndexedDB to SQLite
async function migrateFromIndexedDB(db: any) {
  try {
    // Check if we've already migrated (by checking if any groups exist in SQLite)
    const groupsExistQuery = await db.get('SELECT COUNT(*) as count FROM groups');
    const apiKeysExistQuery = await db.get('SELECT COUNT(*) as count FROM api_keys');
    
    if (groupsExistQuery.count > 0 || apiKeysExistQuery.count > 0) {
      console.log('Data already exists in SQLite, skipping migration');
      return;
    }
    
    console.log('Starting migration from IndexedDB to SQLite...');
    
    // Migrate groups and their channels
    const indexedDbGroups = await indexedDb.getGroups();
    console.log(`Found ${indexedDbGroups.length} groups in IndexedDB`);
    
    // Start a transaction
    await db.exec('BEGIN TRANSACTION');
    
    // Migrate groups
    for (const group of indexedDbGroups) {
      // Insert the group
      await db.run(
        'INSERT INTO groups (id, name) VALUES (?, ?)',
        [group.id, group.name]
      );
      
      // Insert each channel and create relationships
      for (const channel of group.channels) {
        // Insert the channel if it doesn't exist
        await db.run(
          'INSERT OR IGNORE INTO channels (id, title, thumbnail_url, description) VALUES (?, ?, ?, ?)',
          [channel.id, channel.title, channel.thumbnailUrl, channel.description]
        );
        
        // Create the relationship
        await db.run(
          'INSERT INTO group_channels (group_id, channel_id) VALUES (?, ?)',
          [group.id, channel.id]
        );
      }
    }
    
    // Migrate API keys
    const indexedDbApiKeys = await indexedDb.getAPIKeys();
    console.log(`Found ${indexedDbApiKeys.length} API keys in IndexedDB`);
    
    for (const apiKey of indexedDbApiKeys) {
      await db.run(
        'INSERT INTO api_keys (name, key, priority, is_active) VALUES (?, ?, ?, ?)',
        [apiKey.name, apiKey.key, apiKey.priority, apiKey.isActive ? 1 : 0]
      );
    }
    
    // Commit the transaction
    await db.exec('COMMIT');
    
    console.log('Migration from IndexedDB to SQLite completed successfully');
  } catch (error) {
    // Rollback in case of error
    try {
      await db.exec('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    
    console.error('Error migrating from IndexedDB to SQLite:', error);
  }
}

export default {}; 