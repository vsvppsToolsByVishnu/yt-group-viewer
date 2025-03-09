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
  addGroup: (name: string) => Promise<void>;
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
  addChannelByUrl: (groupId: string, url: string) => Promise<{success: boolean, message: string, channel?: Channel}>;
  searchError: string | null;
  loadGroups: () => Promise<void>;
}

// Create the context with default values
const GroupContext = createContext<GroupContextType>({
  groups: [],
  activeGroupId: null,
  setActiveGroupId: () => {},
  addGroup: async () => {},
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
  loadGroups: async () => {}
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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>('');
  const [hasMoreResults, setHasMoreResults] = useState<boolean>(false);

  // Track previous searches to avoid redundant API calls
  const previousSearches = useRef<Map<string, Channel[]>>(new Map());
  const previousUrlFetches = useRef<Map<string, {success: boolean, message: string, channel?: Channel}>>(new Map());
  
  // Add loading state and last load time to prevent repeated calls
  const isLoadingGroups = useRef(false);
  const lastGroupsLoadTime = useRef(0);

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
      
      // Use the new dbService to get groups
      const fetchedGroups = await dbService.getGroups();
      
      // Update state only if component is still mounted
      setGroups(fetchedGroups);
      
      // Set first group as active if there are groups and no active group
      if (fetchedGroups.length > 0 && !activeGroupId) {
        setActiveGroupId(fetchedGroups[0].id);
      }
      
      console.log(`Loaded ${fetchedGroups.length} groups successfully`);
      } catch (error) {
        console.error('Error loading groups:', error);
      } finally {
      isLoadingGroups.current = false;
      }
    };
    
  // Load groups on mount
  useEffect(() => {
    loadGroups();
  }, []);

  // Add a new group
  const addGroup = async (name: string) => {
    try {
    const newGroup: Group = {
        id: crypto.randomUUID(),
        name,
      channels: []
    };
    
      // Save to database using the new dbService
      await dbService.saveGroup(newGroup);
      
      // Update state
      setGroups(prevGroups => [...prevGroups, newGroup]);
      
      // If this is the first group, set it as active
      if (groups.length === 0) {
      setActiveGroupId(newGroup.id);
      }
    } catch (error) {
      console.error('Error adding group:', error);
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

  // Delete a group
  const deleteGroup = async (id: string) => {
    try {
      // Delete from database using the new dbService
      await dbService.deleteGroup(id);
      
      // Update state
      const remainingGroups = groups.filter(group => group.id !== id);
      setGroups(remainingGroups);
      
      // If the active group is deleted, set the first available group as active
      if (activeGroupId === id) {
        setActiveGroupId(remainingGroups.length > 0 ? remainingGroups[0].id : null);
      }
    } catch (error) {
      console.error('Error deleting group:', error);
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
  const addChannelByUrl = async (groupId: string, url: string): Promise<{success: boolean, message: string, channel?: Channel}> => {
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

      // Add the channel to the group
      await addChannelToGroup(groupId, channelDetails);

      const result = { 
        success: true, 
        message: `Channel "${channelDetails.title}" added successfully`, 
        channel: channelDetails 
      };
      
      // Cache the successful result
      previousUrlFetches.current.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error adding channel by URL:', error);
      
      // Handle different error types
      if (error instanceof Error) {
        return { success: false, message: `Error: ${error.message}` };
      } else if (error === null || error === undefined || JSON.stringify(error) === '{}') {
        return { 
          success: false, 
          message: 'An unknown error occurred. Please try again or use a different URL format.' 
        };
      } else {
        const errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
      return { success: false, message: `Error: ${errorMessage}` };
      }
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
    loadGroups
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
      loadGroups
    }}>
      {children}
    </GroupContext.Provider>
  );
} 