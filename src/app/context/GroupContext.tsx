"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { Group, Channel } from '../types';
import youtubeService from '../services/youtubeService';
import * as dbService from '../services/dbService';

// Generate a random ID for new groups or channels
const generateId = () => Math.random().toString(36).substring(2, 9);

// Extract channel ID from a YouTube URL
const extractChannelId = (url: string): string | null => {
  try {
    // Handle different URL formats
    const urlObj = new URL(url);
    
    // Format: youtube.com/channel/UC-lHJZR3Gqxm24_Vd_AJ5Yw
    if (urlObj.pathname.includes('/channel/')) {
      const parts = urlObj.pathname.split('/');
      const indexOfChannel = parts.findIndex(part => part === 'channel');
      if (indexOfChannel >= 0 && parts.length > indexOfChannel + 1) {
        return parts[indexOfChannel + 1];
      }
    }
    
    // Format: youtube.com/c/ChannelName or youtube.com/@username
    if (urlObj.pathname.includes('/c/') || urlObj.pathname.includes('/@')) {
      const parts = urlObj.pathname.split('/');
      const lastPart = parts[parts.length - 1];
      // For demo purposes, we'll create a mock ID based on the name
      // In a real app, you'd need to call the YouTube API to get the actual channel ID
      return 'UC' + lastPart + '-' + generateId();
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing YouTube URL:', error);
    return null;
  }
};

// Define the context interface
export interface GroupContextType {
  groups: Group[];
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  addGroup: (name: string, parentId?: string) => Promise<string | null>;
  editGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  addChannelToGroup: (groupId: string, channel: Channel) => Promise<void>;
  removeChannelFromGroup: (groupId: string, channelId: string) => Promise<void>;
  removeMultipleChannelsFromGroup: (groupId: string, channelIds: string[]) => Promise<void>;
  searchResults: Channel[];
  searchChannels: (query: string) => Promise<void>;
  showMoreSearchResults: () => Promise<void>;
  isSearching: boolean;
  hasMoreResults: boolean;
  addChannelByUrl: (groupId: string, url: string, retrieveOnly?: boolean) => Promise<{success: boolean, message: string, channel?: Channel}>;
  searchError: string | null;
  loadGroups: () => Promise<void>;
  toggleSubgroupExpansion: (groupId: string) => Promise<void>;
  getSubgroups: (parentId: string | null) => Group[];
  getTopLevelGroups: () => Group[];
  getGroupTree: (parentId?: string | null) => Group[];
  addChannelsToGroupBatch: (groupId: string, channels: Channel[]) => Promise<{success: boolean, message: string}>;
}

// Create the context with default values
const GroupContext = createContext<GroupContextType>({
  groups: [],
  activeGroupId: null,
  setActiveGroupId: () => {},
  addGroup: async () => null,
  editGroup: async () => {},
  deleteGroup: async () => {},
  addChannelToGroup: async () => {},
  removeChannelFromGroup: async () => {},
  removeMultipleChannelsFromGroup: async () => {},
  searchResults: [],
  searchChannels: async () => {},
  showMoreSearchResults: async () => {},
  isSearching: false,
  hasMoreResults: false,
  addChannelByUrl: async () => ({ success: false, message: '' }),
  searchError: null,
  loadGroups: async () => {},
  toggleSubgroupExpansion: async () => {},
  getSubgroups: () => [],
  getTopLevelGroups: () => [],
  getGroupTree: () => [],
  addChannelsToGroupBatch: async () => ({ success: false, message: '' })
});

// Custom hook to use the group context
export const useGroupContext = () => useContext(GroupContext);

// Helper function for debouncing
const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): Promise<ReturnType<F>> => {
    if (timeout) {
      clearTimeout(timeout);
    }

    return new Promise(resolve => {
      timeout = setTimeout(() => {
        resolve(func(...args));
      }, waitFor);
    });
  };
};

// Provider component
export function GroupProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Channel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [searchNextPageToken, setSearchNextPageToken] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Refs for tracking loading state
  const isLoadingGroups = useRef(false);
  const lastGroupsLoadTime = useRef(0);
  const searchCache = useRef<{[query: string]: Channel[]}>({});
  
  // Track previous searches to avoid redundant API calls
  const previousSearches = useRef<Map<string, Channel[]>>(new Map());
  const previousUrlFetches = useRef<Map<string, {success: boolean, message: string, channel?: Channel}>>(new Map());
  
  // Load groups on mount with error handling
  useEffect(() => {
    const initializeGroups = async () => {
      try {
        await loadGroups();
      } catch (error) {
        console.error('Error initializing groups:', error);
        setDbError(`Failed to load groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    
    initializeGroups();
  }, []);

  // Define loadGroups function outside useEffect to make it reusable
  const loadGroups = async () => {
    try {
      // Implement throttling to prevent multiple concurrent calls
      const now = Date.now();
      const cooldownPeriod = 1000; // 1 second cooldown
      
      // Skip if a request was made recently or is in progress
      if (now - lastGroupsLoadTime.current < cooldownPeriod) {
        console.log('Group loading throttled - called too frequently');
        return;
      }
      
      if (isLoadingGroups.current) {
        console.log('Group loading already in progress, skipping duplicate call');
        return;
      }
      
      isLoadingGroups.current = true;
      lastGroupsLoadTime.current = now;
      console.log('Loading all groups');
      
      // Use the dbService to get hierarchical groups
      let fetchedGroups = await dbService.getGroups();
      
      // Store a map of parent IDs to detect orphaned subgroups
      console.log("Checking for orphaned subgroups...");
      const parentIds = new Set(fetchedGroups.filter(g => g.parentId).map(g => g.parentId));
      const allIds = new Set(fetchedGroups.map(g => g.id));
      
      // Check for orphaned subgroups (subgroups with invalid parent IDs)
      const orphanedGroups = fetchedGroups.filter(g => g.parentId && !allIds.has(g.parentId));
      if (orphanedGroups.length > 0) {
        console.warn("Found orphaned subgroups:", orphanedGroups);
        // Fix orphaned groups by resetting their parentId
        for (const group of orphanedGroups) {
          console.log(`Fixing orphaned group ${group.id} (${group.name}) by clearing parent ID`);
          await dbService.saveGroup({...group, parentId: undefined});
        }
        
        // Reload groups after fixing
        fetchedGroups = await dbService.getGroups();
      }
      
      // Update state only if component is still mounted
      setGroups(fetchedGroups);
      
      // Set first top-level group as active if there are groups and no active group
      if (fetchedGroups.length > 0 && !activeGroupId) {
        const topLevelGroups = fetchedGroups.filter(g => !g.parentId);
        if (topLevelGroups.length > 0) {
          setActiveGroupId(topLevelGroups[0].id);
        } else {
          setActiveGroupId(fetchedGroups[0].id);
        }
      }
      
      console.log(`Loaded ${fetchedGroups.length} groups successfully`);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      isLoadingGroups.current = false;
    }
  };
  
  // Add a new group
  const addGroup = async (name: string, parentId?: string) => {
    try {
      setIsLoading(true);
      const newGroup: Group = {
        id: generateId(),
        name,
        channels: [],
        parentId,
        isExpanded: false  // Default to collapsed
      };
      
      // Save to database first
      const groupId = await dbService.saveGroup(newGroup);
      console.log('Group saved with ID:', groupId);
      
      // Add to state only after successful save
      setGroups(prev => [...prev, newGroup]);
      
      // If this is our first group, make it active
      if (groups.length === 0) {
        setActiveGroupId(newGroup.id);
      }
      
      return newGroup.id; // Return the ID for potential further actions
    } catch (error) {
      console.error('Error adding group:', error);
      alert(`Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Edit a group
  const editGroup = async (id: string, name: string) => {
    try {
      // Find the group to edit
      const groupToEdit = groups.find(group => group.id === id);
      if (!groupToEdit) return;
      
      // Create updated group
      const updatedGroup = { ...groupToEdit, name };
      
      // Update in database using the new dbService
      await dbService.saveGroup(updatedGroup);
      
      // Update state
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === id ? updatedGroup : group
        )
      );
    } catch (error) {
      console.error('Error editing group:', error);
    }
  };

  // Enhanced function to get all subgroups recursively
  const getAllSubgroupIds = (groupId: string): string[] => {
    const subgroups = groups.filter(g => g.parentId === groupId);
    let subgroupIds: string[] = subgroups.map(sg => sg.id);
    
    subgroups.forEach(sg => {
      subgroupIds = [...subgroupIds, ...getAllSubgroupIds(sg.id)];
    });
    
    return subgroupIds;
  };

  // Delete a group and all its subgroups
  const deleteGroup = async (id: string) => {
    try {
      setIsLoading(true);
      
      // Get all subgroups recursively
      const subgroupIds = getAllSubgroupIds(id);
      const allGroupsToDelete = [id, ...subgroupIds];
      
      // Update state first for immediate UI response
      setGroups(prev => prev.filter(g => !allGroupsToDelete.includes(g.id)));
      
      // Remove from database
      for (const groupId of allGroupsToDelete) {
        await dbService.deleteGroup(groupId);
      }
      
      // If the active group was deleted, set activeGroupId to null
      if (activeGroupId && allGroupsToDelete.includes(activeGroupId)) {
        setActiveGroupId(null);
      }
    } catch (error) {
      console.error('Error deleting group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a channel to a group
  const addChannelToGroup = async (groupId: string, channel: Channel) => {
    try {
      // Find the target group
      const targetGroup = groups.find(group => group.id === groupId);
      if (!targetGroup) return;
      
      // Check if channel already exists in the group
      const channelExists = targetGroup.channels.some(c => c.id === channel.id);
      if (channelExists) return;
      
      // Add channel to the group
      const updatedGroup = { 
        ...targetGroup,
        channels: [...targetGroup.channels, channel]
      };
      
      // Save to database using the new dbService
      await dbService.saveGroup(updatedGroup);
      
      // Update state
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? updatedGroup : group
        )
      );
    } catch (error) {
      console.error('Error adding channel to group:', error);
    }
  };

  // Remove a channel from a group
  const removeChannelFromGroup = async (groupId: string, channelId: string) => {
    try {
      // Find the target group
      const targetGroup = groups.find(group => group.id === groupId);
      if (!targetGroup) return;
      
      // Get the channel data before removal (needed for state update)
      const channelToRemove = targetGroup.channels.find(c => c.id === channelId);
      if (!channelToRemove) return;
      
      // Remove the channel from the group
      const updatedGroup = { 
        ...targetGroup,
        channels: targetGroup.channels.filter(channel => channel.id !== channelId)
      };
      
      // Update state first for immediate UI response
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? updatedGroup : group
        )
      );
      
      // Check if the channel is used by any other group
      const isChannelUsedElsewhere = groups.some(
        group => group.id !== groupId && group.channels.some(channel => channel.id === channelId)
      );
      
      // Save the updated group to database (do this after state update)
      await dbService.saveGroup(updatedGroup);
      
      // If the channel is not used by any other group, delete it and its videos
      if (!isChannelUsedElsewhere) {
        console.log(`Channel ${channelId} is not used by any other group, deleting channel and related data`);
        
        // Delete the channel's videos
        await dbService.deleteVideosForChannel(channelId);
        
        // Delete the channel itself
        await dbService.deleteChannel(channelId);
      }
    } catch (error) {
      console.error('Error removing channel from group:', error);
      
      // If there's an error, reload all groups to ensure UI is in sync with database
      await loadGroups();
    }
  };

  // Remove multiple channels from a group in a single operation
  const removeMultipleChannelsFromGroup = async (groupId: string, channelIds: string[]) => {
    if (!channelIds.length) return;
    
    try {
      console.log(`Removing ${channelIds.length} channels from group ${groupId}`);
      
      // Find the target group
      const targetGroup = groups.find(group => group.id === groupId);
      if (!targetGroup) {
        console.error(`Group ${groupId} not found`);
        return;
      }
      
      // Get channel data before removal (for logging)
      const channelsToRemove = targetGroup.channels.filter(c => channelIds.includes(c.id));
      if (channelsToRemove.length === 0) {
        console.log('No matching channels found to remove');
        return;
      }
      
      console.log(`Found ${channelsToRemove.length} channels to remove:`, 
        channelsToRemove.map(c => c.title).join(', '));
      
      // Create updated group with channels removed
      const updatedGroup = {
        ...targetGroup,
        channels: targetGroup.channels.filter(channel => !channelIds.includes(channel.id))
      };
      
      // Update state first for immediate UI response
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? updatedGroup : group
        )
      );
      
      // Save the updated group to database
      await dbService.saveGroup(updatedGroup);
      
      // Check which channels are not used by any other group
      const orphanedChannelIds: string[] = [];
      
      for (const channelId of channelIds) {
        const isChannelUsedElsewhere = groups.some(
          group => group.id !== groupId && group.channels.some(channel => channel.id === channelId)
        );
        
        if (!isChannelUsedElsewhere) {
          orphanedChannelIds.push(channelId);
        }
      }
      
      // Delete orphaned channels and their videos
      if (orphanedChannelIds.length > 0) {
        console.log(`Deleting ${orphanedChannelIds.length} orphaned channels:`, orphanedChannelIds);
        
        for (const channelId of orphanedChannelIds) {
          // Delete the channel's videos
          await dbService.deleteVideosForChannel(channelId);
          
          // Delete the channel itself
          await dbService.deleteChannel(channelId);
        }
      }
      
      console.log(`Successfully removed ${channelIds.length} channels from group ${groupId}`);
    } catch (error) {
      console.error('Error removing multiple channels from group:', error);
      
      // If there's an error, reload all groups to ensure UI is in sync with database
      await loadGroups();
    }
  };

  // Add a channel by URL
  const addChannelByUrl = async (groupId: string, url: string, retrieveOnly: boolean = false): Promise<{success: boolean, message: string, channel?: Channel}> => {
    try {
      // Check cache first to avoid redundant API calls
      const cacheKey = `${groupId}:${url}`;
      const cachedResult = previousUrlFetches.current.get(cacheKey);
      
      if (cachedResult) {
        console.log(`Using cached result for URL: ${url}`);
        // Don't return failure results from cache, only successes
        if (cachedResult.success) {
          return cachedResult;
        }
      }
      
      // Make sure YouTube API is initialized
      const apiInitialized = await youtubeService.initialize();
      if (!apiInitialized) {
        return { 
          success: false, 
          message: 'There is an issue with the YouTube API key. Please check your API key in the settings.' 
        };
      }
      
      // Normalize URL to ensure it has https:// prefix
      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      
      // Validate the URL structure before processing
      try {
        new URL(normalizedUrl);
      } catch (e) {
        return { success: false, message: 'Invalid URL format. Please enter a complete URL including https://' };
      }

      // Get channel ID from URL
      console.log(`Getting channel ID from URL: ${normalizedUrl}`);
      let channelId;
      try {
        channelId = await youtubeService.getChannelIdFromUrl(normalizedUrl);
      } catch (error) {
        console.error('Error getting channel ID:', error);
        
        // Handle different error types
        if (error instanceof Error) {
          // Check for API key issues
          if (error.message.includes('API key') || 
              error.message.includes('authentication') || 
              error.message.includes('auth')) {
            return { 
              success: false, 
              message: 'There is an issue with your YouTube API key. Please verify the API key is correct and has the YouTube Data API enabled.' 
            };
          }
          
          // For username errors, provide a clearer message
          if (error.message.includes('username') || error.message.includes('channel')) {
            return { 
              success: false, 
              message: 'Could not find this YouTube channel. Please verify the URL or try using the channel ID format.' 
            };
          }
          return { success: false, message: error.message };
        } else if (error === null || error === undefined || JSON.stringify(error) === '{}') {
          // Special handling for empty error objects
          return { 
            success: false, 
            message: 'An unknown error occurred. Please try adding the channel using a different URL format or the channel ID.' 
          };
        } else {
          return { 
            success: false, 
            message: `Error parsing YouTube URL: ${JSON.stringify(error)}` 
          };
        }
      }
      
      if (!channelId) {
        return { 
          success: false, 
          message: 'Could not extract channel ID from the URL. Please try using the direct channel ID format (youtube.com/channel/UC...)' 
        };
      }

      // Check if channel already exists in the group
      const targetGroup = groups.find(g => g.id === groupId);
      if (!targetGroup) {
        return { success: false, message: 'Group not found' };
      }

      const channelExists = targetGroup.channels.some(c => c.id === channelId);
      if (channelExists) {
        return { success: false, message: 'Channel already exists in this group' };
      }

      // Get channel details from YouTube API
      console.log(`Getting channel details for ID: ${channelId}`);
      let channelDetails;
      try {
        channelDetails = await youtubeService.getChannelById(channelId);
      } catch (error) {
        console.error('Error getting channel details:', error);
        
        // Handle different error types
        if (error instanceof Error) {
          return { success: false, message: error.message };
        } else if (error === null || error === undefined || JSON.stringify(error) === '{}') {
          return { 
            success: false, 
            message: 'Failed to retrieve channel details. Please try again later.' 
          };
        } else {
          return { 
            success: false, 
            message: `Error fetching channel details: ${JSON.stringify(error)}` 
          };
        }
      }
      
      if (!channelDetails) {
        return { 
          success: false, 
          message: 'Could not find channel information. The channel may be private or no longer exist.' 
        };
      }
      
      // If retrieveOnly is true, just return the channel without adding it to the group
      if (retrieveOnly) {
        const result = { 
          success: true, 
          message: `Retrieved channel "${channelDetails.title}" successfully`,
          channel: channelDetails
        };
        
        // Cache the result
        previousUrlFetches.current.set(cacheKey, result);
        
        return result;
      }

      // Add the channel to the group
      await addChannelToGroup(groupId, channelDetails);

      const result = { 
        success: true, 
        message: `Channel "${channelDetails.title}" added successfully`, 
        channel: channelDetails 
      };
      
      // Cache the result
      previousUrlFetches.current.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error in addChannelByUrl:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  };

  // Create a debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string, maxResults: number = 5) => {
      setIsSearching(true);
      setSearchError(null);
      setLastSearchQuery(query);
      
      try {
        // Check if we've already searched for this query recently with the same max results
        const cacheKey = `${query}:${maxResults}`;
        if (previousSearches.current.has(cacheKey)) {
          console.log(`Using cached search results for: ${cacheKey}`);
          const cachedResults = previousSearches.current.get(cacheKey);
          if (cachedResults) {
            setSearchResults(cachedResults);
            // If we already have cached results for more than 5 items, we don't have more results
            setHasMoreResults(maxResults === 5);
          }
          setIsSearching(false);
          return;
        }
        
        // Initialize YouTube service if needed
        const initialized = await youtubeService.initialize();
        if (!initialized) {
          setSearchError('No API key available. Please add a YouTube API key in the settings.');
          setIsSearching(false);
          return;
        }
        
        const results = await youtubeService.searchChannels(query, maxResults);
        setSearchResults(results);
        
        // Assume there are more results if we get exactly the number requested
        setHasMoreResults(results.length === maxResults && maxResults === 5);
        
        // Cache the results
        previousSearches.current.set(cacheKey, results);
        
        // Limit cache size to avoid memory issues
        if (previousSearches.current.size > 20) {
          const keys = Array.from(previousSearches.current.keys());
          if (keys.length > 0) {
            previousSearches.current.delete(keys[0]);
          }
        }
      } catch (error) {
        console.error('Error searching channels:', error);
        
        // Check if it's an API key error
        if (error && typeof error === 'object' && 'type' in error) {
          const apiError = error as { type: string, message: string };
          if (apiError.type === 'no_api_key' || apiError.type === 'auth') {
            setSearchError('No API key available. Please add a YouTube API key in the settings.');
          } else {
            setSearchError(apiError.message || 'Error searching for channels');
          }
        } else if (error instanceof Error) {
          setSearchError(error.message);
        } else {
          setSearchError('An error occurred while searching for channels');
        }
        
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    []
  );

  // Search for YouTube channels
  const searchChannels = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setHasMoreResults(false);
      return;
    }
    
    // Use the debounced search function with default 5 results
    debouncedSearch(query);
  };

  // Show more search results
  const showMoreSearchResults = async () => {
    if (!lastSearchQuery || lastSearchQuery.length < 2) {
      return;
    }
    
    // Search again with more results (10 instead of 5)
    debouncedSearch(lastSearchQuery, 10);
  };

  // Get direct subgroups for a parent
  const getSubgroups = (parentId: string | null): Group[] => {
    // Always return direct subgroups regardless of their isExpanded state
    const directSubgroups = groups.filter(g => g.parentId === parentId);
    
    // Log subgroups for debugging
    if (directSubgroups.length > 0) {
      console.log(`Getting ${directSubgroups.length} subgroups for parent ${parentId || 'ROOT'}`);
    }
    
    return directSubgroups;
  };

  // Get all top-level groups
  const getTopLevelGroups = (): Group[] => {
    const topLevel = groups.filter(g => !g.parentId);
    console.log(`Getting ${topLevel.length} top-level groups`);
    return topLevel;
  };

  // Get a full group tree in hierarchical format
  const getGroupTree = (parentId: string | null = null): Group[] => {
    const directSubgroups = getSubgroups(parentId);
    
    return directSubgroups.map(group => ({
      ...group,
      subgroups: getGroupTree(group.id)
    }));
  };

  // Enhanced function to toggle subgroup expansion
  const toggleSubgroupExpansion = async (groupId: string) => {
    try {
      // Find the group
      const group = groups.find(g => g.id === groupId);
      if (!group) {
        console.error(`Cannot toggle expansion: Group ${groupId} not found`);
        return;
      }
      
      // Log the toggle operation
      console.log(`Toggling expansion for group ${groupId} (${group.name}) from ${group.isExpanded} to ${!group.isExpanded}`);
      
      // Get the group's existing subgroups before toggling
      const existingSubgroups = getSubgroups(groupId);
      console.log(`Group ${groupId} currently has ${existingSubgroups.length} subgroups`);
      
      // Create updated group with toggled isExpanded value
      const updatedGroup = { 
        ...group, 
        isExpanded: !group.isExpanded,
        // Ensure the subgroups are preserved when collapsing
        subgroups: existingSubgroups
      };
      
      // Update state first for immediate UI response
      setGroups(prev => prev.map(g => 
        g.id === groupId ? updatedGroup : g
      ));
      
      try {
        // Save to database with explicitly preserved subgroups
        await dbService.saveGroup(updatedGroup);
        console.log(`Successfully saved expansion state for group ${groupId}`);
        
        // Verify the subgroups are still there after toggling
        const subgroupsAfter = getSubgroups(groupId);
        console.log(`After toggling, group has ${subgroupsAfter.length} subgroups`);
        
        if (existingSubgroups.length !== subgroupsAfter.length) {
          console.warn(`Warning: Subgroup count changed during toggle. Before: ${existingSubgroups.length}, After: ${subgroupsAfter.length}`);
          
          // If subgroups were lost, reload groups from database to restore them
          if (subgroupsAfter.length < existingSubgroups.length) {
            console.log(`Subgroups may have been lost, reloading from database...`);
            await loadGroups();
          }
        }
      } catch (saveError) {
        // If saving fails, revert the UI state change
        console.error('Error saving group expansion state:', saveError);
        setGroups(prev => prev.map(g => 
          g.id === groupId ? group : g
        ));
        
        // Show error to user
        alert(`Failed to update group: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error toggling subgroup expansion:', error);
    }
  };

  // Add multiple channels to a group in a batch (for multi-url operations)
  const addChannelsToGroupBatch = async (groupId: string, channels: Channel[]): Promise<{success: boolean, message: string}> => {
    try {
      // Check if the group exists
      const targetGroup = groups.find(g => g.id === groupId);
      if (!targetGroup) {
        return { success: false, message: 'Group not found' };
      }

      // Filter out channels that already exist in the group
      const newChannels = channels.filter(channel => 
        !targetGroup.channels.some(existing => existing.id === channel.id)
      );

      if (newChannels.length === 0) {
        return { success: false, message: 'All channels already exist in this group' };
      }

      console.log(`[GroupContext] Adding ${newChannels.length} channels to group ${groupId} in batch`);
      
      // Clone the current groups
      const updatedGroups = [...groups];
      const groupIndex = updatedGroups.findIndex(g => g.id === groupId);
      
      if (groupIndex === -1) {
        return { success: false, message: 'Group not found during update' };
      }
      
      // Update the target group with the new channels
      updatedGroups[groupIndex] = {
        ...updatedGroups[groupIndex],
        channels: [...updatedGroups[groupIndex].channels, ...newChannels]
      };
      
      // Save to localStorage and update state
      setGroups(updatedGroups);
      
      // Save to database
      try {
        await dbService.saveGroup(updatedGroups[groupIndex]);
        console.log(`[GroupContext] Saved group ${groupId} with ${updatedGroups[groupIndex].channels.length} channels`);
      } catch (error) {
        console.error('[GroupContext] Error saving group with new channels:', error);
        return { 
          success: false, 
          message: 'Failed to save changes to the database. Please try again.' 
        };
      }
      
      return { 
        success: true, 
        message: `Added ${newChannels.length} new ${newChannels.length === 1 ? 'channel' : 'channels'} to the group` 
      };
    } catch (error) {
      console.error('[GroupContext] Error in addChannelsToGroupBatch:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred during batch add' 
      };
    }
  };

  // Context value
  const value = {
    groups,
    activeGroupId,
    setActiveGroupId,
    addGroup,
    editGroup,
    deleteGroup,
    addChannelToGroup,
    removeChannelFromGroup,
    removeMultipleChannelsFromGroup,
    searchResults,
    searchChannels,
    showMoreSearchResults,
    isSearching,
    hasMoreResults,
    addChannelByUrl,
    searchError,
    loadGroups,
    toggleSubgroupExpansion,
    getSubgroups,
    getTopLevelGroups,
    getGroupTree,
    addChannelsToGroupBatch
  };

  return (
    <GroupContext.Provider value={{
      groups,
      activeGroupId,
      setActiveGroupId,
      addGroup,
      editGroup,
      deleteGroup,
      addChannelToGroup,
      removeChannelFromGroup,
      removeMultipleChannelsFromGroup,
      searchResults,
      searchChannels,
      showMoreSearchResults,
      isSearching,
      hasMoreResults,
      addChannelByUrl,
      searchError,
      loadGroups,
      toggleSubgroupExpansion,
      getSubgroups,
      getTopLevelGroups,
      getGroupTree,
      addChannelsToGroupBatch
    }}>
      {children}
    </GroupContext.Provider>
  );
} 