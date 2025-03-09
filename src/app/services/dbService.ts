import { Group, Channel, APIKey, Video } from '../types';

// Base URL for API endpoints
const API_BASE_URL = '/api/db';

// Simple in-memory cache to reduce redundant API calls
type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const cache: {
  groups?: CacheEntry<Group[]>;
  group: Record<string, CacheEntry<Group | null>>;
} = {
  group: {}
};

// Cache expiration time (5 seconds)
const CACHE_EXPIRY = 5000;

// Helper function for GET requests
async function fetchGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  try {
    const searchParams = new URLSearchParams({ action, ...params });
    const url = `${API_BASE_URL}?${searchParams.toString()}`;
    
    // Set a timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    
    // Clear the timeout since the request completed
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
      throw new Error(error.error || `HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`Network error during fetchGet(${action}):`, error);
      throw new Error(`Network error: ${error.message}`);
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      console.error(`Request timeout for fetchGet(${action})`);
      throw new Error('Request timed out');
    } else {
      console.error(`Error in fetchGet(${action}):`, error);
      throw error;
    }
  }
}

// Helper function for POST requests
async function fetchPost<T>(action: string, data: any = {}): Promise<T> {
  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, data }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'An error occurred');
  }
  
  const result = await response.json();
  return result.data;
}

// ==================== Groups ====================

export const getGroups = async (): Promise<Group[]> => {
  const now = Date.now();
  
  // Check cache first
  if (cache.groups && (now - cache.groups.timestamp) < CACHE_EXPIRY) {
    console.log('Using cached groups data');
    return cache.groups.data;
  }
  
  console.log('Fetching all groups from API');
  const groups = await fetchGet<Group[]>('getGroups');
  
  // Update cache
  cache.groups = {
    data: groups,
    timestamp: now
  };
  
  // Also update individual group cache entries
  groups.forEach(group => {
    cache.group[group.id] = {
      data: group,
      timestamp: now
    };
  });
  
  return groups;
};

export const getGroup = async (id: string): Promise<Group | null> => {
  try {
    // Add console logging to help diagnose issues
    console.log(`Fetching group with ID: ${id}`);
    
    const now = Date.now();
    
    // Check cache first
    if (cache.group[id] && (now - cache.group[id].timestamp) < CACHE_EXPIRY) {
      console.log(`Using cached data for group ID: ${id}`);
      return cache.group[id].data;
    }
    
    const group = await fetchGet<Group | null>('getGroup', { id });
    
    // Update cache
    if (group) {
      console.log(`Successfully retrieved group: ${group.name}`);
      cache.group[id] = {
        data: group,
        timestamp: now
      };
    } else {
      console.log(`No group found with ID: ${id}`);
      // Cache negative result too (for a shorter time)
      cache.group[id] = {
        data: null,
        timestamp: now
      };
    }
    
    return group;
  } catch (error) {
    console.error(`Error fetching group with ID ${id}:`, error);
    
    // Try once more with a slight delay, as this could be a transient network issue
    try {
      console.log(`Retrying fetch for group ID: ${id}`);
      await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
      
      const group = await fetchGet<Group | null>('getGroup', { id });
      
      // Update cache on successful retry
      if (group) {
        console.log(`Successfully retrieved group on retry: ${group.name}`);
        cache.group[id] = {
          data: group,
          timestamp: Date.now()
        };
      } else {
        console.log(`No group found with ID on retry: ${id}`);
      }
      
      return group;
    } catch (retryError) {
      console.error(`Error on retry fetch for group ID ${id}:`, retryError);
      return null; // Return null after failing twice
    }
  }
};

export const saveGroup = async (group: Group): Promise<string> => {
  // Clear related caches when saving a group
  delete cache.groups;
  if (group.id) {
    delete cache.group[group.id];
  }
  
  const result = await fetchPost<{ id: string }>('saveGroup', { group });
  return result.id;
};

export const deleteGroup = async (id: string): Promise<void> => {
  // Clear related caches when deleting a group
  delete cache.groups;
  delete cache.group[id];
  
  await fetchPost('deleteGroup', { id });
};

// ==================== API Keys ====================

export const getAPIKeys = async (): Promise<APIKey[]> => {
  return fetchGet<APIKey[]>('getAPIKeys');
};

export const saveAPIKey = async (apiKey: APIKey): Promise<string> => {
  const result = await fetchPost<{ id: string }>('saveAPIKey', { apiKey });
  return result.id;
};

export const updateAPIKeyPriorities = async (keys: APIKey[]): Promise<void> => {
  await fetchPost('updateAPIKeyPriorities', { keys });
};

export const deleteAPIKey = async (id: string): Promise<void> => {
  await fetchPost('deleteAPIKey', { id });
};

export const getWorkingAPIKey = async (): Promise<string | null> => {
  return fetchGet<string | null>('getWorkingAPIKey');
};

// ==================== Cache ====================

export const getCacheEntry = async <T>(key: string, type: string): Promise<T | null> => {
  return fetchGet<T | null>('getCacheEntry', { key, type });
};

export const setCacheEntry = async <T>(key: string, value: T, type: string): Promise<void> => {
  await fetchPost('setCacheEntry', { key, value, type });
};

export const clearCache = async (type?: string): Promise<void> => {
  await fetchPost('clearCache', { type });
};

// ==================== Videos ====================

export const getVideosForChannel = async (channelId: string, limit?: number): Promise<Video[]> => {
  const params: Record<string, string> = { channelId };
  if (limit) params.limit = limit.toString();
  
  return fetchGet<Video[]>('getVideosForChannel', params);
};

export const saveVideos = async (videos: Video[]): Promise<void> => {
  await fetchPost('saveVideos', { videos });
};

export const deleteVideosForChannel = async (channelId: string): Promise<void> => {
  await fetchPost('deleteVideosForChannel', { channelId });
};

// ==================== Channels ====================

export const deleteChannel = async (channelId: string): Promise<void> => {
  await fetchPost('deleteChannel', { channelId });
}; 