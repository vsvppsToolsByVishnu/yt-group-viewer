import { NextRequest, NextResponse } from 'next/server';
import * as sqliteDB from '../../../app/db/sqliteDB';
import { getDbConnection } from '../../../app/db/sqliteSetup';

export async function POST(request: NextRequest) {
  try {
    // Get the uploaded data
    const data = await request.json();
    
    if (!data) {
      return NextResponse.json({ 
        success: false, 
        error: 'No data provided'
      }, { status: 400 });
    }
    
    // Validate imported data
    if (!validateImportData(data)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid data format'
      }, { status: 400 });
    }
    
    // Get direct database connection for transactions
    const db = await getDbConnection();
    
    // Start a transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Process API keys
      if (data.apiKeys && Array.isArray(data.apiKeys)) {
        console.log(`Importing ${data.apiKeys.length} API keys`);
        
        for (const apiKey of data.apiKeys) {
          // Extract the properties we need
          const apiKeyToSave = {
            name: apiKey.name || 'Imported API Key',
            key: apiKey.key,
            priority: typeof apiKey.priority === 'number' ? apiKey.priority : 0,
            isActive: apiKey.isActive === false ? 0 : 1
          };
          
          // Check if the key already exists
          const existing = await db.get('SELECT * FROM api_keys WHERE key = ?', [apiKeyToSave.key]);
          
          if (existing) {
            // Update existing key
            await db.run(
              'UPDATE api_keys SET name = ?, priority = ?, is_active = ? WHERE key = ?',
              [apiKeyToSave.name, apiKeyToSave.priority, apiKeyToSave.isActive, apiKeyToSave.key]
            );
          } else {
            // Insert new key
            await db.run(
              'INSERT INTO api_keys (name, key, priority, is_active) VALUES (?, ?, ?, ?)',
              [apiKeyToSave.name, apiKeyToSave.key, apiKeyToSave.priority, apiKeyToSave.isActive]
            );
          }
        }
      }
      
      // Process groups
      if (data.groups && Array.isArray(data.groups)) {
        console.log(`Importing ${data.groups.length} groups`);
        
        for (const group of data.groups) {
          // Insert or replace the group
          await db.run(
            'INSERT OR REPLACE INTO groups (id, name) VALUES (?, ?)',
            [group.id, group.name]
          );
          
          // Process channels from this group
          if (group.channels && Array.isArray(group.channels)) {
            for (const channel of group.channels) {
              // Insert the channel if it doesn't exist
              await db.run(
                'INSERT OR IGNORE INTO channels (id, title, thumbnail_url, description) VALUES (?, ?, ?, ?)',
                [
                  channel.id,
                  channel.title || 'Imported Channel',
                  channel.thumbnailUrl || '',
                  channel.description || ''
                ]
              );
              
              // Create or update the relationship
              await db.run(
                'INSERT OR REPLACE INTO group_channels (group_id, channel_id) VALUES (?, ?)',
                [group.id, channel.id]
              );
            }
          }
        }
      }
      
      // Process individual channels if they exist
      if (data.channels && Array.isArray(data.channels)) {
        console.log(`Importing ${data.channels.length} individual channels`);
        
        for (const channel of data.channels) {
          await db.run(
            'INSERT OR IGNORE INTO channels (id, title, thumbnail_url, description) VALUES (?, ?, ?, ?)',
            [
              channel.id,
              channel.title || 'Imported Channel',
              channel.thumbnailUrl || '',
              channel.description || ''
            ]
          );
        }
      }
      
      // Process group-channel relationships if they exist separately
      if (data.groupChannels && Array.isArray(data.groupChannels)) {
        console.log(`Importing ${data.groupChannels.length} group-channel relationships`);
        
        for (const relation of data.groupChannels) {
          if (relation.groupId && relation.channelId) {
            await db.run(
              'INSERT OR IGNORE INTO group_channels (group_id, channel_id) VALUES (?, ?)',
              [relation.groupId, relation.channelId]
            );
          }
        }
      }
      
      // Commit the transaction
      await db.run('COMMIT');
      
      return NextResponse.json({ success: true, message: 'Data imported successfully' });
    } catch (error) {
      // Rollback in case of error
      await db.run('ROLLBACK');
      console.error('Transaction error:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('Error importing data:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error importing data'
    }, { status: 500 });
  }
}

// Helper function to validate import data
function validateImportData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  // Check if the data has at least one of the expected properties
  return (
    (data.apiKeys && Array.isArray(data.apiKeys)) ||
    (data.groups && Array.isArray(data.groups)) ||
    (data.channels && Array.isArray(data.channels)) ||
    (data.groupChannels && Array.isArray(data.groupChannels))
  );
} 