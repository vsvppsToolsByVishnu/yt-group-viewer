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
      name TEXT NOT NULL,
      parent_id TEXT,
      is_expanded INTEGER DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES groups(id) ON DELETE CASCADE
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
  console.log("\n=== Testing Group Operations ===");
  
  // Create a test group
  const mainGroupId = Math.random().toString(36).substring(2, 15);
  const subGroupId = Math.random().toString(36).substring(2, 15);
  const subSubGroupId = Math.random().toString(36).substring(2, 15);
  
  // Create main group
  db.run(
    'INSERT INTO groups (id, name, is_expanded) VALUES (?, ?, ?)',
    [mainGroupId, 'Test Main Group', 1],
    function(err) {
      if (err) {
        console.error('Error creating main group:', err.message);
        return;
      }
      console.log('Main group created with ID:', mainGroupId);
      
      // Create sub group
      db.run(
        'INSERT INTO groups (id, name, parent_id, is_expanded) VALUES (?, ?, ?, ?)',
        [subGroupId, 'Test Sub Group', mainGroupId, 1],
        function(err) {
          if (err) {
            console.error('Error creating sub group:', err.message);
            return;
          }
          console.log('Sub group created with ID:', subGroupId);
          
          // Create sub-sub group
          db.run(
            'INSERT INTO groups (id, name, parent_id, is_expanded) VALUES (?, ?, ?, ?)',
            [subSubGroupId, 'Test Sub-Sub Group', subGroupId, 0],
            function(err) {
              if (err) {
                console.error('Error creating sub-sub group:', err.message);
                return;
              }
              console.log('Sub-sub group created with ID:', subSubGroupId);
              
              // Create a test channel
              const channelId = 'test_channel_' + Math.random().toString(36).substring(2, 9);
              db.run(
                'INSERT INTO channels (id, title, thumbnail_url, description) VALUES (?, ?, ?, ?)',
                [channelId, 'Test Channel', 'https://example.com/thumbnail.jpg', 'Test description'],
                function(err) {
                  if (err) {
                    console.error('Error creating test channel:', err.message);
                    return;
                  }
                  console.log('Test channel created with ID:', channelId);
                  
                  // Associate channel with groups
                  db.run(
                    'INSERT INTO group_channels (group_id, channel_id) VALUES (?, ?)',
                    [mainGroupId, channelId],
                    function(err) {
                      if (err) {
                        console.error('Error associating channel with main group:', err.message);
                        return;
                      }
                      console.log('Channel associated with main group');
                      
                      // Create another channel for subgroup
                      const subChannelId = 'test_subchannel_' + Math.random().toString(36).substring(2, 9);
                      db.run(
                        'INSERT INTO channels (id, title, thumbnail_url, description) VALUES (?, ?, ?, ?)',
                        [subChannelId, 'Test Sub Channel', 'https://example.com/subthumbnail.jpg', 'Test sub description'],
                        function(err) {
                          if (err) {
                            console.error('Error creating test sub channel:', err.message);
                            return;
                          }
                          console.log('Test sub channel created with ID:', subChannelId);
                          
                          // Associate channel with subgroup
                          db.run(
                            'INSERT INTO group_channels (group_id, channel_id) VALUES (?, ?)',
                            [subGroupId, subChannelId],
                            function(err) {
                              if (err) {
                                console.error('Error associating channel with sub group:', err.message);
                                return;
                              }
                              console.log('Channel associated with sub group');
                              
                              // Test retrieving group hierarchy
                              db.get(
                                `SELECT g.*, 
                                  (SELECT COUNT(*) FROM groups WHERE parent_id = g.id) as subgroup_count,
                                  (SELECT COUNT(*) FROM group_channels WHERE group_id = g.id) as channel_count
                                FROM groups g WHERE g.id = ?`,
                                [mainGroupId],
                                function(err, group) {
                                  if (err) {
                                    console.error('Error retrieving group:', err.message);
                                    return;
                                  }
                                  console.log('Main group with counts:', group);
                                  
                                  // Get subgroups
                                  db.all(
                                    'SELECT * FROM groups WHERE parent_id = ?',
                                    [mainGroupId],
                                    function(err, subgroups) {
                                      if (err) {
                                        console.error('Error retrieving subgroups:', err.message);
                                        return;
                                      }
                                      console.log(`Found ${subgroups.length} subgroups for main group:`, subgroups);
                                      
                                      // Test cleanup - delete main group (should cascade delete subgroups)
                                      testCleanup(mainGroupId);
                                    }
                                  );
                                }
                              );
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
}

function testCleanup(mainGroupId) {
  console.log("\n=== Cleanup - Deleting Test Groups ===");
  
  // Delete main group (will cascade delete subgroups and group-channel associations)
  db.run('DELETE FROM groups WHERE id = ?', [mainGroupId], function(err) {
    if (err) {
      console.error('Error deleting main group:', err.message);
      return;
    }
    console.log('Main group and all subgroups deleted successfully');
    
    // Verify deletion
    db.all('SELECT * FROM groups WHERE id = ? OR parent_id = ?', [mainGroupId, mainGroupId], function(err, groups) {
      if (err) {
        console.error('Error verifying deletion:', err.message);
        return;
      }
      console.log(`Found ${groups.length} groups after deletion (should be 0):`, groups);
      
      // Test cache next
        testCache();
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