import { initializeDatabase, getDbConnection } from './sqliteSetup';
import db, { getGroups, getAPIKeys } from './database'; // Import the default export and helper methods
import { APIKey, Group } from '../types';

// Initialize the database when this module is imported
(async () => {
  console.log('Initializing SQLite database...');
  try {
    const sqliteDb = await initializeDatabase();
    console.log('SQLite database initialization complete');
    
    // Verify schema 
    const tableInfo = await sqliteDb.all("PRAGMA table_info(groups)");
    console.log('Groups table schema:', tableInfo.map(col => col.name).join(', '));
    
    // Check if we need to migrate data from IndexedDB
    await migrateFromIndexedDB(sqliteDb);
  } catch (error) {
    console.error('Failed to initialize SQLite database:', error);
  }
})();

// Function to migrate data from IndexedDB to SQLite
async function migrateFromIndexedDB(sqliteDb: any) {
  try {
    // Check if data already exists in SQLite
    const existingData = await sqliteDb.get('SELECT COUNT(*) as count FROM groups');
    if (existingData && existingData.count > 0) {
      console.log('Data already exists in SQLite database, skipping migration');
      return;
    }

    console.log('Starting migration from IndexedDB to SQLite...');
    
    // Start a transaction
    await sqliteDb.exec('BEGIN TRANSACTION');
    
    // Get data from IndexedDB
    const indexedDbGroups = await db.groups.toArray();
    const indexedDbApiKeys = await db.apiKeys.toArray();
    
    // Insert groups
    for (const group of indexedDbGroups) {
      await sqliteDb.run(
        'INSERT INTO groups (id, name, parent_id, is_expanded) VALUES (?, ?, ?, ?)',
        [group.id, group.name, group.parentId || null, group.isExpanded ? 1 : 0]
      );
      
      // Insert channels for this group
      for (const channel of group.channels) {
        // Insert the channel
        await sqliteDb.run(
          'INSERT OR IGNORE INTO channels (id, title, thumbnail_url, description) VALUES (?, ?, ?, ?)',
          [channel.id, channel.title, channel.thumbnailUrl, channel.description || null]
        );
        
        // Create relationship
        await sqliteDb.run(
          'INSERT INTO group_channels (group_id, channel_id) VALUES (?, ?)',
          [group.id, channel.id]
        );
      }
    }
    
    // Insert API keys
    for (const apiKey of indexedDbApiKeys) {
      await sqliteDb.run(
        'INSERT INTO api_keys (name, key, priority, is_active) VALUES (?, ?, ?, ?)',
        [apiKey.name, apiKey.key, apiKey.priority, apiKey.isActive ? 1 : 0]
      );
    }
    
    // Commit the transaction
    await sqliteDb.exec('COMMIT');
    
    console.log('Migration from IndexedDB to SQLite completed successfully');
  } catch (error) {
    // Rollback in case of error
    try {
      await sqliteDb.exec('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    
    console.error('Error migrating from IndexedDB to SQLite:', error);
  }
}

export default {}; 