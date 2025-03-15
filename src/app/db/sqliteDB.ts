import { getDbConnection } from './sqliteSetup';
import { Group, Channel, APIKey, Video, LinkGroup, Link } from '../types';

// Get the database connection
const db = getDbConnection();

// ==================== Groups ====================

export const getGroups = async (): Promise<Group[]> => {
  const db = await getDbConnection();
  
  try {
    // Get all groups with their hierarchical info
    const groups = await db.all(`
      SELECT g.*, 
             (SELECT COUNT(*) FROM groups WHERE parent_id = g.id) as subgroup_count,
             (SELECT COUNT(*) FROM group_channels WHERE group_id = g.id) as channel_count
      FROM groups g
      ORDER BY g.name
    `);
    
    // Get channels for each group
    const result: Group[] = await Promise.all(
      groups.map(async (group: any) => {
        const channels = await db.all(`
          SELECT c.* 
          FROM channels c
          JOIN group_channels gc ON c.id = gc.channel_id
          WHERE gc.group_id = ?
        `, [group.id]);
        
        return {
          id: group.id,
          name: group.name,
          channels: channels.map((c: any) => ({
            id: c.id,
            title: c.title,
            thumbnailUrl: c.thumbnail_url,
            description: c.description
          })),
          parentId: group.parent_id || undefined,
          isExpanded: group.is_expanded === 1,
          subgroupCount: group.subgroup_count,
          channelCount: group.channel_count,
          createdAt: group.created_at,
          updatedAt: group.updated_at
        };
      })
    );
    
    // Important: Log all groups to debug
    console.log(`Retrieved ${result.length} groups from database`, 
      result.map(g => ({id: g.id, name: g.name, parentId: g.parentId, isExpanded: g.isExpanded})));
    
    return result;
  } catch (error) {
    console.error('Error getting groups:', error);
    throw error;
  }
};

export const getGroupHierarchy = async (): Promise<Group[]> => {
  const db = await getDbConnection();
  
  try {
    // Get all groups
    const allGroups = await getGroups();
    
    // Build the hierarchy
    const buildHierarchy = (parentId: string | null | undefined): Group[] => {
      return allGroups
        .filter(g => g.parentId === parentId)
        .map(group => ({
          ...group,
          subgroups: buildHierarchy(group.id)
        }));
    };
    
    // Get top-level groups (with no parent)
    return buildHierarchy(null);
  } catch (error) {
    console.error('Error getting group hierarchy:', error);
    throw error;
  }
};

export const getGroup = async (id: string): Promise<Group | null> => {
  const db = await getDbConnection();
  
  try {
    // Get the group with counts
    const group = await db.get(`
      SELECT g.*, 
             (SELECT COUNT(*) FROM groups WHERE parent_id = g.id) as subgroup_count,
             (SELECT COUNT(*) FROM group_channels WHERE group_id = g.id) as channel_count
      FROM groups g
      WHERE g.id = ?
    `, [id]);
    
    if (!group) return null;
    
    // Get channels for the group
    const channels = await db.all(`
      SELECT c.* 
      FROM channels c
      JOIN group_channels gc ON c.id = gc.channel_id
      WHERE gc.group_id = ?
    `, [id]);
    
    // Get direct subgroups
    const subgroups = await db.all(`
      SELECT g.*, 
             (SELECT COUNT(*) FROM groups WHERE parent_id = g.id) as subgroup_count,
             (SELECT COUNT(*) FROM group_channels WHERE group_id = g.id) as channel_count
      FROM groups g
      WHERE g.parent_id = ?
      ORDER BY g.name
    `, [id]);
    
    // Get channels for each subgroup
    const populatedSubgroups = await Promise.all(
      subgroups.map(async (sg: any) => {
        const subgroupChannels = await db.all(`
          SELECT c.* 
          FROM channels c
          JOIN group_channels gc ON c.id = gc.channel_id
          WHERE gc.group_id = ?
        `, [sg.id]);
        
        return {
          id: sg.id,
          name: sg.name,
          channels: subgroupChannels.map((c: any) => ({
            id: c.id,
            title: c.title,
            thumbnailUrl: c.thumbnail_url,
            description: c.description
          })),
          parentId: sg.parent_id,
          isExpanded: sg.is_expanded === 1,
          subgroupCount: sg.subgroup_count,
          channelCount: sg.channel_count,
          createdAt: sg.created_at,
          updatedAt: sg.updated_at
        };
      })
    );
    
    return {
      id: group.id,
      name: group.name,
      channels: channels.map((c: any) => ({
        id: c.id,
        title: c.title,
        thumbnailUrl: c.thumbnail_url,
        description: c.description
      })),
      parentId: group.parent_id || undefined,
      isExpanded: group.is_expanded === 1,
      subgroups: populatedSubgroups,
      subgroupCount: group.subgroup_count,
      channelCount: group.channel_count,
      createdAt: group.created_at,
      updatedAt: group.updated_at
    };
  } catch (error) {
    console.error(`Error getting group ${id}:`, error);
    throw error;
  }
};

export const getGroupWithSubtree = async (id: string): Promise<Group | null> => {
  const db = await getDbConnection();
  
  try {
    // First get the basic group info
    const rootGroup = await getGroup(id);
    if (!rootGroup) return null;
    
    // Recursive function to build the full subtree
    const buildSubtree = async (groupId: string): Promise<Group> => {
      const group = await getGroup(groupId);
      if (!group) throw new Error(`Group not found: ${groupId}`);
      
      // If the group has subgroups, populate them recursively
      if (group.subgroups && group.subgroups.length > 0) {
        const populatedSubgroups = await Promise.all(
          group.subgroups.map(sg => buildSubtree(sg.id))
        );
        return { ...group, subgroups: populatedSubgroups };
      }
      
      return group;
    };
    
    // Build the complete subtree
    return await buildSubtree(id);
  } catch (error) {
    console.error(`Error getting group subtree for ${id}:`, error);
    throw error;
  }
};

// Helper function to check and reset transaction state if needed
async function ensureNoActiveTransaction(db: any): Promise<void> {
  try {
    // Check if a transaction is active
    const inTransaction = await db.get('PRAGMA in_transaction');
    
    if (inTransaction && inTransaction.in_transaction === 1) {
      console.warn('Found stale transaction - attempting to roll back');
      try {
        await db.run('ROLLBACK');
        console.log('Successfully rolled back stale transaction');
      } catch (error) {
        console.error('Error rolling back stale transaction:', error);
      }
    }
  } catch (error) {
    console.error('Error checking transaction state:', error);
  }
}

export const saveGroup = async (group: Group, inTransaction = false): Promise<string> => {
  const db = await getDbConnection();
  let startedTransaction = false;
  
  try {
    // Debug logging for parentId
    if (group.parentId === undefined) {
      console.log(`[sqliteDB] Saving top-level group ${group.id} (${group.name}) - parentId is undefined`);
    } else if (group.parentId === null) {
      console.log(`[sqliteDB] Warning: Group ${group.id} (${group.name}) has null parentId - treating as top-level`);
      group.parentId = undefined; // Convert null to undefined for consistency
    } else {
      console.log(`[sqliteDB] Saving subgroup ${group.id} (${group.name}) with parent ${group.parentId}`);
      
      // Verify the parent exists
      const parentExists = await db.get('SELECT id FROM groups WHERE id = ?', [group.parentId]);
      if (!parentExists) {
        console.warn(`[sqliteDB] Parent group ${group.parentId} does not exist for subgroup ${group.id}. Creating as top-level group.`);
        group.parentId = undefined; // Make it a top-level group
      }
    }
    
    // Check for and fix stale transactions
    if (!inTransaction) {
      await ensureNoActiveTransaction(db);
    }
    
    console.log(`[sqliteDB] Saving group ${group.id} (${group.name}), parentId: ${group.parentId || 'none'}, isExpanded: ${group.isExpanded}`);
    
    // Only start a transaction if we're not already in one
    if (!inTransaction) {
      await db.run('BEGIN TRANSACTION');
      startedTransaction = true;
      console.log(`[sqliteDB] Started transaction for group ${group.id}`);
    }
    
    // Fetch all existing subgroups for this group before any modifications
    // This is critical for preserving the group's structure
    const existingSubgroupRows = await db.all('SELECT * FROM groups WHERE parent_id = ?', [group.id]);
    let existingSubgroups: Group[] = [];
    
    if (existingSubgroupRows.length > 0) {
      console.log(`[sqliteDB] Found ${existingSubgroupRows.length} existing subgroups of ${group.id}`);
      
      // Get each subgroup with its channels
      existingSubgroups = await Promise.all(
        existingSubgroupRows.map(async (sg: any) => {
          const channels = await db.all(`
            SELECT c.* 
            FROM channels c
            JOIN group_channels gc ON c.id = gc.channel_id
            WHERE gc.group_id = ?
          `, [sg.id]);
          
          return {
            id: sg.id,
            name: sg.name,
            channels: channels.map((c: any) => ({
              id: c.id,
              title: c.title,
              thumbnailUrl: c.thumbnail_url,
              description: c.description
            })),
            parentId: group.id, // Ensure parent ID is correctly set
            isExpanded: sg.is_expanded === 1
          };
        })
      );
      
      console.log(`[sqliteDB] Loaded details for ${existingSubgroups.length} existing subgroups`);
    }
    
    // Check if this is an update to an existing group
    const existingGroup = await db.get('SELECT id, parent_id, is_expanded FROM groups WHERE id = ?', [group.id]);
    
    // Log what's happening
    if (existingGroup) {
      console.log(`[sqliteDB] Updating existing group ${group.id}: current parentId=${existingGroup.parent_id}, new parentId=${group.parentId}, current isExpanded=${existingGroup.is_expanded}, new isExpanded=${group.isExpanded}`);
    } else {
      console.log(`[sqliteDB] Creating new group ${group.id}`);
    }
    
    // Insert or replace the group - EXPLICITLY HANDLE parentId
    await db.run(
      'INSERT OR REPLACE INTO groups (id, name, parent_id, is_expanded, updated_at) VALUES (?, ?, ?, ?, ?)',
      [
        group.id, 
        group.name, 
        group.parentId || null, // Convert undefined to null for database
        group.isExpanded ? 1 : 0,
        Date.now() // Update the timestamp
      ]
    );
    
    // Verify the save worked correctly - for debugging only
    const savedGroup = await db.get('SELECT id, name, parent_id, is_expanded FROM groups WHERE id = ?', [group.id]);
    console.log(`[sqliteDB] Verification - group ${group.id} saved with parentId=${savedGroup.parent_id}, isExpanded=${savedGroup.is_expanded}`);
    
    // Save channels if they exist
    if (group.channels && group.channels.length > 0) {
      // First delete existing channel associations
      await db.run('DELETE FROM group_channels WHERE group_id = ?', [group.id]);
      
      // Add each channel
      for (const channel of group.channels) {
        // Ensure the channel exists
        await db.run(
          'INSERT OR IGNORE INTO channels (id, title, thumbnail_url, description, updated_at) VALUES (?, ?, ?, ?, ?)',
          [channel.id, channel.title, channel.thumbnailUrl, channel.description || null, Date.now()]
        );
        
        // Create the group-channel association
        await db.run(
          'INSERT INTO group_channels (group_id, channel_id, added_at) VALUES (?, ?, ?)',
          [group.id, channel.id, Date.now()]
        );
      }
    }
    
    // Handle subgroups using a hybrid approach that works with multiple import methods
    
    // First, explicitly handle provided subgroups (from hierarchical import)
    if (group.subgroups && group.subgroups.length > 0) {
      console.log(`[sqliteDB] Processing ${group.subgroups.length} explicit subgroups for ${group.id}`);
      for (const subgroup of group.subgroups) {
        // Ensure each subgroup has this group as its parent
        const updatedSubgroup = {
          ...subgroup,
          parentId: group.id
        };
        
        console.log(`[sqliteDB] Saving explicit subgroup ${subgroup.id} (${subgroup.name}) with parent ${group.id}`);
        await saveGroup(updatedSubgroup, true);
      }
    }
    
    // Now ensure all existing subgroups are preserved, unless they were explicitly replaced
    // This handles the case where a group is toggled between expanded/collapsed
    if (existingSubgroups.length > 0) {
      console.log(`[sqliteDB] Checking ${existingSubgroups.length} existing subgroups for preservation`);
      
      for (const subgroup of existingSubgroups) {
        // Only save if it wasn't already saved as part of the explicit subgroups
        const alreadySaved = group.subgroups?.some(sg => sg.id === subgroup.id);
        if (!alreadySaved) {
          console.log(`[sqliteDB] Preserving existing subgroup ${subgroup.id} (${subgroup.name}) that wasn't in explicit subgroups`);
          await saveGroup(subgroup, true);
        }
      }
    }
    
    // Commit the transaction only if we started it
    if (startedTransaction) {
      await db.run('COMMIT');
      console.log(`[sqliteDB] Committed transaction for group ${group.id}`);
      
      // Final verification
      const finalCheck = await db.get('SELECT id, name, parent_id, is_expanded FROM groups WHERE id = ?', [group.id]);
      console.log(`[sqliteDB] Final verification - group ${group.id} has parentId=${finalCheck.parent_id}, isExpanded=${finalCheck.is_expanded}`);
      
      // Check subgroups after save
      const finalSubgroups = await db.all('SELECT id, name, parent_id FROM groups WHERE parent_id = ?', [group.id]);
      console.log(`[sqliteDB] Final verification - group ${group.id} has ${finalSubgroups.length} subgroups after save`);
      
      // Verify all expected subgroups are present
      const expectedSubgroupCount = (group.subgroups?.length || 0) + existingSubgroups.filter(sg => !group.subgroups?.some(s => s.id === sg.id)).length;
      if (finalSubgroups.length !== expectedSubgroupCount) {
        console.warn(`[sqliteDB] WARNING: Subgroup count mismatch - expected ${expectedSubgroupCount} but found ${finalSubgroups.length}`);
      }
    }
    
    console.log(`[sqliteDB] Group ${group.id} saved successfully`);
    return group.id;
  } catch (error) {
    // Rollback only if we started the transaction
    if (startedTransaction) {
      try {
        await db.run('ROLLBACK');
        console.log(`[sqliteDB] Rolled back transaction for group ${group.id}`);
      } catch (rollbackError) {
        console.error(`[sqliteDB] Error rolling back transaction for group ${group.id}:`, rollbackError);
      }
    }
    
    console.error(`[sqliteDB] Error saving group ${group.id}:`, error);
    // Log the group object for debugging, but sanitize it to avoid circular references
    console.error(`[sqliteDB] Group object was:`, JSON.stringify({
      id: group.id,
      name: group.name,
      parentId: group.parentId,
      hasChannels: group.channels && group.channels.length > 0,
      hasSubgroups: group.subgroups && group.subgroups.length > 0,
      isExpanded: group.isExpanded
    }));
    throw error;
  }
};

export const deleteGroup = async (id: string, inTransaction = false): Promise<void> => {
  const db = await getDbConnection();
  let startedTransaction = false;
  
  try {
    // Check for and fix stale transactions
    if (!inTransaction) {
      await ensureNoActiveTransaction(db);
    }
    
    // Only start a transaction if we're not already in one
    if (!inTransaction) {
      await db.run('BEGIN TRANSACTION');
      startedTransaction = true;
      console.log(`[sqliteDB] Started delete transaction for group ${id}`);
    }
    
    // Get all subgroups recursively
    const getAllSubgroupIds = async (groupId: string): Promise<string[]> => {
      const subgroups = await db.all('SELECT id FROM groups WHERE parent_id = ?', [groupId]);
      let ids: string[] = subgroups.map((g: any) => g.id);
      
      for (const sg of subgroups) {
        const childIds = await getAllSubgroupIds(sg.id);
        ids = [...ids, ...childIds];
      }
      
      return ids;
    };
    
    // Get all subgroup IDs
    const subgroupIds = await getAllSubgroupIds(id);
    const allGroupsToDelete = [id, ...subgroupIds];
    
    console.log(`[sqliteDB] Deleting group ${id} and ${subgroupIds.length} subgroups`);
    
    // First, get all channels associated with these groups to delete their videos later if needed
    const channelIds = new Set<string>();
    for (const groupId of allGroupsToDelete) {
      const channels = await db.all(
        'SELECT channel_id FROM group_channels WHERE group_id = ?', 
        [groupId]
      );
      
      channels.forEach((c: any) => channelIds.add(c.channel_id));
    }
    
    console.log(`[sqliteDB] Found ${channelIds.size} unique channels associated with the deleted groups`);
    
    // For each group, delete associated data first to avoid foreign key issues
    for (const groupId of allGroupsToDelete) {
      // Delete group-channel associations
      await db.run('DELETE FROM group_channels WHERE group_id = ?', [groupId]);
      
      // Delete any cached data related to this group
      await db.run("DELETE FROM cache WHERE key LIKE ? AND type = 'group'", [`%${groupId}%`]);
      
      // Delete the group itself
      await db.run('DELETE FROM groups WHERE id = ?', [groupId]);
      
      console.log(`[sqliteDB] Deleted group ${groupId} and its direct associations`);
    }
    
    // Clear any groups cache
    await db.run("DELETE FROM cache WHERE type = 'groups'");
    await db.run("DELETE FROM cache WHERE type = 'hierarchies'");
    
    // Check if any remaining channels are orphaned (not associated with any group)
    // and delete them along with their videos if they are
    for (const channelId of channelIds) {
      const groupCount = await db.get(
        'SELECT COUNT(*) as count FROM group_channels WHERE channel_id = ?', 
        [channelId]
      );
      
      if (groupCount.count === 0) {
        console.log(`[sqliteDB] Channel ${channelId} is now orphaned, deleting its videos`);
        
        // Delete videos for this channel
        await db.run('DELETE FROM videos WHERE channel_id = ?', [channelId]);
        
        // Delete the channel itself
        await db.run('DELETE FROM channels WHERE id = ?', [channelId]);
      }
    }
    
    // Commit the transaction only if we started it
    if (startedTransaction) {
      await db.run('COMMIT');
      console.log(`[sqliteDB] Committed delete transaction for group ${id}`);
    }
    
    console.log(`[sqliteDB] Group ${id} and all subgroups deleted successfully with all related data`);
  } catch (error) {
    // Rollback only if we started the transaction
    if (startedTransaction) {
      try {
        await db.run('ROLLBACK');
        console.log(`[sqliteDB] Rolled back delete transaction for group ${id}`);
      } catch (rollbackError) {
        console.error(`[sqliteDB] Error rolling back delete transaction for group ${id}:`, rollbackError);
      }
    }
    
    console.error(`[sqliteDB] Error deleting group ${id}:`, error);
    throw error;
  }
};

// ==================== API Keys ====================

export const getAPIKeys = async (): Promise<APIKey[]> => {
  const db = await getDbConnection();
  
  try {
    const keys = await db.all('SELECT * FROM api_keys ORDER BY priority');
    
    return keys.map((key: any) => ({
      id: key.id.toString(),
      name: key.name,
      key: key.key,
      priority: key.priority,
      isActive: key.is_active === 1
    }));
  } catch (error) {
    console.error('Error getting API keys:', error);
    throw error;
  }
};

export const saveAPIKey = async (apiKey: APIKey): Promise<string> => {
  const db = await getDbConnection();
  
  try {
    if (apiKey.id) {
      // Update existing key
      await db.run(
        'UPDATE api_keys SET name = ?, key = ?, priority = ?, is_active = ? WHERE id = ?',
        [apiKey.name, apiKey.key, apiKey.priority, apiKey.isActive ? 1 : 0, apiKey.id]
      );
      return apiKey.id;
    } else {
      // Insert new key
      const result = await db.run(
        'INSERT INTO api_keys (name, key, priority, is_active) VALUES (?, ?, ?, ?)',
        [apiKey.name, apiKey.key, apiKey.priority, apiKey.isActive ? 1 : 0]
      );
      return result.lastID.toString();
    }
  } catch (error) {
    console.error('Error saving API key:', error);
    throw error;
  }
};

export const updateAPIKeyPriorities = async (orderedKeys: APIKey[]): Promise<void> => {
  const db = await getDbConnection();
  
  try {
    await db.run('BEGIN TRANSACTION');
    
    for (let i = 0; i < orderedKeys.length; i++) {
      await db.run(
        'UPDATE api_keys SET priority = ? WHERE id = ?',
        [i, orderedKeys[i].id]
      );
    }
    
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Error updating API key priorities:', error);
    throw error;
  }
};

export const deleteAPIKey = async (id: string): Promise<void> => {
  const db = await getDbConnection();
  
  try {
    await db.run('DELETE FROM api_keys WHERE id = ?', [id]);
  } catch (error) {
    console.error(`Error deleting API key ${id}:`, error);
    throw error;
  }
};

export const getWorkingAPIKey = async (): Promise<string | null> => {
  const db = await getDbConnection();
  
  try {
    const apiKey = await db.get(
      'SELECT key FROM api_keys WHERE is_active = 1 ORDER BY priority LIMIT 1'
    );
    
    return apiKey ? apiKey.key : null;
  } catch (error) {
    console.error('Error getting working API key:', error);
    throw error;
  }
};

// ==================== Cache ====================

export const getCacheEntry = async <T>(key: string, type: string): Promise<T | null> => {
  const db = await getDbConnection();
  
  try {
    const entry = await db.get(
      'SELECT * FROM cache WHERE key = ? AND type = ?',
      [key, type]
    );
    
    if (!entry) return null;
    
    // Check if the entry is expired (older than 1 hour)
    const now = Date.now();
    if (now - entry.timestamp > 60 * 60 * 1000) {
      // Entry is expired, delete it
      await db.run('DELETE FROM cache WHERE key = ? AND type = ?', [key, type]);
      return null;
    }
    
    return JSON.parse(entry.data);
  } catch (error) {
    console.error(`Error getting cache entry for ${key}:`, error);
    return null;
  }
};

export const setCacheEntry = async <T>(key: string, data: T, type: string): Promise<void> => {
  const db = await getDbConnection();
  
  try {
    await db.run(
      'INSERT OR REPLACE INTO cache (key, data, type, timestamp) VALUES (?, ?, ?, ?)',
      [key, JSON.stringify(data), type, Date.now()]
    );
  } catch (error) {
    console.error(`Error setting cache entry for ${key}:`, error);
  }
};

export const clearCache = async (type?: string): Promise<void> => {
  const db = await getDbConnection();
  
  try {
    console.log(`[sqliteDB] Clearing cache ${type ? 'for type: ' + type : 'for all types'}`);
    
    if (type) {
      await db.run('DELETE FROM cache WHERE type = ?', [type]);
      console.log(`[sqliteDB] Cleared cache for type: ${type}`);
    } else {
      // Count the entries before deletion for logging
      const countResult = await db.get('SELECT COUNT(*) as count FROM cache');
      const count = countResult?.count || 0;
      
      // Delete all cache entries
      await db.run('DELETE FROM cache');
      console.log(`[sqliteDB] Cleared all cache entries (${count} entries removed)`);
    }
  } catch (error) {
    console.error('[sqliteDB] Error clearing cache:', error);
    throw error; // Re-throw to allow proper error handling upstream
  }
};

// ==================== Videos ====================

export const saveVideos = async (videos: Video[]): Promise<void> => {
  if (!videos || videos.length === 0) return;
  
  const db = await getDbConnection();
  
  try {
    // Start a transaction to ensure all inserts are atomic
    await db.run('BEGIN TRANSACTION');
    
    // Prepare the statement for inserting videos
    const insertStmt = await db.prepare(`
      INSERT OR REPLACE INTO videos (
        id, title, thumbnail_url, channel_id, channel_title, published_at, view_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Insert each video
    for (const video of videos) {
      await insertStmt.run([
        video.id,
        video.title,
        // Ensure we're saving the highest quality thumbnail URL
        video.thumbnailUrl,
        video.channelId,
        video.channelTitle,
        video.publishedAt,
        video.viewCount
      ]);
    }
    
    // Finalize the statement
    await insertStmt.finalize();
    
    // Commit the transaction
    await db.run('COMMIT');
    
    console.log(`Saved ${videos.length} videos to the database`);
  } catch (error) {
    // Rollback in case of error
    try {
      await db.run('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }
    
    console.error('Error saving videos:', error);
    throw error;
  }
};

export const getVideosForChannel = async (channelId: string, limit: number = 50): Promise<Video[]> => {
  const db = await getDbConnection();
  
  try {
    const videos = await db.all(
      `SELECT * FROM videos 
       WHERE channel_id = ? 
       ORDER BY published_at DESC 
       LIMIT ?`,
      [channelId, limit]
    );
    
    return videos.map((v: any) => ({
      id: v.id,
      title: v.title,
      thumbnailUrl: v.thumbnail_url,
      channelId: v.channel_id,
      channelTitle: v.channel_title,
      publishedAt: v.published_at,
      viewCount: v.view_count
    }));
  } catch (error) {
    console.error(`Error getting videos for channel ${channelId}:`, error);
    return [];
  }
};

export const getVideosForChannels = async (channelIds: string[], limit: number = 50): Promise<Video[]> => {
  if (!channelIds.length) return [];
  
  const db = await getDbConnection();
  
  try {
    // SQLite doesn't support array parameters, so we need to build a parameterized query
    const placeholders = channelIds.map(() => '?').join(',');
    
    const videos = await db.all(
      `SELECT * FROM videos 
       WHERE channel_id IN (${placeholders}) 
       ORDER BY published_at DESC 
       LIMIT ?`,
      [...channelIds, limit]
    );
    
    return videos.map((v: any) => ({
      id: v.id,
      title: v.title,
      thumbnailUrl: v.thumbnail_url,
      channelId: v.channel_id,
      channelTitle: v.channel_title,
      publishedAt: v.published_at,
      viewCount: v.view_count
    }));
  } catch (error) {
    console.error(`Error getting videos for channels:`, error);
    return [];
  }
};

export const deleteVideosForChannel = async (channelId: string): Promise<void> => {
  const db = await getDbConnection();
  
  try {
    // Delete all videos for the specified channel
    await db.run('DELETE FROM videos WHERE channel_id = ?', [channelId]);
    console.log(`Deleted all videos for channel: ${channelId}`);
  } catch (error) {
    console.error(`Error deleting videos for channel ${channelId}:`, error);
    throw error;
  }
};

export const deleteChannel = async (channelId: string): Promise<void> => {
  const db = await getDbConnection();
  
  try {
    // Start transaction for data consistency
    await db.run('BEGIN TRANSACTION');
    
    // First delete all group-channel relationships for this channel
    await db.run('DELETE FROM group_channels WHERE channel_id = ?', [channelId]);
    
    // Then delete the channel itself
    await db.run('DELETE FROM channels WHERE id = ?', [channelId]);
    
    // Videos should be deleted automatically due to foreign key constraints,
    // but we'll delete them explicitly to be sure
    await db.run('DELETE FROM videos WHERE channel_id = ?', [channelId]);
    
    // Commit the transaction
    await db.run('COMMIT');
    
    console.log(`Channel ${channelId} deleted successfully`);
  } catch (error) {
    // Rollback on error
    await db.run('ROLLBACK');
    console.error(`Error deleting channel ${channelId}:`, error);
    throw error;
  }
};

// Link Groups
export const getLinkGroups = async (): Promise<LinkGroup[]> => {
  console.log('[sqliteDB] Getting all link groups');
  const db = await getDbConnection();
  
  try {
    // Get all link groups
    const linkGroups = await db.all('SELECT * FROM link_groups ORDER BY name');
    console.log(`[sqliteDB] Retrieved ${linkGroups.length} link groups from database`);
    
    // Get all links for each group
    const result: LinkGroup[] = [];
    for (const group of linkGroups) {
      const links = await db.all(`
        SELECT l.* FROM links l
        JOIN link_group_links gl ON l.id = gl.link_id
        WHERE gl.group_id = ?
      `, [group.id]);
      
      const linkGroup: LinkGroup = {
        id: group.id,
        name: group.name,
        parentId: group.parent_id,
        isExpanded: group.is_expanded === 1,
        links: links.map((link: any) => ({
          id: link.id,
          title: link.title,
          url: link.url,
          description: link.description,
          icon: link.icon,
          createdAt: link.created_at,
          updatedAt: link.updated_at
        })),
        createdAt: group.created_at,
        updatedAt: group.updated_at
      };
      
      result.push(linkGroup);
    }
    
    console.log(`[sqliteDB] Processed ${result.length} link groups with their links`);
    return result;
  } catch (error) {
    console.error('[sqliteDB] Error getting link groups:', error);
    return [];
  }
};

export const getLinkGroup = async (id: string): Promise<LinkGroup | null> => {
  console.log(`[sqliteDB] Getting link group with ID: ${id}`);
  const db = await getDbConnection();
  
  try {
    // Get the group
    const group = await db.get('SELECT * FROM link_groups WHERE id = ?', [id]);
    
    if (!group) {
      console.log(`[sqliteDB] Link group with ID ${id} not found`);
      return null;
    }
    
    // Get links for the group
    const links = await db.all(`
      SELECT l.* FROM links l
      JOIN link_group_links gl ON l.id = gl.link_id
      WHERE gl.group_id = ?
    `, [id]);
    
    // Convert snake_case to camelCase
    const linkGroup: LinkGroup = {
      id: group.id,
      name: group.name,
      parentId: group.parent_id,
      isExpanded: group.is_expanded === 1,
      links: links.map((link: any) => ({
        ...link,
        createdAt: link.created_at,
        updatedAt: link.updated_at
      })),
      createdAt: group.created_at,
      updatedAt: group.updated_at
    };
    
    return linkGroup;
  } catch (error) {
    console.error(`[sqliteDB] Error getting link group with ID ${id}:`, error);
    return null;
  }
};

export const saveLinkGroup = async (group: LinkGroup): Promise<string> => {
  console.log(`[sqliteDB] Saving link group: ${group.name} (${group.id || 'new'})`);
  const db = await getDbConnection();
  
  let transaction = null;
  try {
    // Start a transaction
    transaction = await db.run('BEGIN TRANSACTION');
    
    const now = Date.now();
    const groupId = group.id || `lg_${now}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Check if this is a top-level group or a subgroup
    if (group.parentId) {
      console.log(`[sqliteDB] This is a subgroup with parent ID: ${group.parentId}`);
      
      // Verify parent exists
      const parentExists = await db.get('SELECT id FROM link_groups WHERE id = ?', [group.parentId]);
      if (!parentExists) {
        console.warn(`[sqliteDB] Parent group ${group.parentId} does not exist, treating as top-level group`);
        group.parentId = undefined;
      }
    } else {
      console.log('[sqliteDB] This is a top-level group');
    }
    
    // Check if the group already exists
    const existingGroup = await db.get('SELECT * FROM link_groups WHERE id = ?', [groupId]);
    
    if (existingGroup) {
      console.log(`[sqliteDB] Updating existing link group: ${groupId}`);
      
      // Update the group
      await db.run(`
        UPDATE link_groups
        SET name = ?, parent_id = ?, is_expanded = ?, updated_at = ?
        WHERE id = ?
      `, [
        group.name,
        group.parentId || null,
        group.isExpanded ? 1 : 0,
        now,
        groupId
      ]);
    } else {
      console.log(`[sqliteDB] Creating new link group: ${groupId}`);
      
      // Insert the new group
      await db.run(`
        INSERT INTO link_groups (id, name, parent_id, is_expanded, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        groupId,
        group.name,
        group.parentId || null,
        group.isExpanded ? 1 : 0,
        now,
        now
      ]);
    }
    
    // Handle links
    if (group.links && group.links.length > 0) {
      console.log(`[sqliteDB] Processing ${group.links.length} links for group ${groupId}`);
      
      // Delete existing link associations
      await db.run('DELETE FROM link_group_links WHERE group_id = ?', [groupId]);
      
      // Insert or update each link
      for (const link of group.links) {
        const linkId = link.id || `link_${now}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Check if the link already exists
        const existingLink = await db.get('SELECT id FROM links WHERE id = ?', [linkId]);
        
        if (existingLink) {
          console.log(`[sqliteDB] Updating existing link: ${linkId}`);
          
          // Update the link
          await db.run(`
            UPDATE links
            SET title = ?, url = ?, description = ?, icon = ?, updated_at = ?
            WHERE id = ?
          `, [
            link.title,
            link.url,
            link.description || null,
            link.icon || null,
            now,
            linkId
          ]);
        } else {
          console.log(`[sqliteDB] Creating new link: ${linkId}`);
          
          // Insert the new link
          await db.run(`
            INSERT INTO links (id, title, url, description, icon, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            linkId,
            link.title,
            link.url,
            link.description || null,
            link.icon || null,
            now,
            now
          ]);
        }
        
        // Create the association between the group and the link
        await db.run(`
          INSERT INTO link_group_links (group_id, link_id)
          VALUES (?, ?)
        `, [groupId, linkId]);
      }
    }
    
    // Handle subgroups if they exist
    if (group.subgroups && group.subgroups.length > 0) {
      console.log(`[sqliteDB] Processing ${group.subgroups.length} subgroups for group ${groupId}`);
      
      for (const subgroup of group.subgroups) {
        // Set the parent ID to this group
        subgroup.parentId = groupId;
        
        // Recursively save the subgroup
        await saveLinkGroup(subgroup);
      }
    }
    
    // Commit the transaction
    await db.run('COMMIT');
    console.log(`[sqliteDB] Link group saved successfully: ${groupId}`);
    
    // Verify the save
    const savedGroup = await getLinkGroup(groupId);
    if (!savedGroup) {
      throw new Error(`Failed to verify saved group: ${groupId}`);
    }
    
    return groupId;
  } catch (error) {
    // Rollback the transaction if there was an error
    if (transaction) {
      try {
        await db.run('ROLLBACK');
        console.log('[sqliteDB] Transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('[sqliteDB] Error rolling back transaction:', rollbackError);
      }
    }
    
    console.error('[sqliteDB] Error saving link group:', error);
    throw error;
  }
};

export const deleteLinkGroup = async (id: string): Promise<void> => {
  console.log(`[sqliteDB] Deleting link group with ID: ${id}`);
  const db = await getDbConnection();
  
  let transaction = null;
  try {
    // Start a transaction
    transaction = await db.run('BEGIN TRANSACTION');
    
    // Get all subgroups recursively
    const getAllSubgroupIds = async (groupId: string): Promise<string[]> => {
      const subgroups = await db.all('SELECT id FROM link_groups WHERE parent_id = ?', [groupId]);
      let ids = [groupId];
      
      for (const subgroup of subgroups) {
        const subgroupIds = await getAllSubgroupIds(subgroup.id);
        ids = [...ids, ...subgroupIds];
      }
      
      return ids;
    };
    
    // Get all group IDs to delete (the specified group and all its subgroups)
    const groupIds = await getAllSubgroupIds(id);
    console.log(`[sqliteDB] Deleting link group ${id} and ${groupIds.length - 1} subgroups`);
    
    // For each group, first handle the links and then delete the group
    for (const groupId of groupIds) {
      // First get all links associated with this group
      const links = await db.all('SELECT link_id FROM link_group_links WHERE group_id = ?', [groupId]);
      const linkIds = links.map((l: { link_id: string }) => l.link_id);
      
      // Delete the link associations from the link_group_links table
      await db.run('DELETE FROM link_group_links WHERE group_id = ?', [groupId]);
      console.log(`[sqliteDB] Deleted all link associations for group ${groupId}`);
      
      // Check for orphaned links and delete them
      for (const linkId of linkIds) {
        const linkAssociations = await db.get(
          'SELECT COUNT(*) as count FROM link_group_links WHERE link_id = ?',
          [linkId]
        );
        
        // If the link is not associated with any other groups, delete it from the links table
        if (linkAssociations.count === 0) {
          await db.run('DELETE FROM links WHERE id = ?', [linkId]);
          console.log(`[sqliteDB] Deleted orphaned link ${linkId}`);
        }
      }
      
      // Delete the group itself
      await db.run('DELETE FROM link_groups WHERE id = ?', [groupId]);
      console.log(`[sqliteDB] Deleted group ${groupId}`);
    }
    
    // Commit the transaction
    await db.run('COMMIT');
    console.log(`[sqliteDB] Successfully deleted link group ${id} with all subgroups and links`);
  } catch (error) {
    // Rollback the transaction in case of error
    if (transaction) {
      try {
        await db.run('ROLLBACK');
        console.log('[sqliteDB] Transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('[sqliteDB] Error rolling back transaction:', rollbackError);
      }
    }
    console.error('[sqliteDB] Error deleting link group:', error);
    throw error;
  }
};

export const getLinkGroupHierarchy = async (): Promise<LinkGroup[]> => {
  console.log('[sqliteDB] Getting link group hierarchy');
  const db = await getDbConnection();
  
  try {
    // Get all groups
    const allGroups = await getLinkGroups();
    console.log(`[sqliteDB] Retrieved ${allGroups.length} link groups for hierarchy:`);
    allGroups.forEach(group => {
      console.log(`- Group: ${group.name} (${group.id}), parentId: ${group.parentId || 'none'}`);
    });
    
    // Create a map of groups by ID for quick lookup
    const groupMap = new Map<string, LinkGroup>();
    allGroups.forEach(group => {
      group.subgroups = [];
      groupMap.set(group.id, group);
    });
    
    // Organize into hierarchy
    const topLevelGroups: LinkGroup[] = [];
    
    allGroups.forEach(group => {
      if (group.parentId && groupMap.has(group.parentId)) {
        // This is a subgroup, add it to its parent
        const parent = groupMap.get(group.parentId)!;
        console.log(`[sqliteDB] Adding ${group.name} as a subgroup of ${parent.name}`);
        parent.subgroups!.push(group);
      } else {
        // This is a top-level group
        if (group.parentId) {
          console.warn(`[sqliteDB] Group ${group.name} has parent ID ${group.parentId}, but parent not found. Adding as top-level.`);
        }
        topLevelGroups.push(group);
      }
    });
    
    // Log the hierarchy
    console.log(`[sqliteDB] Built hierarchy with ${topLevelGroups.length} top-level groups`);
    const logHierarchy = (groups: LinkGroup[], level = 0): void => {
      const indent = ' '.repeat(level * 2);
      groups.forEach(group => {
        console.log(`${indent}- ${group.name} (${group.subgroups?.length || 0} subgroups)`);
        if (group.subgroups && group.subgroups.length > 0) {
          logHierarchy(group.subgroups, level + 1);
        }
      });
    };
    logHierarchy(topLevelGroups);
    
    // Sort groups by name
    const sortGroups = (groups: LinkGroup[]) => {
      groups.sort((a, b) => a.name.localeCompare(b.name));
      groups.forEach(group => {
        if (group.subgroups && group.subgroups.length > 0) {
          sortGroups(group.subgroups);
        }
      });
    };
    
    sortGroups(topLevelGroups);
    
    return topLevelGroups;
  } catch (error) {
    console.error('[sqliteDB] Error getting link group hierarchy:', error);
    return [];
  }
};

export const getLinkGroupWithSubtree = async (id: string): Promise<LinkGroup | null> => {
  console.log(`[sqliteDB] Getting link group with subtree for ID: ${id}`);
  const db = await getDbConnection();
  
  try {
    // Get the root group
    const rootGroup = await getLinkGroup(id);
    if (!rootGroup) {
      return null;
    }
    
    // Function to recursively get subgroups
    const getSubgroups = async (groupId: string): Promise<LinkGroup[]> => {
      const subgroups = await db.all('SELECT id FROM link_groups WHERE parent_id = ?', [groupId]);
      const result: LinkGroup[] = [];
      
      for (const subgroup of subgroups) {
        const group = await getLinkGroup(subgroup.id);
        if (group) {
          group.subgroups = await getSubgroups(group.id);
          result.push(group);
        }
      }
      
      return result;
    };
    
    // Get all subgroups
    rootGroup.subgroups = await getSubgroups(id);
    
    return rootGroup;
  } catch (error) {
    console.error(`[sqliteDB] Error getting link group with subtree for ID ${id}:`, error);
    return null;
  }
};

export const deleteLinkFromGroup = async (groupId: string, linkId: string): Promise<void> => {
  console.log(`[sqliteDB] Explicitly deleting link ${linkId} from group ${groupId}`);
  const db = await getDbConnection();
  
  try {
    // Delete the link association from the link_group_links table
    await db.run('DELETE FROM link_group_links WHERE group_id = ? AND link_id = ?', [groupId, linkId]);
    console.log(`[sqliteDB] Removed link ${linkId} association from group ${groupId}`);
    
    // Check if the link is associated with any other groups
    const linkAssociations = await db.get(
      'SELECT COUNT(*) as count FROM link_group_links WHERE link_id = ?',
      [linkId]
    );
    
    // If the link is not associated with any other groups, delete it from the links table
    if (linkAssociations.count === 0) {
      await db.run('DELETE FROM links WHERE id = ?', [linkId]);
      console.log(`[sqliteDB] Link ${linkId} is now orphaned, deleted from links table`);
    } else {
      console.log(`[sqliteDB] Link ${linkId} is still associated with other groups, not deleted from links table`);
    }
  } catch (error) {
    console.error(`[sqliteDB] Error explicitly deleting link ${linkId}:`, error);
    throw error;
  }
};

// End of file - no test functions 