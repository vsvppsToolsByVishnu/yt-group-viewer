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
    
    // Log the received data structure
    console.log(`Import request received with data structure:`, {
      hasGroups: !!data.groups && Array.isArray(data.groups),
      groupCount: data.groups?.length || 0,
      hasApiKeys: !!data.apiKeys && Array.isArray(data.apiKeys),
      apiKeyCount: data.apiKeys?.length || 0,
      hasChannels: !!data.channels && Array.isArray(data.channels),
      channelCount: data.channels?.length || 0,
      hasGroupChannels: !!data.groupChannels && Array.isArray(data.groupChannels),
      groupChannelsCount: data.groupChannels?.length || 0
    });
    
    // Log the first group's structure if available
    if (data.groups && data.groups.length > 0) {
      const firstGroup = data.groups[0];
      console.log(`First group structure:`, {
        id: firstGroup.id,
        name: firstGroup.name,
        hasParentId: firstGroup.parentId !== undefined,
        parentId: firstGroup.parentId,
        hasSubgroups: !!firstGroup.subgroups && Array.isArray(firstGroup.subgroups),
        subgroupCount: firstGroup.subgroups?.length || 0,
        hasChannels: !!firstGroup.channels && Array.isArray(firstGroup.channels),
        channelCount: firstGroup.channels?.length || 0,
        isExpanded: !!firstGroup.isExpanded
      });
      
      // Examine a couple of examples to check different data formats
      if (firstGroup.channels && firstGroup.channels.length > 0) {
        const channel = firstGroup.channels[0];
        console.log(`Example channel format:`, {
          id: channel.id,
          title: channel.title,
          hasThumbnailUrl: !!channel.thumbnailUrl,
          hasDescription: !!channel.description
        });
      }
      
      // Log a sample subgroup if available
      if (firstGroup.subgroups && firstGroup.subgroups.length > 0) {
        const firstSubgroup = firstGroup.subgroups[0];
        console.log(`First subgroup structure:`, {
          id: firstSubgroup.id,
          name: firstSubgroup.name,
          parentId: firstSubgroup.parentId,
          hasNestedSubgroups: !!firstSubgroup.subgroups && firstSubgroup.subgroups.length > 0,
          nestedSubgroupCount: firstSubgroup.subgroups?.length || 0,
          hasChannels: !!firstSubgroup.channels && Array.isArray(firstSubgroup.channels),
          channelCount: firstSubgroup.channels?.length || 0
        });
      }
    }
    
    // Get direct database connection for transactions
    const db = await getDbConnection();
    
    // Start a transaction
    await db.run('BEGIN TRANSACTION');
    
    // Track imported items
    const importedItems = {
      apiKeys: 0,
      topLevelGroups: 0,
      subgroups: 0,
      channels: 0
    };
    
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
          
          importedItems.apiKeys++;
        }
      }
      
      // Process groups and channels
      if (data.groups && Array.isArray(data.groups)) {
        console.log(`Starting import of ${data.groups.length} groups`);
        
        // Type the group data
        interface ImportGroup {
          id: string;
          name: string;
          parentId?: string;
          isExpanded?: boolean;
          channels?: any[];
          subgroups?: ImportGroup[]; // Add subgroups to the interface
          [key: string]: any;
        }
        
        // Since the client already sent us a hierarchical structure, we'll use it directly
        const topLevelGroups = data.groups as ImportGroup[];
        
        // Verify we received a hierarchical structure
        let containsSubgroups = false;
        topLevelGroups.forEach(group => {
          if (group.subgroups && group.subgroups.length > 0) {
            containsSubgroups = true;
          }
        });
        
        if (containsSubgroups) {
          console.log(`Detected hierarchical structure with subgroups - using direct import`);
        } else {
          console.log(`No subgroups detected in received data - will process as flat list`);
          
          // If we didn't receive a hierarchical structure, build one
          const groupMap = new Map<string, ImportGroup>();
          
          // First create a map of all groups
          topLevelGroups.forEach(group => {
            groupMap.set(group.id, {
              ...group,
              subgroups: []
            });
          });
          
          // Then build the hierarchy
          const newTopLevelGroups: ImportGroup[] = [];
          topLevelGroups.forEach(group => {
            if (group.parentId) {
              const parent = groupMap.get(group.parentId);
              if (parent) {
                if (!parent.subgroups) parent.subgroups = [];
                parent.subgroups.push(groupMap.get(group.id)!);
              } else {
                newTopLevelGroups.push(group);
              }
            } else {
              newTopLevelGroups.push(group);
            }
          });
          
          // Use our rebuilt hierarchy
          if (newTopLevelGroups.length > 0) {
            console.log(`Built hierarchical structure with ${newTopLevelGroups.length} top-level groups`);
            data.groups = newTopLevelGroups;
          }
        }
        
        // Function to recursively import groups and maintain parent-child relationships
        const importGroupWithSubgroups = async (group: ImportGroup, parentId?: string) => {
          try {
            // Log import with parent information
            if (parentId) {
              console.log(`Importing subgroup: ${group.name} (${group.id}) with parent: ${parentId}`);
              importedItems.subgroups++;
            } else {
              console.log(`Importing top-level group: ${group.name} (${group.id})`);
              importedItems.topLevelGroups++;
            }
            
            // Check if group already exists
            const existingGroup = await db.get('SELECT * FROM groups WHERE id = ?', [group.id]);
            
            if (existingGroup) {
              // Update existing group
              console.log(`Updating existing group: ${group.id} (${group.name})`);
              await db.run(
                'UPDATE groups SET name = ?, parent_id = ?, is_expanded = ?, updated_at = ? WHERE id = ?',
                [group.name, parentId || null, group.isExpanded ? 1 : 0, Date.now(), group.id]
              );
            } else {
              // Insert new group
              console.log(`Creating new group: ${group.id} (${group.name}) with parentId=${parentId || 'null'}`);
              await db.run(
                'INSERT INTO groups (id, name, parent_id, is_expanded, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                [group.id, group.name, parentId || null, group.isExpanded ? 1 : 0, Date.now(), Date.now()]
              );
            }
            
            // Process channels for this group (handle the case when channels might be undefined or null)
            const channels = group.channels || [];
            if (channels.length > 0) {
              console.log(`Processing ${channels.length} channels for group ${group.name} (${group.id})`);
              
              // First remove existing channels for the group
              await db.run('DELETE FROM group_channels WHERE group_id = ?', [group.id]);
              
              // Add each channel
              for (const channel of channels) {
                // Skip if no ID
                if (!channel.id) {
                  console.warn(`Skipping channel without ID in group ${group.id}`);
                  continue;
                }
                
                try {
                  // Insert or update channel
                  await db.run(
                    'INSERT OR REPLACE INTO channels (id, title, thumbnail_url, description, updated_at) VALUES (?, ?, ?, ?, ?)',
                    [
                      channel.id, 
                      channel.title || 'Unknown Channel',
                      channel.thumbnailUrl || null,
                      channel.description || null, 
                      Date.now()
                    ]
                  );
                  
                  // Link channel to group
                  await db.run(
                    'INSERT INTO group_channels (group_id, channel_id, added_at) VALUES (?, ?, ?)',
                    [group.id, channel.id, Date.now()]
                  );
                  
                  importedItems.channels++;
                } catch (channelError) {
                  console.error(`Error processing channel ${channel.id} for group ${group.id}:`, channelError);
                }
              }
            } else {
              console.log(`Group ${group.name} (${group.id}) has no channels`);
            }
            
            // Now recursively import all subgroups
            if (group.subgroups && group.subgroups.length > 0) {
              console.log(`Importing ${group.subgroups.length} subgroups of ${group.name} (${group.id})`);
              
              for (const subgroup of group.subgroups) {
                await importGroupWithSubgroups(subgroup, group.id);
              }
            }
          } catch (error) {
            console.error(`Error importing group ${group.id}:`, error);
          }
        };
        
        // Import all top-level groups and their subgroups recursively
        for (const topGroup of topLevelGroups) {
          await importGroupWithSubgroups(topGroup);
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
      
      // Log the final result of the import
      console.log(`====== Group Import Summary ======`);
      console.log(`Imported ${importedItems.topLevelGroups} top-level groups`);
      console.log(`Imported ${importedItems.subgroups} subgroups`);
      
      // Verify the parent-child relationships were maintained
      const verifyParentRelationships = await db.all(`
        SELECT g.id, g.name, g.parent_id, p.name as parent_name
        FROM groups g
        LEFT JOIN groups p ON g.parent_id = p.id
        WHERE g.parent_id IS NOT NULL
      `);
      
      console.log(`Found ${verifyParentRelationships.length} parent-child relationships in database after import:`);
      verifyParentRelationships.forEach((rel: {id: string, name: string, parent_id: string, parent_name: string}) => {
        console.log(`- Subgroup "${rel.name}" (${rel.id}) has parent "${rel.parent_name}" (${rel.parent_id})`);
      });
      
      // Commit the transaction
      await db.run('COMMIT');
      
      return NextResponse.json({ success: true, message: 'Data imported successfully' });
    } catch (error) {
      // Rollback on error
      await db.run('ROLLBACK');
      console.error('Error during import:', error);
      return NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An error occurred during import' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error processing import request:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An error occurred' 
    }, { status: 500 });
  }
}

// Helper function to validate import data
function validateImportData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    console.error("Invalid import data: Data is not an object");
    return false;
  }
  
  // Check if the data has at least one of the expected properties
  const hasValidContent = (
    (data.apiKeys && Array.isArray(data.apiKeys)) ||
    (data.groups && Array.isArray(data.groups)) ||
    (data.channels && Array.isArray(data.channels)) ||
    (data.groupChannels && Array.isArray(data.groupChannels))
  );
  
  if (!hasValidContent) {
    console.error("Invalid import data: Missing required arrays (apiKeys, groups, channels, or groupChannels)");
    return false;
  }
  
  // Validate groups structure if present
  if (data.groups && Array.isArray(data.groups)) {
    // Check that groups have the required properties
    const hasInvalidGroup = data.groups.some((group: any) => {
      if (!group || typeof group !== 'object') {
        console.error("Invalid group: Not an object");
        return true;
      }
      
      if (!group.id || typeof group.id !== 'string') {
        console.error(`Invalid group: Missing or invalid 'id' property: ${JSON.stringify(group)}`);
        return true;
      }
      
      if (!group.name || typeof group.name !== 'string') {
        console.error(`Invalid group: Missing or invalid 'name' property: ${JSON.stringify(group)}`);
        return true;
      }
      
      // Check parentId format (can be undefined, null or string)
      if (group.parentId !== undefined && group.parentId !== null && typeof group.parentId !== 'string') {
        console.error(`Invalid group: 'parentId' must be string, null, or undefined: ${JSON.stringify(group)}`);
        return true;
      }
      
      // Validate channels if present
      if (group.channels !== undefined) {
        if (!Array.isArray(group.channels)) {
          console.error(`Invalid group: 'channels' must be an array: ${JSON.stringify(group)}`);
          return true;
        }
      }
      
      return false; // Group is valid
    });
    
    if (hasInvalidGroup) {
      return false;
    }
  }
  
  return true;
} 