import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Define the database path
const dbPath = path.join(dataDir, 'data.db');

// Initialize the database connection
export const initializeDatabase = async () => {
  // Open the database
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
  
  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON');
  
  // Create the tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key TEXT NOT NULL,
      priority INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      is_expanded INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (parent_id) REFERENCES groups(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      thumbnail_url TEXT,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    
    CREATE TABLE IF NOT EXISTS group_channels (
      group_id TEXT,
      channel_id TEXT,
      added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      PRIMARY KEY (group_id, channel_id),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      thumbnail_url TEXT,
      channel_id TEXT,
      channel_title TEXT,
      published_at TEXT,
      view_count TEXT,
      watched INTEGER DEFAULT 0,
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      expires_at INTEGER
    );
    
    -- Trigger to update the updated_at timestamp for groups
    CREATE TRIGGER IF NOT EXISTS update_groups_timestamp
    AFTER UPDATE ON groups
    FOR EACH ROW
    BEGIN
      UPDATE groups SET updated_at = (strftime('%s', 'now') * 1000) WHERE id = OLD.id;
    END;
    
    -- Trigger to update the updated_at timestamp for channels
    CREATE TRIGGER IF NOT EXISTS update_channels_timestamp
    AFTER UPDATE ON channels
    FOR EACH ROW
    BEGIN
      UPDATE channels SET updated_at = (strftime('%s', 'now') * 1000) WHERE id = OLD.id;
    END;
    
    -- Index for faster hierarchical queries
    CREATE INDEX IF NOT EXISTS idx_groups_parent_id ON groups(parent_id);
    
    -- Index for faster channel lookup
    CREATE INDEX IF NOT EXISTS idx_group_channels_channel_id ON group_channels(channel_id);
    
    -- Index for faster group lookup
    CREATE INDEX IF NOT EXISTS idx_group_channels_group_id ON group_channels(group_id);
    
    -- Index for cache expiration
    CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
  `);
  
  // Run migrations for existing database
  await runMigrations(db);
  
  return db;
};

// Function to run migrations on existing database
async function runMigrations(db: any) {
  try {
    console.log('Checking if migrations are needed...');
    
    // Check if parent_id column exists in groups table
    const parentColumnExists = await columnExists(db, 'groups', 'parent_id');
    if (!parentColumnExists) {
      console.log('Adding parent_id column to groups table');
      await db.exec('ALTER TABLE groups ADD COLUMN parent_id TEXT REFERENCES groups(id) ON DELETE CASCADE');
    }
    
    // Check if is_expanded column exists in groups table
    const expandedColumnExists = await columnExists(db, 'groups', 'is_expanded');
    if (!expandedColumnExists) {
      console.log('Adding is_expanded column to groups table');
      await db.exec('ALTER TABLE groups ADD COLUMN is_expanded INTEGER DEFAULT 0');
    }
    
    // Check if watched column exists in videos table
    const watchedColumnExists = await columnExists(db, 'videos', 'watched');
    if (!watchedColumnExists) {
      console.log('Adding watched column to videos table');
      await db.exec('ALTER TABLE videos ADD COLUMN watched INTEGER DEFAULT 0');
    }
    
    // Check if created_at column exists in groups table
    const createdAtColumnExists = await columnExists(db, 'groups', 'created_at');
    if (!createdAtColumnExists) {
      console.log('Adding timestamp columns to groups table');
      await db.exec('ALTER TABLE groups ADD COLUMN created_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\') * 1000)');
      await db.exec('ALTER TABLE groups ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\') * 1000)');
    }
    
    // Check if created_at column exists in channels table
    const channelCreatedAtColumnExists = await columnExists(db, 'channels', 'created_at');
    if (!channelCreatedAtColumnExists) {
      console.log('Adding timestamp columns to channels table');
      await db.exec('ALTER TABLE channels ADD COLUMN created_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\') * 1000)');
      await db.exec('ALTER TABLE channels ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\') * 1000)');
    }
    
    // Check if added_at column exists in group_channels table
    const addedAtColumnExists = await columnExists(db, 'group_channels', 'added_at');
    if (!addedAtColumnExists) {
      console.log('Adding added_at column to group_channels table');
      await db.exec('ALTER TABLE group_channels ADD COLUMN added_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\') * 1000)');
    }
    
    // Check if expires_at column exists in cache table
    const expiresAtColumnExists = await columnExists(db, 'cache', 'expires_at');
    if (!expiresAtColumnExists) {
      console.log('Adding expires_at column to cache table');
      await db.exec('ALTER TABLE cache ADD COLUMN expires_at INTEGER');
    }
    
    // Create indexes if they don't exist
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_groups_parent_id ON groups(parent_id);
      CREATE INDEX IF NOT EXISTS idx_group_channels_channel_id ON group_channels(channel_id);
      CREATE INDEX IF NOT EXISTS idx_group_channels_group_id ON group_channels(group_id);
      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
    `);
    
    // Create triggers if they don't exist
    const groupTriggerExists = await triggerExists(db, 'update_groups_timestamp');
    if (!groupTriggerExists) {
      console.log('Creating update trigger for groups');
      await db.exec(`
        CREATE TRIGGER update_groups_timestamp
        AFTER UPDATE ON groups
        FOR EACH ROW
        BEGIN
          UPDATE groups SET updated_at = (strftime('%s', 'now') * 1000) WHERE id = OLD.id;
        END;
      `);
    }
    
    const channelTriggerExists = await triggerExists(db, 'update_channels_timestamp');
    if (!channelTriggerExists) {
      console.log('Creating update trigger for channels');
      await db.exec(`
        CREATE TRIGGER update_channels_timestamp
        AFTER UPDATE ON channels
        FOR EACH ROW
        BEGIN
          UPDATE channels SET updated_at = (strftime('%s', 'now') * 1000) WHERE id = OLD.id;
        END;
      `);
    }
    
    console.log('Database migrations complete');
    
    // Verify schema
    const groupsSchema = await db.all("PRAGMA table_info(groups)");
    console.log('Groups table schema:', groupsSchema.map((col: any) => `${col.name} (${col.type})`).join(', '));
    
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

// Helper function to check if a column exists in a table
async function columnExists(db: any, tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await db.get(
      `SELECT COUNT(*) as count FROM pragma_table_info('${tableName}') WHERE name = ?`,
      [columnName]
    );
    return result.count > 0;
  } catch (error) {
    console.error(`Error checking if column ${columnName} exists in table ${tableName}:`, error);
    return false;
  }
}

// Helper function to check if a trigger exists
async function triggerExists(db: any, triggerName: string): Promise<boolean> {
  try {
    const result = await db.get(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'trigger' AND name = ?`,
      [triggerName]
    );
    return result.count > 0;
  } catch (error) {
    console.error(`Error checking if trigger ${triggerName} exists:`, error);
    return false;
  }
}

// Legacy export for backward compatibility
export const getDb = async () => {
  return await initializeDatabase();
};

// Export a singleton database connection that can be reused
let dbConnection: any = null;

export const getDbConnection = async () => {
  if (!dbConnection) {
    dbConnection = await initializeDatabase();
  }
  return dbConnection;
}; 