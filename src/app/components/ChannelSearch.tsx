"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGroupContext } from '../context/GroupContext';
import { Channel } from '../types';
import Image from 'next/image';
import APIKeyWarning from './APIKeyWarning';
import APIKeyErrorHelper from './APIKeyErrorHelper';

export default function ChannelSearch() {
  const {
    groups,
    activeGroupId,
    searchChannels,
    searchResults,
    isSearching,
    addChannelToGroup,
    removeChannelFromGroup,
    removeMultipleChannelsFromGroup,
    addChannelByUrl,
    addChannelsToGroupBatch,
    searchError,
    hasMoreResults,
    showMoreSearchResults
  } = useGroupContext();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showChannelsList, setShowChannelsList] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  const [urlStatus, setUrlStatus] = useState<{ type: 'error' | 'success' | null; message: string }>({ 
    type: null, 
    message: '' 
  });
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showAPIKeyWarning, setShowAPIKeyWarning] = useState(false);
  const [showAPIKeyError, setShowAPIKeyError] = useState(false);
  const [apiKeyErrorMessage, setApiKeyErrorMessage] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Get the active group
  const activeGroup = groups.find(group => group.id === activeGroupId);
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery && debouncedSearchQuery.length >= 2) {
      searchChannels(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, searchChannels]);
  
  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.length > 0) {
      searchChannels(searchQuery);
    }
  };
  
  // Validate YouTube URL
  const validateYouTubeUrl = (url: string): boolean => {
    try {
      // First try to create URL object to verify it's a valid URL
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Validate hostname
      const validHostnames = [
        'youtube.com',
        'www.youtube.com',
        'youtu.be',
        'www.youtu.be'
      ];
      
      if (!validHostnames.includes(hostname)) {
        return false;
      }
      
      // Validate path format
      const pathname = urlObj.pathname;
      
      // Direct channel ID format: /channel/UC...
      if (pathname.includes('/channel/')) {
        const parts = pathname.split('/');
        const index = parts.findIndex(part => part === 'channel');
        return index >= 0 && parts.length > index + 1 && parts[index + 1].length > 0;
      }
      
      // Username format: /@username
      if (pathname.includes('/@')) {
        const username = pathname.split('/@')[1]?.split('/')[0];
        return !!username && username.length > 0;
      }
      
      // Custom URL format: /c/customname
      if (pathname.includes('/c/')) {
        const customName = pathname.split('/c/')[1]?.split('/')[0];
        return !!customName && customName.length > 0;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  };
  
  // Handle URL input submission
  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeGroupId) return;

    setIsProcessingUrl(true);
    setUrlStatus({ type: null, message: 'Processing...' });
    setShowAPIKeyWarning(false);
    setShowAPIKeyError(false);
    
    // Parse the input to handle multiple URLs
    const input = urlInput.trim();
    
    // First, log the raw input for debugging
    console.log(`Raw URL input: "${input}"`);
    
    // Split the input by commas and properly handle spaces
    let urls: string[] = [];
    if (input.includes(',')) {
      urls = input.split(',')
        .map(url => url.trim()) // Trim each URL to remove spaces before and after
        .filter(url => url.length > 0); // Remove any empty entries
      
      console.log(`Split URLs (${urls.length}):`, urls);
    } else {
      // No commas, treat as a single URL
      urls = [input];
    }
    
    // Make sure we have at least one URL to process
    if (urls.length === 0) {
      setUrlStatus({ 
        type: 'error', 
        message: 'Please enter at least one valid YouTube URL' 
      });
      setIsProcessingUrl(false);
      return;
    }
    
    console.log(`Processing ${urls.length} URLs: ${urls.join(' | ')}`);
    
    // Track results and collect channels for batch addition
    const results: {
      success: boolean;
      url: string;
      message: string;
      channel?: Channel;
    }[] = [];
    
    // Collect all the channels to add in a batch
    const channelsToAdd: Channel[] = [];
    
    // Process each URL
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      
      // Skip empty URLs
      if (!url.trim()) continue;
      
      console.log(`Processing URL ${i+1}/${urls.length}: "${url}"`);
      
      // Normalize the URL - ensure it has https:// prefix
      let normalizedUrl = url.trim();
      
      // Remove /videos, /featured, or other page-specific suffixes
      if (normalizedUrl.includes('/videos')) {
        normalizedUrl = normalizedUrl.replace('/videos', '');
      }
      
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      
      // Additional check: If just a username is provided, convert to full URL
      if (/^@[\w.-]+$/.test(normalizedUrl)) {
        normalizedUrl = `https://youtube.com/${normalizedUrl}`;
        console.log(`Converted username to URL: ${normalizedUrl}`);
      }
      
      // Validate the URL format
      if (!validateYouTubeUrl(normalizedUrl)) {
        console.log(`Invalid URL format: ${normalizedUrl}`);
        results.push({
          success: false,
          url: normalizedUrl,
          message: `Invalid YouTube URL: ${url}`
        });
        continue;
      }
      
      try {
        console.log(`Submitting URL for processing: ${normalizedUrl}`);
        
        // IMPORTANT CHANGE: Instead of adding the channel immediately,
        // First get the channel details without adding it to the group
        const result = await addChannelByUrl(activeGroupId, normalizedUrl, true); // Pass true to only retrieve channel without adding
        
        console.log(`Result for ${normalizedUrl}:`, result);
        
        // If successful, collect the channel for batch addition
        if (result.success && result.channel) {
          channelsToAdd.push(result.channel);
        }
        
        results.push({
          success: result.success,
          url: normalizedUrl,
          message: result.message,
          channel: result.channel
        });
      } catch (error) {
        console.error(`Error adding channel by URL (${normalizedUrl}):`, error);
        
        // Handle empty error objects
        let errorMessage = 'An unknown error occurred. Please try again.';
        
        if (error instanceof Error) {
          errorMessage = error.message || errorMessage;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          const errorStr = JSON.stringify(error);
          if (errorStr && errorStr !== '{}') {
            errorMessage = `Error: ${errorStr}`;
          }
        }
        
        results.push({
          success: false,
          url: normalizedUrl,
          message: errorMessage
        });
      }
      
      // Add a small delay between requests to prevent network issues
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Now add all collected channels to the group in one operation
    if (channelsToAdd.length > 0) {
      try {
        console.log(`Adding ${channelsToAdd.length} channels to group ${activeGroupId} in one operation`);
        
        // Use the new batch add function
        const batchResult = await addChannelsToGroupBatch(activeGroupId, channelsToAdd);
        console.log('Batch addition result:', batchResult);
        
        if (!batchResult.success) {
          console.warn('Batch addition had issues:', batchResult.message);
        }
      } catch (error) {
        console.error('Error saving channels in batch:', error);
      }
    }
    
    // Handle results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    // Clear input field if at least one channel was added successfully
    if (successCount > 0) {
      setUrlInput('');
    }
    
    // Prepare the status message
    if (results.length === 1) {
      // Single URL processing
      const result = results[0];
      
      if (result.success) {
        setUrlStatus({ type: 'success', message: result.message });
        // Clear success message after 3 seconds
        setTimeout(() => {
          setUrlStatus({ type: null, message: '' });
        }, 3000);
      } else {
        console.log(`Error returned from addChannelByUrl:`, result.message);
        
        // Check for API key errors
        if (result.message.includes('No API key available')) {
          setShowAPIKeyWarning(true);
          setApiKeyErrorMessage('YouTube API Key Required');
          setUrlStatus({ type: null, message: '' });
        } else if (result.message.includes('API key') || 
                  result.message.toLowerCase().includes('authentication') ||
                  result.message.toLowerCase().includes('auth')) {
          setShowAPIKeyError(true);
          setApiKeyErrorMessage('YouTube API Key Error');
          setUrlStatus({ type: null, message: '' });
        } else if (result.message.includes('username') || 
                  result.message.includes('channel')) {
          setUrlStatus({ 
            type: 'error', 
            message: 'Could not find this YouTube channel. Please verify the URL or try the channel ID format.'
          });
        } else if (result.message.includes('already exists')) {
          setUrlStatus({ 
            type: 'error', 
            message: result.message
          });
          
          // Clear error after 3 seconds since it's not a critical error
          setTimeout(() => {
            setUrlStatus({ type: null, message: '' });
          }, 3000);
        } else {
          setUrlStatus({ type: 'error', message: result.message || 'Failed to add channel. Please try again.' });
        }
      }
    } else {
      // Multiple URLs processing
      let statusMessage = '';
      
      if (successCount > 0) {
        statusMessage = `Successfully added ${successCount} channel${successCount > 1 ? 's' : ''}`;
        
        if (failureCount > 0) {
          statusMessage += ` (${failureCount} failed)`;
        }
      } else {
        statusMessage = `Failed to add any channels (${failureCount} failed)`;
      }
      
      // Handle API key errors if all failures were related to API keys
      const allApiKeyErrors = failureCount > 0 && results.filter(r => !r.success).every(r => 
        r.message.includes('API key') || 
        r.message.toLowerCase().includes('authentication') ||
        r.message.toLowerCase().includes('auth')
      );
      
      if (allApiKeyErrors) {
        setShowAPIKeyError(true);
        setApiKeyErrorMessage('YouTube API Key Error');
        setUrlStatus({ type: null, message: '' });
      } else {
        setUrlStatus({ 
          type: successCount > 0 ? 'success' : 'error', 
          message: statusMessage
        });
        
        // Clear status message after 5 seconds (longer for multiple channels)
        setTimeout(() => {
          setUrlStatus({ type: null, message: '' });
        }, 5000);
      }
      
      // Log detailed results for debugging
      console.log('Multiple URL processing results:', results);
    }
    
    setIsProcessingUrl(false);
  };
  
  // Add a channel to the active group
  const handleAddChannel = (channel: Channel) => {
    if (activeGroupId) {
      addChannelToGroup(activeGroupId, channel);
    }
  };
  
  // Remove a channel from the active group
  const handleRemoveChannel = (channelId: string, channelTitle: string) => {
    if (activeGroupId) {
      if (window.confirm(`Remove "${channelTitle}" from this group?`)) {
        removeChannelFromGroup(activeGroupId, channelId);
      }
    }
  };
  
  // Handle toggle selection of channel for bulk operations
  const handleToggleSelect = (channelId: string) => {
    if (selectedChannels.includes(channelId)) {
      setSelectedChannels(selectedChannels.filter(id => id !== channelId));
    } else {
      setSelectedChannels([...selectedChannels, channelId]);
    }
  };
  
  // Handle bulk deletion of channels
  const handleBulkDelete = async () => {
    if (!activeGroupId || selectedChannels.length === 0) return;
    
    if (window.confirm(`Remove ${selectedChannels.length} selected channel${selectedChannels.length > 1 ? 's' : ''}?`)) {
      setIsDeleting(true);
      
      try {
        await removeMultipleChannelsFromGroup(activeGroupId, selectedChannels);
        setSelectedChannels([]);
      } catch (error) {
        console.error('Error removing channels:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };
  
  // Toggle showing active group's channels
  const toggleChannelsList = () => {
    setShowChannelsList(!showChannelsList);
  };
  
  // Search results display
  const renderSearchResults = () => {
    if (searchError) {
      if (searchError.includes('API key')) {
        return (
          <div className="mt-4 text-center">
            <APIKeyErrorHelper />
          </div>
        );
      }
      return <div className="mt-4 text-red-500">{searchError}</div>;
    }
    
    if (isSearching) {
      return <div className="mt-4 text-center">Searching...</div>;
    }
    
    if (searchResults.length === 0 && debouncedSearchQuery.length > 0) {
      return <div className="mt-4 text-center">No channels found</div>;
    }
    
    return (
      <div className="mt-4 space-y-3">
        {searchResults.map(channel => {
          // Check if channel is already in the active group
          const isInGroup = activeGroup?.channels.some(c => c.id === channel.id) || false;
          
          return (
            <div key={channel.id} className="flex items-center bg-white dark:bg-gray-800 rounded-lg p-3 shadow">
              <div className="flex-shrink-0">
                {channel.thumbnailUrl ? (
                  <Image 
                    src={channel.thumbnailUrl} 
                    alt={channel.title} 
                    width={48} 
                    height={48} 
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-gray-500 dark:text-gray-400">No img</span>
                  </div>
                )}
              </div>
              <div className="ml-3 flex-grow overflow-hidden">
                <h4 className="font-medium truncate">{channel.title}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {channel.description ? channel.description : 'No description available'}
                </p>
              </div>
              <div className="ml-2">
                {isInGroup ? (
                  <button 
                    className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md text-sm"
                    disabled
                  >
                    Added
                  </button>
                ) : (
                  <button 
                    onClick={() => handleAddChannel(channel)}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm transition-colors"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
        
        {hasMoreResults && (
          <div className="text-center mt-4">
            <button 
              onClick={showMoreSearchResults}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Show More
            </button>
          </div>
        )}
      </div>
    );
  };
  
  // Component for group's channels list
  const renderGroupChannels = () => {
    if (!activeGroup) {
      return <div className="text-center text-gray-500 dark:text-gray-400 mt-4">No group selected</div>;
    }
    
    if (activeGroup.channels.length === 0) {
      return <div className="text-center text-gray-500 dark:text-gray-400 mt-4">No channels in this group</div>;
    }
    
    return (
      <div className="mt-4 space-y-3">
        {selectedChannels.length > 0 && (
          <div className="flex justify-between items-center mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
            <span className="text-sm font-medium">
              {selectedChannels.length} channel{selectedChannels.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm transition-colors disabled:bg-red-300 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Removing...' : 'Remove Selected'}
            </button>
          </div>
        )}
        
        {activeGroup.channels.map(channel => (
          <div key={channel.id} className="flex items-center bg-white dark:bg-gray-800 rounded-lg p-3 shadow">
            <div className="flex-shrink-0 mr-2">
              <input
                type="checkbox"
                checked={selectedChannels.includes(channel.id)}
                onChange={() => handleToggleSelect(channel.id)}
                className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
              />
            </div>
            <div className="flex-shrink-0">
              {channel.thumbnailUrl ? (
                <Image 
                  src={channel.thumbnailUrl} 
                  alt={channel.title} 
                  width={48} 
                  height={48} 
                  className="rounded-full"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-gray-500 dark:text-gray-400">No img</span>
                </div>
              )}
            </div>
            <div className="ml-3 flex-grow overflow-hidden">
              <h4 className="font-medium truncate">{channel.title}</h4>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {channel.description ? channel.description : 'No description available'}
                </p>
                <a 
                  href={`https://youtube.com/channel/${channel.id}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Visit
                </a>
              </div>
            </div>
            <div className="ml-2">
              <button 
                onClick={() => handleRemoveChannel(channel.id, channel.title)}
                className="p-1.5 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900 transition-colors"
                title="Remove channel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      {/* Group channel management */}
      {activeGroup && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">
              {activeGroup.name} ({activeGroup.channels.length} channels)
            </h3>
            <button 
              onClick={toggleChannelsList}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm flex items-center"
            >
              {showChannelsList ? 'Hide Channels' : 'Show Channels'}
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 transition-transform ${showChannelsList ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <AnimatePresence>
            {showChannelsList && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {renderGroupChannels()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      
      {/* URL input */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
        <h3 className="text-lg font-medium mb-3">Add Channel by URL</h3>
        
        {showAPIKeyWarning && (
          <APIKeyWarning message={apiKeyErrorMessage} />
        )}
        
        {showAPIKeyError && (
          <APIKeyErrorHelper message={apiKeyErrorMessage} />
        )}
        
        <form onSubmit={handleUrlSubmit} className="space-y-3">
          <div>
            <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              YouTube Channel URL
            </label>
            <div className="relative">
              <input
                id="url-input"
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/@ChannelName or multiple URLs separated by commas"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isProcessingUrl || !activeGroupId}
              />
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Supported formats: youtube.com/@username, youtube.com/c/customname, youtube.com/channel/UC...
            </p>
          </div>
          
          {urlStatus.message && (
            <div className={`p-2 rounded-md text-sm ${
              urlStatus.type === 'error' 
                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' 
                : urlStatus.type === 'success'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {urlStatus.message}
            </div>
          )}
          
          <div>
            <button
              type="submit"
              disabled={isProcessingUrl || !activeGroupId || !urlInput.trim()}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessingUrl ? 'Processing...' : 'Add Channel'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Channel search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
        <h3 className="text-lg font-medium mb-3">Search for Channels</h3>
        
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div>
            <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Channel Name
            </label>
            <div className="relative">
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search for YouTube channels"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isSearching || !activeGroupId}
              />
              <button
                type="submit"
                disabled={isSearching || !activeGroupId || searchQuery.length < 2}
                className="absolute right-2 top-2 p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>
          
          {renderSearchResults()}
        </form>
      </div>
    </div>
  );
} 