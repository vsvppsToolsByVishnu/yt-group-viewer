// Test script for SQLite database
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory:', dataDir);
}

// Define the database path
const dbPath = path.join(dataDir, 'data.db');
console.log('Database path:', dbPath);

// Open the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
  
  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');
  
  // Create the tables if they don't exist
  const createTables = `
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
  `;
  
  db.exec(createTables, (err) => {
    if (err) {
      console.error('Error creating tables:', err.message);
      closeAndExit(1);
    }
    console.log('Database tables created successfully.');
    
    // Test functions
    testGroup();
  });
});

// Test adding a group
function testGroup() {
  console.log('\n=== Testing Group Operations ===');
  
  const groupId = 'test-group-' + Date.now();
  const groupName = 'Test Group';
  
  // Insert a test group
  db.run('INSERT INTO groups (id, name) VALUES (?, ?)', [groupId, groupName], function(err) {
    if (err) {
      console.error('Error inserting group:', err.message);
      return closeAndExit(1);
    }
    console.log(`Group inserted with ID: ${groupId}`);
    
    // Read groups
    db.all('SELECT * FROM groups', [], (err, rows) => {
      if (err) {
        console.error('Error reading groups:', err.message);
        return closeAndExit(1);
      }
      console.log('Groups in database:');
      console.log(rows);
      
      // Delete the test group
      db.run('DELETE FROM groups WHERE id = ?', [groupId], function(err) {
        if (err) {
          console.error('Error deleting group:', err.message);
          return closeAndExit(1);
        }
        console.log(`Group with ID ${groupId} deleted.`);
        
        // Test cache
        testCache();
      });
    });
  });
}

// Test cache
function testCache() {
  console.log('\n=== Testing Cache Operations ===');
  
  const cacheKey = 'test-cache-' + Date.now();
  const cacheData = JSON.stringify({ test: 'data', value: 123 });
  const cacheType = 'test';
  const timestamp = Date.now();
  
  // Insert cache entry
  db.run(
    'INSERT INTO cache (key, data, type, timestamp) VALUES (?, ?, ?, ?)',
    [cacheKey, cacheData, cacheType, timestamp],
    function(err) {
      if (err) {
        console.error('Error inserting cache:', err.message);
        return closeAndExit(1);
      }
      console.log(`Cache entry inserted with key: ${cacheKey}`);
      
      // Read cache
      db.get('SELECT * FROM cache WHERE key = ?', [cacheKey], (err, row) => {
        if (err) {
          console.error('Error reading cache:', err.message);
          return closeAndExit(1);
        }
        console.log('Cache entry:');
        console.log(row);
        console.log('Parsed data:', JSON.parse(row.data));
        
        // Delete the test cache
        db.run('DELETE FROM cache WHERE key = ?', [cacheKey], function(err) {
          if (err) {
            console.error('Error deleting cache:', err.message);
            return closeAndExit(1);
          }
          console.log(`Cache with key ${cacheKey} deleted.`);
          
          // All tests passed
          console.log('\n=== All tests passed! The SQLite database is working correctly. ===');
          closeAndExit(0);
        });
      });
    }
  );
}

// Close the database and exit
function closeAndExit(code = 0) {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
      process.exit(1);
    }
    console.log('Database connection closed.');
    process.exit(code);
  });
} 