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
      name TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      thumbnail_url TEXT,
      description TEXT
    );
    
    CREATE TABLE IF NOT EXISTS group_channels (
      group_id TEXT,
      channel_id TEXT,
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
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);
  
  console.log('Database initialized successfully');
  
  return db;
};

// Get a database connection
export const getDb = async () => {
  return await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
};

// Export a singleton database connection that can be reused
let dbConnection: any = null;

export const getDbConnection = async () => {
  if (!dbConnection) {
    dbConnection = await initializeDatabase();
  }
  return dbConnection;
}; 