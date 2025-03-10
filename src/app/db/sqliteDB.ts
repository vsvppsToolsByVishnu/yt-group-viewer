import { getDbConnection } from './sqliteSetup';
import { Group, Channel, APIKey, Video } from '../types';

// ==================== Groups ====================

export const getGroups = async (): Promise<Group[]> => {
  const db = await getDbConnection();
  
  try {
    // Get all groups
    const groups = await db.all('SELECT * FROM groups ORDER BY name');
    
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
          }))
        };
      })
    );
    
    return result;
  } catch (error) {
    console.error('Error getting groups:', error);
    throw error;
  }
};

export const getGroup = async (id: string): Promise<Group | null> => {
  const db = await getDbConnection();
  
  try {
    // Get the group
    const group = await db.get('SELECT * FROM groups WHERE id = ?', [id]);
    
    if (!group) return null;
    
    // Get channels for the group
    const channels = await db.all(`
      SELECT c.* 
      FROM channels c
      JOIN group_channels gc ON c.id = gc.channel_id
      WHERE gc.group_id = ?
    `, [id]);
    
    return {
      id: group.id,
      name: group.name,
      channels: channels.map((c: any) => ({
        id: c.id,
        title: c.title,
        thumbnailUrl: c.thumbnail_url,
        description: c.description
      }))
    };
  } catch (error) {
    console.error(`Error getting group ${id}:`, error);
    throw error;
  }
};

export const saveGroup = async (group: Group): Promise<string> => {
  const db = await getDbConnection();
  
  try {
    await db.run('BEGIN TRANSACTION');
    
    // Insert or update the group
    await db.run(
      'INSERT OR REPLACE INTO groups (id, name) VALUES (?, ?)',
      [group.id, group.name]
    );
    
    // Delete existing group_channels relationships
    await db.run('DELETE FROM group_channels WHERE group_id = ?', [group.id]);
    
    // Insert channels and group_channels relationships
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
    
    await db.run('COMMIT');
    
    return group.id;
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Error saving group:', error);
    throw error;
  }
};

export const deleteGroup = async (id: string): Promise<void> => {
  const db = await getDbConnection();
  
  try {
    // Start a transaction to ensure data consistency
    await db.run('BEGIN TRANSACTION');
    
    // Get all channel IDs that are only used by this group
    // (will be removed since they're orphaned after group deletion)
    const orphanedChannels = await db.all(`
      SELECT c.id 
      FROM channels c
      WHERE c.id IN (
        SELECT channel_id FROM group_channels WHERE group_id = ?
      )
      AND c.id NOT IN (
        SELECT channel_id FROM group_channels WHERE group_id != ?
      )
    `, [id, id]);
    
    // Delete group-channel relationships for this group
    await db.run('DELETE FROM group_channels WHERE group_id = ?', [id]);
    
    // Delete orphaned channels (channels that were only in this group)
    if (orphanedChannels.length > 0) {
      const orphanedIds = orphanedChannels.map((c: { id: string }) => c.id);
      console.log(`Removing ${orphanedIds.length} orphaned channels:`, orphanedIds);
      
      // Use parameterized query for safety
      const placeholders = orphanedIds.map(() => '?').join(',');
      await db.run(
        `DELETE FROM channels WHERE id IN (${placeholders})`,
        orphanedIds
      );
      
      // Also clean up any videos from these orphaned channels
      // (Videos are linked to channels via foreign keys with ON DELETE CASCADE,
      // but we'll explicitly delete them here to be thorough)
      await db.run(
        `DELETE FROM videos WHERE channel_id IN (${placeholders})`,
        orphanedIds
      );
    }
    
    // Finally, delete the group itself
    await db.run('DELETE FROM groups WHERE id = ?', [id]);
    
    // Commit the transaction
    await db.run('COMMIT');
    
    console.log(`Group ${id} and all related data deleted successfully`);
  } catch (error) {
    // Rollback the transaction if anything fails
    await db.run('ROLLBACK');
    console.error(`Error deleting group ${id} and its related data:`, error);
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
    if (type) {
      await db.run('DELETE FROM cache WHERE type = ?', [type]);
    } else {
      await db.run('DELETE FROM cache');
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
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

// End of file - no test functions 