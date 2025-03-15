import { Group, Channel, APIKey, Video, LinkGroup, Link } from '../types';

// Base URL for API endpoints
const API_BASE_URL = '/api/db';

// Cache structure with improved typing
interface CacheStore {
  groups?: {
    data: Group[];
    timestamp: number;
    expiresAt: number;
  };
  group: Record<string, {
    data: Group | null;
    timestamp: number;
    expiresAt: number;
  }>;
  hierarchies?: {
    data: Group[];
    timestamp: number;
    expiresAt: number;
  };
  apiKeys?: {
    data: APIKey[];
    timestamp: number;
    expiresAt: number;
  };
}

// Improved cache store
const cache: CacheStore = {
  group: {}
};

// Cache TTLs
const CACHE_TTL = {
  SHORT: 30 * 1000,  // 30 seconds
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
};

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
  try {
    // Special handling for group objects to ensure parentId is properly passed
    if (action === 'saveGroup' && data.group) {
      // Log the group data before processing
      console.log(`[fetchPost] Pre-processing group data:`, JSON.stringify({
        id: data.group.id,
        name: data.group.name,
        parentId: data.group.parentId
      }));

      // Make sure we preserve parentId exactly as it is
      if (data.group.parentId === undefined) {
        console.log(`[fetchPost] Group ${data.group.id} has undefined parentId (top-level group)`);
      } else if (data.group.parentId === null) {
        console.log(`[fetchPost] Group ${data.group.id} has null parentId (will be converted to undefined)`);
        // Convert null to undefined for consistency
        data.group.parentId = undefined;
      } else {
        console.log(`[fetchPost] Group ${data.group.id} has parentId=${data.group.parentId} (subgroup)`);
      }
    }
    
    // Ensure we're not sending circular references
    const jsonData = JSON.stringify(data, (key, value) => {
      // Handle circular references by replacing with string
      if (key === 'subgroups') return undefined; // Don't send computed subgroups
      return value;
    });
    
    // Log the complete request for debugging
    if (action === 'saveGroup') {
      console.log(`[fetchPost] Final request body:`, jsonData);
    }
    
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, data: JSON.parse(jsonData) }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
      throw new Error(error.error || 'An error occurred');
    }
    
    const result = await response.json();
    
    // For saveLinkGroup, return the full response (not just data)
    if (action === 'saveLinkGroup') {
      return result as T;
    }
    
    // For other actions, return just the data property as before
    return result.data;
  } catch (error) {
    console.error(`Error in fetchPost (${action}):`, error);
    throw error;
  }
}

// ==================== Groups ====================

export const getGroups = async (): Promise<Group[]> => {
  // Check cache first
  if (cache.groups && Date.now() < cache.groups.expiresAt) {
    console.log('Using cached groups data');
    return cache.groups.data;
  }
  
  try {
    const groups = await fetchGet<Group[]>('getGroups');
    
    // Cache the result
    cache.groups = {
      data: groups,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL.MEDIUM
    };
    
    return groups;
  } catch (error) {
    console.error('Error getting groups:', error);
    // If we have stale cache, return it
    if (cache.groups) {
      console.log('Returning stale groups cache due to error');
      return cache.groups.data;
    }
    throw error;
  }
};

export const getGroupHierarchy = async (): Promise<Group[]> => {
  // Check cache first
  if (cache.hierarchies && Date.now() < cache.hierarchies.expiresAt) {
    console.log('Using cached group hierarchy');
    return cache.hierarchies.data;
  }
  
  try {
    const hierarchy = await fetchGet<Group[]>('getGroupHierarchy');
    
    // Cache the result
    cache.hierarchies = {
      data: hierarchy,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL.MEDIUM
    };
    
    return hierarchy;
  } catch (error) {
    console.error('Error getting group hierarchy:', error);
    // If we have stale cache, return it
    if (cache.hierarchies) {
      console.log('Returning stale hierarchy cache due to error');
      return cache.hierarchies.data;
    }
    throw error;
  }
};

export const getGroup = async (id: string): Promise<Group | null> => {
  // Check cache first
  if (cache.group[id] && Date.now() < cache.group[id].expiresAt) {
    console.log(`Using cached data for group ID: ${id}`);
    return cache.group[id].data;
  }
  
  try {
    const group = await fetchGet<Group | null>('getGroup', { id });
    
    // Cache the result
    if (group) {
      cache.group[id] = {
        data: group,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_TTL.MEDIUM
      };
    } else {
      // Cache negative result for a shorter time
      cache.group[id] = {
        data: null,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_TTL.SHORT
      };
    }
    
    return group;
  } catch (error) {
    console.error(`Error getting group ${id}:`, error);
    // If we have stale cache, return it
    if (cache.group[id]) {
      console.log(`Returning stale cache for group ${id} due to error`);
      return cache.group[id].data;
    }
    throw error;
  }
};

export const getGroupWithSubtree = async (id: string): Promise<Group | null> => {
  // For full subtrees, we use a separate cache key to avoid conflicts
  const cacheKey = `${id}_subtree`;
  
  // Check cache first
  if (cache.group[cacheKey] && Date.now() < cache.group[cacheKey].expiresAt) {
    console.log(`Using cached subtree data for group ID: ${id}`);
    return cache.group[cacheKey].data;
  }
  
  try {
    const group = await fetchGet<Group | null>('getGroupWithSubtree', { id });
    
    // Cache the result
    if (group) {
      cache.group[cacheKey] = {
        data: group,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_TTL.MEDIUM
      };
    }
    
    return group;
  } catch (error) {
    console.error(`Error getting group subtree ${id}:`, error);
    // If we have stale cache, return it
    if (cache.group[cacheKey]) {
      console.log(`Returning stale subtree cache for group ${id} due to error`);
      return cache.group[cacheKey].data;
    }
    throw error;
  }
};

// Clear specific group cache
export const clearGroupCache = (groupId?: string): void => {
  // Always clear the groups and hierarchies cache
  delete cache.groups;
  delete cache.hierarchies;
  
  if (groupId) {
    // Clear the specific group
    delete cache.group[groupId];
    
    // Find and clear any parent groups that might contain this as a subgroup
    Object.keys(cache.group).forEach(cachedGroupId => {
      const cachedGroup = cache.group[cachedGroupId]?.data;
      if (cachedGroup && hasSubgroupWithId(cachedGroup, groupId)) {
        delete cache.group[cachedGroupId];
      }
    });
  } else {
    // Clear all group caches
    cache.group = {};
  }
};

// Helper to check if a group has a specific subgroup id
const hasSubgroupWithId = (group: Group, subgroupId: string): boolean => {
  if (!group.subgroups) return false;
  
  // Check direct subgroups
  if (group.subgroups.some(sg => sg.id === subgroupId)) {
    return true;
  }
  
  // Check nested subgroups
  return group.subgroups.some(sg => hasSubgroupWithId(sg, subgroupId));
};

export const saveGroup = async (group: Group): Promise<string> => {
  // Clear all related caches
  clearGroupCache(group.id);
  
  // Log the group with special attention to parentId
  console.log(`[dbService] Saving group ${group.id} (${group.name}) with parentId=${group.parentId !== undefined ? `"${group.parentId}"` : 'undefined'}`);
  
  // If group has a parent, clear the parent's cache too
  if (group.parentId) {
    clearGroupCache(group.parentId);
    console.log(`[dbService] This is a subgroup with parent ${group.parentId}`);
  } else {
    console.log(`[dbService] This is a top-level group (no parent)`);
  }
  
  // Get all existing subgroups for this group to ensure they're preserved
  let existingSubgroups: Group[] = [];
  try {
    const fullGroup = await getGroupWithSubtree(group.id);
    if (fullGroup && fullGroup.subgroups && fullGroup.subgroups.length > 0) {
      existingSubgroups = fullGroup.subgroups;
      console.log(`[dbService] Found ${existingSubgroups.length} existing subgroups for group ${group.id}`);
    }
  } catch (error) {
    console.warn(`[dbService] Error fetching existing subgroups for ${group.id}:`, error);
  }
  
  // Create a copy without circular references
  const groupToSave = {
    ...group,
    // Preserve existing subgroups if not already in the group
    subgroups: group.subgroups && group.subgroups.length > 0 
      ? group.subgroups 
      : existingSubgroups.length > 0 
        ? existingSubgroups 
        : undefined
  };
  
  // Log what we're about to save
  console.log(`[dbService] POST body:`, JSON.stringify({ 
    action: 'saveGroup', 
    data: { 
      group: {
        id: groupToSave.id,
        name: groupToSave.name,
        parentId: groupToSave.parentId,
        isExpanded: groupToSave.isExpanded,
        hasSubgroups: groupToSave.subgroups ? groupToSave.subgroups.length : 0
      }
    }
  }));
  
  try {
    const result = await fetchPost<{ id: string }>('saveGroup', { group: groupToSave });
    console.log(`[dbService] Group ${group.id} saved successfully with result:`, result);
    
    // Verify subgroups are intact after save
    try {
      const savedGroup = await getGroupWithSubtree(group.id);
      if (savedGroup) {
        const savedSubgroupCount = savedGroup.subgroups ? savedGroup.subgroups.length : 0;
        console.log(`[dbService] After save, group ${group.id} has ${savedSubgroupCount} subgroups`);
        
        // Warn if we lost subgroups during the save
        if (existingSubgroups.length > 0 && savedSubgroupCount < existingSubgroups.length) {
          console.warn(`[dbService] WARNING: Lost subgroups during save. Before: ${existingSubgroups.length}, After: ${savedSubgroupCount}`);
        }
      }
    } catch (verifyError) {
      console.warn(`[dbService] Error verifying saved group tree:`, verifyError);
    }
    
    return result.id;
  } catch (error) {
    console.error(`[dbService] Error saving group ${group.id}:`, error);
    throw error;
  }
};

export const deleteGroup = async (id: string): Promise<void> => {
  try {
    console.log(`[dbService] Deleting group with ID: ${id}`);
    
    // Get the group to check parent relationships before deletion
    const group = await getGroup(id);
    
    if (group) {
      console.log(`[dbService] Found group "${group.name}" (parentId: ${group.parentId || 'none'})`);
    } else {
      console.log(`[dbService] Group with ID ${id} not found, proceeding with deletion anyway`);
    }
    
    // Clear local caches
    delete cache.groups;
    delete cache.hierarchies;
    
    // Clear group-specific cache
    cache.group = {};
    
    // Clear any video caches that might be affected
    await clearCache('videos');
    
    console.log(`[dbService] Cleared all relevant caches`);
    
    // Delete the group through the API
    await fetchPost('deleteGroup', { id });
    console.log(`[dbService] Group ${id} deleted successfully`);
  } catch (error) {
    console.error(`[dbService] Error deleting group ${id}:`, error);
    throw error;
  }
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
  // Clear local cache
  if (!type) {
    // Clear everything except group details
    delete cache.groups;
    delete cache.hierarchies;
    delete cache.apiKeys;
  } else {
    switch (type) {
      case 'groups':
        delete cache.groups;
        delete cache.hierarchies;
        break;
      case 'group':
        cache.group = {};
        delete cache.groups;
        delete cache.hierarchies;
        break;
      case 'api-keys':
        delete cache.apiKeys;
        break;
      default:
        break;
    }
  }
  
  // Clear database cache
  console.log(`[dbService] Clearing database cache${type ? ' for type: ' + type : ''}`);
  try {
    await fetchPost('clearCache', { type });
    console.log('[dbService] Database cache cleared successfully');
  } catch (error) {
    console.error('[dbService] Error clearing database cache:', error);
  }
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

// ==================== Link Groups ====================

export const getLinkGroups = async (): Promise<LinkGroup[]> => {
  console.log('[dbService] Getting all link groups');
  const linkGroups = await fetchGet<LinkGroup[]>('getLinkGroups');
  return linkGroups || [];
};

export const getLinkGroupHierarchy = async (): Promise<LinkGroup[]> => {
  console.log('[dbService] Getting link group hierarchy');
  const hierarchy = await fetchGet<LinkGroup[]>('getLinkGroupHierarchy');
  return hierarchy || [];
};

export const getLinkGroup = async (id: string): Promise<LinkGroup | null> => {
  console.log(`[dbService] Getting link group with ID: ${id}`);
  if (!id) {
    console.error('[dbService] Cannot get link group: Missing ID');
    return null;
  }
  
  const group = await fetchGet<LinkGroup | null>('getLinkGroup', { id });
  return group;
};

export const getLinkGroupWithSubtree = async (id: string): Promise<LinkGroup | null> => {
  console.log(`[dbService] Getting link group with subtree for ID: ${id}`);
  if (!id) {
    console.error('[dbService] Cannot get link group with subtree: Missing ID');
    return null;
  }
  
  const group = await fetchGet<LinkGroup | null>('getLinkGroupWithSubtree', { id });
  return group;
};

export const saveLinkGroup = async (group: LinkGroup): Promise<string | null> => {
  console.log(`[dbService] Saving link group: ${group.name} (${group.id || 'new'})`);
  
  try {
    // Sanitize the group object to avoid circular references
    const sanitizedGroup = {
      ...group,
      subgroups: group.subgroups?.map(subgroup => ({
        ...subgroup,
        subgroups: undefined // Don't send nested subgroups
      }))
    };
    
    type SaveLinkGroupResponse = {
      success: boolean;
      data?: {
        id: string;
      };
      error?: string;
    };
    
    const result = await fetchPost<SaveLinkGroupResponse>('saveLinkGroup', { group: sanitizedGroup });
    
    if (result && result.success && result.data && result.data.id) {
      console.log(`[dbService] Link group saved successfully with ID: ${result.data.id}`);
      return result.data.id;
    } else {
      console.error('[dbService] Failed to save link group: No ID returned', result);
      return null;
    }
  } catch (error) {
    console.error('[dbService] Error saving link group:', error);
    return null;
  }
};

export const deleteLinkFromGroup = async (groupId: string, linkId: string): Promise<boolean> => {
  console.log(`[dbService] Explicitly deleting link ${linkId} from group ${groupId}`);
  if (!groupId || !linkId) {
    console.error('[dbService] Cannot delete link: Missing groupId or linkId');
    return false;
  }
  
  try {
    // Delete the link through the API
    const result = await fetchPost<{ success: boolean }>('deleteLinkFromGroup', { groupId, linkId });
    return result?.success || false;
  } catch (error) {
    console.error(`[dbService] Error explicitly deleting link ${linkId} from group ${groupId}:`, error);
    return false;
  }
};

export const deleteLinkGroup = async (id: string): Promise<boolean> => {
  console.log(`[dbService] Deleting link group with ID: ${id}`);
  if (!id) {
    console.error('[dbService] Cannot delete link group: Missing ID');
    return false;
  }
  
  try {
    const result = await fetchPost<{ success: boolean }>('deleteLinkGroup', { id });
    return result?.success || false;
  } catch (error) {
    console.error(`[dbService] Error deleting link group with ID ${id}:`, error);
    return false;
  }
}; 