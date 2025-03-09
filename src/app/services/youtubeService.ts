import { Channel, Video } from '../types';
import * as dbService from './dbService';

// Base URL for YouTube API
const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Error types to handle different API failures
type ErrorType = 'auth' | 'quota' | 'network' | 'unknown' | 'no_api_key';

interface ApiError {
  type: ErrorType;
  message: string;
}

// Cache types
const CACHE_TYPES = {
  CHANNEL: 'channel',
  USERNAME_TO_ID: 'username_to_id',
  SEARCH: 'search',
  VIDEOS: 'videos',
  URL_TO_ID: 'url_to_id'
};

// Main YouTube API service class
class YouTubeApiService {
  private apiKey: string | null = null;
  private readonly cacheExpiryTime = 1000 * 60 * 60; // 1 hour in milliseconds
  private lastRequestTime = 0;
  private minRequestInterval = 100; // 100ms minimum between requests
  
  // Initialize the service with an API key
  async initialize(): Promise<boolean> {
    try {
      // Check if we already have a valid API key
      if (this.apiKey) {
        return true;
      }
      
      // Use the new dbService instead of the old getWorkingAPIKey function
      this.apiKey = await dbService.getWorkingAPIKey();
      
      if (!this.apiKey) {
        console.error('No API key available');
        return false;
      }
      
      // Validate API key with a simple test call - only if we don't already have a validated key
      const testUrl = `${API_BASE_URL}/videos?part=snippet&id=dQw4w9WgXcQ&key=${this.apiKey}`;
      try {
        const response = await fetch(testUrl);
        const data = await response.json();
        
        if (response.ok) {
          console.log('API key validated successfully');
          return true;
        } else if (data.error && data.error.message) {
          console.error(`API key validation failed: ${data.error.message}`);
          throw this.createError('auth', `API key validation failed: ${data.error.message}`);
        } else {
          console.error('API key validation failed with unknown error');
          return false;
        }
      } catch (validationError) {
        console.error('Error validating API key:', validationError);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize YouTube API service:', error);
      return false;
    }
  }
  
  // Helper to throttle requests to avoid hitting rate limits
  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }
  
  // Execute an API request with error handling and key fallback
  private async executeRequest(url: string): Promise<any> {
    if (!this.apiKey) {
      if (!(await this.initialize())) {
        throw this.createError('no_api_key', 'No API key available. Please add a YouTube API key in the settings.');
      }
    }
    
    // Apply throttling to avoid excessive requests
    await this.throttleRequest();
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('YouTube API error response:', errorData);
        
        // Handle different error types
        if (response.status === 403) {
          if (errorData.error?.errors?.[0]?.reason === 'quotaExceeded') {
            throw this.createError('quota', 'API quota exceeded. Try again later or add another API key.');
          } else if (errorData.error?.message?.includes('API key')) {
            // If there's an API key error, try to reinitialize with a new key
            console.log('API key error detected, trying to reinitialize...');
            this.apiKey = null; // Force re-initialization on next request
            throw this.createError('auth', `Authentication failed: ${errorData.error?.message || 'Invalid API key'}`);
          } else {
            throw this.createError('auth', 'Authentication failed. Please check your API key.');
          }
        } else if (response.status === 404) {
          return null;
        } else {
          throw this.createError('unknown', `API Error: ${errorData.error?.message || 'Unknown error'}`);
        }
      }
      
      return await response.json();
    } catch (error) {
      if ((error as ApiError).type) {
        throw error;
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        throw this.createError('network', 'Network error. Please check your internet connection.');
      } else {
        throw this.createError('unknown', `Unexpected error: ${(error as Error).message}`);
      }
    }
  }
  
  // Helper to create error objects
  private createError(type: ErrorType, message: string): ApiError {
    return { type, message };
  }
  
  // Search for channels by keyword
  async searchChannels(query: string, maxResults: number = 5): Promise<Channel[]> {
    if (!query) return [];
    
    // Check cache first
    const cacheKey = `search:${query}:${maxResults}`;
    try {
      const cachedResult = await dbService.getCacheEntry<Channel[]>(cacheKey, CACHE_TYPES.SEARCH);
      
      if (cachedResult) {
        console.log(`Using cached search results for "${query}" with ${maxResults} results`);
        return cachedResult;
      }
    } catch (error) {
      console.error('Error checking search cache:', error);
    }
    
    const url = `${API_BASE_URL}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${this.apiKey}`;
    
    try {
      const data = await this.executeRequest(url);
      if (!data || !data.items) return [];
      
      const results = data.items.map((item: any) => ({
        id: item.id.channelId,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails.default.url,
        description: item.snippet.description
      }));
      
      // Cache the results
      try {
        await dbService.setCacheEntry(cacheKey, results, CACHE_TYPES.SEARCH);
        
        // Also cache individual channels
        for (const channel of results) {
          await dbService.setCacheEntry(channel.id, channel, CACHE_TYPES.CHANNEL);
        }
      } catch (cacheError) {
        console.error('Error caching search results:', cacheError);
      }
      
      return results;
    } catch (error) {
      console.error('Error searching channels:', error);
      throw error;
    }
  }
  
  // Get channel details by ID
  async getChannelById(channelId: string): Promise<Channel | null> {
    if (!channelId) return null;
    
    // Check cache first
    try {
      const cachedChannel = await dbService.getCacheEntry<Channel>(channelId, CACHE_TYPES.CHANNEL);
      
      if (cachedChannel) {
        console.log(`Using cached channel data for ID: ${channelId}`);
        return cachedChannel;
      }
    } catch (error) {
      console.error('Error checking channel cache:', error);
    }
    
    const url = `${API_BASE_URL}/channels?part=snippet&id=${channelId}&key=${this.apiKey}`;
    
    try {
      const data = await this.executeRequest(url);
      if (!data || !data.items || data.items.length === 0) return null;
      
      const channel = data.items[0];
      const result = {
        id: channel.id,
        title: channel.snippet.title,
        thumbnailUrl: channel.snippet.thumbnails.default.url,
        description: channel.snippet.description
      };
      
      // Cache the result
      try {
        await dbService.setCacheEntry(channelId, result, CACHE_TYPES.CHANNEL);
      } catch (cacheError) {
        console.error('Error caching channel:', cacheError);
      }
      
      return result;
    } catch (error) {
      console.error('Error getting channel by ID:', error);
      throw error;
    }
  }
  
  // Get channel details by username
  async getChannelByUsername(username: string): Promise<Channel | null> {
    if (!username) {
      console.error('Empty username provided');
      return null;
    }
    
    // Remove @ symbol if present
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    console.log(`Processing username: ${cleanUsername}`);
    
    // Check if we have this username cached
    const cacheKey = `username:${cleanUsername.toLowerCase()}`;
    try {
      const cachedChannelId = await dbService.getCacheEntry<string>(cacheKey, CACHE_TYPES.USERNAME_TO_ID);
      
      if (cachedChannelId) {
        console.log(`Found cached channel ID for username: ${cleanUsername}`);
        return this.getChannelById(cachedChannelId);
      }
    } catch (error) {
      console.error('Error checking username cache:', error);
    }
    
    try {
      // For all username types, search is the most reliable method
      // The YouTube API doesn't reliably handle @usernames with forUsername
      const searchTerm = username.startsWith('@') ? username : `@${cleanUsername}`;
      console.log(`Searching for channel with term: ${searchTerm}`);
      
      // Use the search endpoint which works better for usernames
      const url = `${API_BASE_URL}/search?part=snippet&type=channel&q=${encodeURIComponent(searchTerm)}&maxResults=5&key=${this.apiKey}`;
      
      const data = await this.executeRequest(url);
      
      if (!data || !data.items || data.items.length === 0) {
        console.log(`No search results for ${searchTerm}`);
        throw new Error(`No channels found for username: ${username}`);
      }
      
      // Try to find the best match - look for the username in the title or description
      let bestMatch = data.items[0]; // Default to first result
      
      for (const item of data.items) {
        const channelTitle = item.snippet.title.toLowerCase();
        const channelDescription = (item.snippet.description || '').toLowerCase();
        
        // Check if the username appears in title or description
        if (channelTitle.includes(cleanUsername.toLowerCase()) || 
            channelDescription.includes(cleanUsername.toLowerCase()) ||
            channelDescription.includes(`@${cleanUsername}`.toLowerCase())) {
          
          console.log(`Found likely match: ${item.snippet.title}`);
          bestMatch = item;
          break;
        }
      }
      
      // Get the channel ID from the search result
      const channelId = bestMatch.id.channelId;
      
      // Cache the username to channel ID mapping
      try {
        await dbService.setCacheEntry(cacheKey, channelId, CACHE_TYPES.USERNAME_TO_ID);
      } catch (cacheError) {
        console.error('Error caching username mapping:', cacheError);
      }
      
      // Get full channel details using the channel ID
      return await this.getChannelById(channelId);
    } catch (error) {
      console.error('Error in getChannelByUsername:', error);
      if (error instanceof Error) {
        throw error; // Rethrow the existing error
      } else {
        throw new Error(`Error getting channel by username: ${JSON.stringify(error)}`);
      }
    }
  }
  
  // Get videos from a specific channel
  async getVideosFromChannel(channelId: string, maxResults: number = 10): Promise<Video[]> {
    if (!channelId) return [];
    
    // Check cache first
    const cacheKey = `videos:${channelId}:${maxResults}`;
    try {
      const cachedVideos = await dbService.getCacheEntry<Video[]>(cacheKey, CACHE_TYPES.VIDEOS);
      
      if (cachedVideos) {
        console.log(`Using cached videos for channel: ${channelId}`);
        return cachedVideos;
      }
    } catch (error) {
      console.error('Error checking videos cache:', error);
    }
    
    // First, we need to get the upload playlist ID for the channel
    const channelUrl = `${API_BASE_URL}/channels?part=contentDetails&id=${channelId}&key=${this.apiKey}`;
    
    try {
      const channelData = await this.executeRequest(channelUrl);
      if (!channelData || !channelData.items || channelData.items.length === 0) return [];
      
      const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
      
      // Now, get the videos from the uploads playlist
      const playlistUrl = `${API_BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${this.apiKey}`;
      
      const playlistData = await this.executeRequest(playlistUrl);
      if (!playlistData || !playlistData.items) return [];
      
      // Get video IDs to fetch additional details (view counts, etc.)
      const videoIds = playlistData.items.map((item: any) => item.contentDetails.videoId).join(',');
      
      // Fetch additional video details
      const videosUrl = `${API_BASE_URL}/videos?part=statistics,snippet&id=${videoIds}&key=${this.apiKey}`;
      
      const videosData = await this.executeRequest(videosUrl);
      if (!videosData || !videosData.items) return [];
      
      // Combine data from both requests
      const results = videosData.items.map((video: any) => {
        const playlistItem = playlistData.items.find((item: any) => 
          item.contentDetails.videoId === video.id
        );
        
        return {
          id: video.id,
          title: video.snippet.title,
          thumbnailUrl: video.snippet.thumbnails.medium.url,
          channelId: video.snippet.channelId,
          channelTitle: video.snippet.channelTitle,
          publishedAt: video.snippet.publishedAt,
          viewCount: video.statistics.viewCount || '0'
        };
      });
      
      // Cache the results
      try {
        await dbService.setCacheEntry(cacheKey, results, CACHE_TYPES.VIDEOS);
        
        // Also save videos to database for offline access
        await dbService.saveVideos(results);
      } catch (cacheError) {
        console.error('Error caching videos:', cacheError);
      }
      
      return results;
    } catch (error) {
      console.error('Error getting videos from channel:', error);
      throw error;
    }
  }
  
  // Get videos from multiple channels (for a group)
  async getVideosFromChannels(channelIds: string[], maxResults: number = 50): Promise<Video[]> {
    if (!channelIds || channelIds.length === 0) return [];
    
    try {
      // Calculate videos per channel (at least 1 per channel)
      const videosPerChannel = Math.max(1, Math.ceil(maxResults / channelIds.length));
      
      // Create a combined cache key
      const sortedIds = [...channelIds].sort();
      const cacheKey = `groupvideos:${sortedIds.join(',')}:${maxResults}`;
      
      // Check cache first
      try {
        const cachedGroupVideos = await dbService.getCacheEntry<Video[]>(cacheKey, CACHE_TYPES.VIDEOS);
        
        if (cachedGroupVideos) {
          console.log(`Using cached videos for channel group`);
          return cachedGroupVideos;
        }
      } catch (error) {
        console.error('Error checking group videos cache:', error);
      }
      
      // Get videos from each channel sequentially to avoid quota issues
      let allVideos: Video[] = [];
      
      // Limit to 5 concurrent requests to prevent overwhelming the API
      const batchSize = 5;
      
      for (let i = 0; i < channelIds.length; i += batchSize) {
        const batch = channelIds.slice(i, i + batchSize);
        const videoPromises = batch.map(channelId => 
          this.getVideosFromChannel(channelId, videosPerChannel)
        );
        
        const batchResults = await Promise.all(videoPromises);
        allVideos = [...allVideos, ...batchResults.flat()];
        
        // Add a small delay between batches
        if (i + batchSize < channelIds.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      // Sort and limit the combined results
      const sortedVideos = allVideos.sort((a, b) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      ).slice(0, maxResults);
      
      // Cache the combined results
      try {
        await dbService.setCacheEntry(cacheKey, sortedVideos, CACHE_TYPES.VIDEOS);
      } catch (cacheError) {
        console.error('Error caching group videos:', cacheError);
      }
      
      return sortedVideos;
    } catch (error) {
      console.error('Error getting videos from channels:', error);
      throw error;
    }
  }
  
  // Get channel ID from a YouTube URL with caching
  async getChannelIdFromUrl(url: string): Promise<string | null> {
    try {
      const urlObj = new URL(url);
      console.log(`Processing YouTube URL: ${url}`);
      
      // Check if we have this URL cached
      const cacheKey = `url:${url}`;
      try {
        const cachedChannelId = await dbService.getCacheEntry<string>(cacheKey, CACHE_TYPES.URL_TO_ID);
        
        if (cachedChannelId) {
          console.log(`Found cached channel ID for URL: ${url}`);
          return cachedChannelId;
        }
      } catch (error) {
        console.error('Error checking URL cache:', error);
      }
      
      let channelId: string | null = null;
      
      // Direct channel URL (youtube.com/channel/UC...)
      if (urlObj.pathname.includes('/channel/')) {
        const parts = urlObj.pathname.split('/');
        const index = parts.findIndex(part => part === 'channel');
        if (index >= 0 && parts.length > index + 1) {
          channelId = parts[index + 1];
          console.log(`Found channel ID in URL: ${channelId}`);
        }
      }
      // Handle username URLs (youtube.com/@username)
      else if (urlObj.pathname.includes('/@')) {
        try {
          const username = urlObj.pathname.split('/@')[1].split('/')[0];
          console.log(`Found @username format: ${username}`);
          
          // First check if we can get a channel directly using search
          const channel = await this.getChannelByUsername(username);
          
          if (channel && channel.id) {
            console.log(`Successfully found channel ID: ${channel.id} for username: ${username}`);
            channelId = channel.id;
          } else {
            console.log(`No channel found for username: ${username}`);
            throw new Error(`Could not find channel for username: ${username}`);
          }
        } catch (usernameError) {
          console.error(`Error resolving username:`, usernameError);
          if (usernameError instanceof Error) {
            throw usernameError;
          } else {
            throw new Error(`Error resolving username: ${JSON.stringify(usernameError)}`);
          }
        }
      }
      // Handle custom URLs (youtube.com/c/customname)
      else if (urlObj.pathname.includes('/c/')) {
        try {
          const customName = urlObj.pathname.split('/c/')[1].split('/')[0];
          console.log(`Found custom URL format: ${customName}`);
          
          // For custom URLs, search is the most reliable method
          const searchResults = await this.searchChannels(customName);
          
          if (searchResults && searchResults.length > 0) {
            console.log(`Found channel via custom URL search: ${searchResults[0].title}`);
            channelId = searchResults[0].id;
          } else {
            throw new Error(`No channel found for custom URL: ${customName}`);
          }
        } catch (customUrlError) {
          console.error(`Error resolving custom URL:`, customUrlError);
          if (customUrlError instanceof Error) {
            throw customUrlError;
          } else {
            throw new Error(`Error resolving custom URL: ${JSON.stringify(customUrlError)}`);
          }
        }
      }
      
      if (channelId) {
        // Cache the result for future requests
        try {
          await dbService.setCacheEntry(cacheKey, channelId, CACHE_TYPES.URL_TO_ID);
        } catch (cacheError) {
          console.error('Error caching URL mapping:', cacheError);
        }
        return channelId;
      }
      
      // If we reach here, we couldn't parse a channel ID from the URL
      throw new Error(`Could not parse channel information from URL: ${url}`);
    } catch (error) {
      console.error('Error parsing YouTube URL:', error);
      if (error instanceof Error) {
        throw error; // Rethrow the existing error with its stack trace
      } else {
        throw new Error(`Error parsing YouTube URL: ${JSON.stringify(error)}`);
      }
    }
  }
  
  // Clear the cache
  async clearCache(): Promise<void> {
    try {
      await dbService.clearCache();
      console.log('Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

// Create and export a singleton instance
const youtubeService = new YouTubeApiService();
export default youtubeService; 