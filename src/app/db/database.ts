import Dexie, { Table } from 'dexie';
import { Group, Channel, APIKey } from '../types';

// Define our database schema
class YouTubeToolDatabase extends Dexie {
  groups!: Table<Group, string>;
  apiKeys!: Table<APIKey, string>;
  
  constructor() {
    super('YouTubeToolDB');
    
    this.version(1).stores({
      groups: 'id, name, *channels.id',
      apiKeys: '++id, name, key, priority'
    });
  }
}

// Create a singleton instance to use throughout the app
const db = new YouTubeToolDatabase();

// Export for use in components
export default db;

// Helper methods for groups
export const getGroups = async (): Promise<Group[]> => {
  return await db.groups.toArray();
};

export const getGroup = async (id: string): Promise<Group | undefined> => {
  return await db.groups.get(id);
};

export const saveGroup = async (group: Group): Promise<string> => {
  return await db.groups.put(group);
};

export const deleteGroup = async (id: string): Promise<void> => {
  await db.groups.delete(id);
};

// Helper methods for API keys
export const getAPIKeys = async (): Promise<APIKey[]> => {
  return await db.apiKeys.orderBy('priority').toArray();
};

export const saveAPIKey = async (apiKey: APIKey): Promise<string> => {
  return await db.apiKeys.put(apiKey);
};

export const updateAPIKeyPriorities = async (orderedKeys: APIKey[]): Promise<void> => {
  await db.transaction('rw', db.apiKeys, async () => {
    for (let i = 0; i < orderedKeys.length; i++) {
      const key = orderedKeys[i];
      await db.apiKeys.update(key.id!, { priority: i });
    }
  });
};

export const deleteAPIKey = async (id: string): Promise<void> => {
  await db.apiKeys.delete(id);
};

// Function to get a working API key
export const getWorkingAPIKey = async (): Promise<string | null> => {
  const apiKeys = await getAPIKeys();
  
  if (apiKeys.length === 0) {
    console.error('No API keys available in the database');
    return null;
  }
  
  // In a production app, we would test each key until we find a working one
  // For now, just return the highest priority key
  const key = apiKeys[0].key;
  
  // Basic validation - API keys should be non-empty and a reasonable length
  if (!key || key.trim() === '' || key.trim() === 'YOUR_API_KEY' || key.length < 10) {
    console.error('API key is invalid or empty');
    return null;
  }
  
  console.log('Retrieved API key from database');
  return key;
};

// Initialize database with example data if empty
export const initializeDatabase = async (): Promise<void> => {
  const groupCount = await db.groups.count();
  
  if (groupCount === 0) {
    // Add initial groups from localStorage if available
    if (typeof window !== 'undefined') {
      const savedGroups = localStorage.getItem('ytGroups');
      if (savedGroups) {
        const groups = JSON.parse(savedGroups);
        await db.groups.bulkPut(groups);
      }
    }
  }
  
  // No default API key added anymore - users must add their own
}; 