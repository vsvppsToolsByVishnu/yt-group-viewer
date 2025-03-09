import { NextRequest, NextResponse } from 'next/server';
import * as sqliteDB from '../../../app/db/sqliteDB';
import { getDbConnection } from '../../../app/db/sqliteSetup';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { options, selectedGroups } = body;
    
    if (!options || !selectedGroups) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters'
      }, { status: 400 });
    }
    
    // Initialize export data object
    const exportData: any = {};
    
    // Get direct database connection for complex queries
    const db = await getDbConnection();
    
    // Export API keys if selected
    if (options.apiKeys) {
      const apiKeys = await sqliteDB.getAPIKeys();
      exportData.apiKeys = apiKeys;
    }
    
    // Export SQLite sequence if selected
    if (options.sqliteSequence) {
      const sequence = await db.get('SELECT * FROM sqlite_sequence WHERE name = ?', ['api_keys']);
      exportData.sqliteSequence = sequence || { name: 'api_keys', seq: 0 };
    }
    
    // Get the list of selected group IDs
    const selectedGroupIds = Object.entries(selectedGroups)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);
    
    // Export groups if selected
    if (options.groups && selectedGroupIds.length > 0) {
      // Create placeholders for the IN clause
      const placeholders = selectedGroupIds.map(() => '?').join(',');
      const groups = await db.all(
        `SELECT * FROM groups WHERE id IN (${placeholders})`,
        selectedGroupIds
      );
      
      // For each group, get its channels
      for (const group of groups) {
        const channels = await db.all(
          `SELECT c.* 
           FROM channels c
           JOIN group_channels gc ON c.id = gc.channel_id
           WHERE gc.group_id = ?`,
          [group.id]
        );
        
        // Convert channel data to match the expected format
        group.channels = channels.map((c: any) => ({
          id: c.id,
          title: c.title,
          thumbnailUrl: c.thumbnail_url,
          description: c.description
        }));
      }
      
      exportData.groups = groups;
    }
    
    // Export channels if selected
    if (options.channels && selectedGroupIds.length > 0) {
      // Get channels from selected groups
      const placeholders = selectedGroupIds.map(() => '?').join(',');
      const channels = await db.all(
        `SELECT DISTINCT c.* 
         FROM channels c
         JOIN group_channels gc ON c.id = gc.channel_id
         WHERE gc.group_id IN (${placeholders})`,
        selectedGroupIds
      );
      
      // Convert channel data to match the expected format
      exportData.channels = channels.map((c: any) => ({
        id: c.id,
        title: c.title,
        thumbnailUrl: c.thumbnail_url,
        description: c.description
      }));
    }
    
    // Export group-channel relationships if selected
    if (options.groupChannels && selectedGroupIds.length > 0) {
      // Get group-channel relationships for selected groups
      const placeholders = selectedGroupIds.map(() => '?').join(',');
      const groupChannels = await db.all(
        `SELECT group_id, channel_id 
         FROM group_channels
         WHERE group_id IN (${placeholders})`,
        selectedGroupIds
      );
      
      exportData.groupChannels = groupChannels;
    }
    
    return NextResponse.json({ 
      success: true, 
      data: exportData 
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to export data' 
    }, { status: 500 });
  }
} 