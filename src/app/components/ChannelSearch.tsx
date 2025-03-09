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
    
    // Normalize the URL - ensure it has https:// prefix
    let normalizedUrl = urlInput.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    // Additional check: If just a username is provided, convert to full URL
    if (/^@[\w.-]+$/.test(normalizedUrl)) {
      normalizedUrl = `https://youtube.com/${normalizedUrl}`;
      console.log(`Converted username to URL: ${normalizedUrl}`);
    }
    
    // Validate the URL format first
    if (!validateYouTubeUrl(normalizedUrl)) {
      setUrlStatus({ 
        type: 'error', 
        message: 'Please enter a valid YouTube channel URL (e.g., https://youtube.com/@channelname)'
      });
      return;
    }
    
    setIsProcessingUrl(true);
    setUrlStatus({ type: null, message: 'Processing...' });
    setShowAPIKeyWarning(false);
    setShowAPIKeyError(false);
    
    try {
      console.log(`Submitting URL for processing: ${normalizedUrl}`);
      const result = await addChannelByUrl(activeGroupId, normalizedUrl);
      
      if (result.success) {
        setUrlStatus({ type: 'success', message: result.message });
        setUrlInput('');
        // Clear success message after 3 seconds
        setTimeout(() => {
          setUrlStatus({ type: null, message: '' });
        }, 3000);
      } else {
        console.log(`Error returned from addChannelByUrl:`, result.message);
        
        // Check for different types of errors
        if (result.message.includes('No API key available')) {
          setShowAPIKeyWarning(true);
          setApiKeyErrorMessage('YouTube API Key Required');
          setUrlStatus({ type: null, message: '' });
        } else if (result.message.includes('API key') || 
                  result.message.toLowerCase().includes('authentication') ||
                  result.message.toLowerCase().includes('auth')) {
          // This is an API key issue - show the helper
          setShowAPIKeyError(true);
          setApiKeyErrorMessage('YouTube API Key Error');
          setUrlStatus({ type: null, message: '' });
        } else if (result.message.includes('username') || 
                  result.message.includes('channel')) {
          // This is likely a channel resolution error
          setUrlStatus({ 
            type: 'error', 
            message: 'Could not find this YouTube channel. Please verify the URL or try the channel ID format (youtube.com/channel/UC...).'
          });
        } else if (result.message.includes('already exists')) {
          // Channel already exists in the group
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
    } catch (error) {
      console.error('Error adding channel by URL:', error);
      
      // Handle empty error objects
      let errorMessage = 'An unknown error occurred. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Try to extract any available information from the error object
        const errorStr = JSON.stringify(error);
        if (errorStr && errorStr !== '{}') {
          errorMessage = `Error: ${errorStr}`;
        }
      }
      
      // Check for API key errors
      if (errorMessage.includes('API key') || 
          errorMessage.toLowerCase().includes('authentication') ||
          errorMessage.toLowerCase().includes('auth')) {
        setShowAPIKeyError(true);
        setApiKeyErrorMessage('YouTube API Key Error');
        setUrlStatus({ type: null, message: '' });
      } else if (errorMessage.includes('No API key available')) {
        setShowAPIKeyWarning(true);
        setApiKeyErrorMessage('YouTube API Key Required');
        setUrlStatus({ type: null, message: '' });
      } else if (errorMessage.includes('username') || 
                errorMessage.includes('channel')) {
        // This is likely a channel resolution error 
        setUrlStatus({ 
          type: 'error', 
          message: 'Could not find this YouTube channel. Please verify the URL or try the channel ID format.'
        });
      } else {
        setUrlStatus({ 
          type: 'error', 
          message: errorMessage
        });
      }
    } finally {
      setIsProcessingUrl(false);
    }
  };
  
  // Add a channel to the active group
  const handleAddChannel = (channel: Channel) => {
    if (activeGroupId) {
      addChannelToGroup(activeGroupId, channel);
    }
  };
  
  // Remove a channel from the active group
  const handleRemoveChannel = (channelId: string, channelTitle: string) => {
    if (activeGroupId && activeGroup) {
      const confirmMessage = `Are you sure you want to remove "${channelTitle}" from this group?${
        !activeGroup.channels.some(c => c.id === channelId) ? 
          '' : 
          '\n\nIf this channel is not used by any other group, all its data and videos will be deleted.'
      }`;
      
      if (window.confirm(confirmMessage)) {
        removeChannelFromGroup(activeGroupId, channelId);
      }
    }
  };
  
  // Effect to show channels list when there's an active group
  useEffect(() => {
    if (activeGroupId) {
      setShowChannelsList(true);
      // Reset selected channels when switching groups
      setSelectedChannels([]);
    } else {
      setShowChannelsList(false);
    }
  }, [activeGroupId]);

  // Toggle channel selection for multiple deletion
  const toggleChannelSelection = (channelId: string) => {
    setSelectedChannels(prev => 
      prev.includes(channelId) 
        ? prev.filter(id => id !== channelId) 
        : [...prev, channelId]
    );
  };

  // Handle deletion of multiple selected channels
  const handleDeleteSelectedChannels = async () => {
    if (!activeGroupId || !activeGroup || selectedChannels.length === 0) return;

    // Get channel names for confirmation message
    const channelNames = selectedChannels.map(id => {
      const channel = activeGroup.channels.find(c => c.id === id);
      return channel ? channel.title : id;
    });

    // Build confirmation message
    const confirmMessage = `Are you sure you want to remove ${selectedChannels.length} channel${selectedChannels.length > 1 ? 's' : ''}?\n\n${
      channelNames.slice(0, 3).join(', ') + (channelNames.length > 3 ? ` and ${channelNames.length - 3} more...` : '')
    }\n\nChannels not used by other groups will have all their data and videos deleted.`;

    // Confirm with user
    if (window.confirm(confirmMessage)) {
      setIsDeleting(true);
      
      try {
        // Make a copy of the selected channels to avoid issues with state updates during deletion
        const channelsToDelete = [...selectedChannels];
        console.log(`Starting batch deletion of ${channelsToDelete.length} channels`);
        
        // Use the batch deletion function instead of deleting channels one by one
        await removeMultipleChannelsFromGroup(activeGroupId, channelsToDelete);
        
        console.log(`Completed batch deletion of all ${channelsToDelete.length} channels`);
      } catch (error) {
        console.error('Error removing multiple channels:', error);
      } finally {
        setIsDeleting(false);
        setSelectedChannels([]);
      }
    }
  };

  // If there's no active group, show a message
  if (!activeGroupId) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        <p>No group selected. Please select a group to manage channels.</p>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-800">
      <AnimatePresence mode="wait">
        {showAPIKeyWarning ? (
          <APIKeyWarning message={apiKeyErrorMessage} />
        ) : showAPIKeyError ? (
          <APIKeyErrorHelper message={apiKeyErrorMessage} />
        ) : activeGroup && (
          <motion.div
            key="channel-search"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-lg font-semibold mb-3 flex items-center">
              <span className="mr-2">{activeGroup.name}</span>
              <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs px-2 py-0.5 rounded-full">
                {activeGroup.channels.length} channels
              </span>
            </h2>
            
            {/* Add by URL Form */}
            <form 
              onSubmit={handleUrlSubmit}
              className="mb-6"
              // Add extra protection against form submission refreshing the page
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUrlSubmit(e);
                }
              }}
            >
              <h3 className="font-medium text-sm mb-2">Add Channel by URL</h3>
              <div className="flex items-center mb-2">
                <input
                  type="text"
                  placeholder="https://youtube.com/@channelname"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l-lg bg-background"
                  disabled={isProcessingUrl}
                />
                <button
                  type="button" // Changed from "submit" to "button" for better control
                  onClick={handleUrlSubmit}
                  className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-r-lg flex items-center"
                  disabled={isProcessingUrl || !urlInput.trim()}
                >
                  {isProcessingUrl ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* URL Status Message */}
              <AnimatePresence>
                {urlStatus.message && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mt-2 text-sm p-2 rounded ${
                      urlStatus.type === 'error' 
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
                        : urlStatus.type === 'success' 
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {urlStatus.message}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
            
            {/* Search Form */}
            <form 
              onSubmit={handleSearchSubmit} 
              className="mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (searchQuery.length > 0) {
                    searchChannels(searchQuery);
                  }
                }
              }}
            >
              <h3 className="font-medium text-sm mb-2">Search for Channels</h3>
              <div className="flex items-center">
                <input
                  type="text"
                  placeholder="Search for YouTube channels..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l-lg bg-background"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (searchQuery.length > 0) {
                      searchChannels(searchQuery);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-r-lg"
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* Search Error */}
              <AnimatePresence>
                {searchError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 p-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-md text-sm"
                  >
                    {searchError}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
            
            {/* Toggle Channels List */}
            <button
              onClick={() => setShowChannelsList(!showChannelsList)}
              className="flex items-center justify-between w-full p-2 bg-gray-100 dark:bg-gray-800 rounded-lg mb-3"
            >
              <span className="font-medium">
                {showChannelsList ? 'Hide' : 'Show'} Channels in this Group
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 transform transition-transform ${showChannelsList ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Group Channels List */}
            <AnimatePresence>
              {showChannelsList && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">Channels in this group:</h3>
                    {selectedChannels.length > 0 && (
                      <button
                        onClick={handleDeleteSelectedChannels}
                        disabled={isDeleting}
                        className="px-2 py-1 bg-red-600 text-white rounded-md text-xs flex items-center gap-1 hover:bg-red-700 transition-colors"
                      >
                        {isDeleting ? (
                          <>
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete Selected ({selectedChannels.length})</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6">
                    {activeGroup.channels.length === 0 ? (
                      <li className="text-gray-500 dark:text-gray-400 text-sm py-2 text-center">
                        No channels in this group yet
                      </li>
                    ) : (
                      activeGroup.channels.map(channel => (
                        <motion.li
                          key={channel.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                        >
                          <div className="flex items-center">
                            <div className="flex items-center mr-2">
                              <input
                                type="checkbox"
                                id={`channel-${channel.id}`}
                                checked={selectedChannels.includes(channel.id)}
                                onChange={() => toggleChannelSelection(channel.id)}
                                className="form-checkbox h-4 w-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                              />
                            </div>
                            <div className="w-10 h-10 relative overflow-hidden rounded-full mr-3 flex-shrink-0">
                              <Image
                                src={channel.thumbnailUrl}
                                alt={channel.title}
                                width={40}
                                height={40}
                                className="object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'https://placehold.co/40x40/red/white?text=YT';
                                }}
                              />
                            </div>
                            <div>
                              <h4 className="font-medium text-sm flex items-center">
                                {channel.title}
                                <a 
                                  href={`https://youtube.com/channel/${channel.id}`} 
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </h4>
                              {channel.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                  {channel.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveChannel(channel.id, channel.title)}
                            className="text-red-500 hover:text-red-700 p-1"
                            aria-label={`Remove ${channel.title}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </motion.li>
                      ))
                    )}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium text-sm mb-2">Search Results:</h3>
                <ul className="space-y-2">
                  {searchResults.map(channel => {
                    const isChannelInGroup = activeGroup.channels.some(c => c.id === channel.id);
                    
                    return (
                      <motion.li
                        key={channel.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                      >
                        <div className="flex items-start">
                          <div className="w-10 h-10 relative overflow-hidden rounded-full mr-3 flex-shrink-0">
                            <Image
                              src={channel.thumbnailUrl}
                              alt={channel.title}
                              width={40}
                              height={40}
                              className="object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'https://placehold.co/40x40/red/white?text=YT';
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm flex items-center">
                              {channel.title}
                              <a 
                                href={`https://youtube.com/channel/${channel.id}`} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </h4>
                            {channel.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                {channel.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddChannel(channel)}
                          disabled={isChannelInGroup}
                          className={`flex-shrink-0 ml-2 p-1 rounded-full ${
                            isChannelInGroup 
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 cursor-not-allowed'
                              : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                          }`}
                          aria-label={isChannelInGroup ? 'Already in group' : `Add ${channel.title}`}
                        >
                          {isChannelInGroup ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
                
                {/* Show More Button */}
                {hasMoreResults && (
                  <div className="flex justify-center mt-3">
                    <button
                      onClick={() => showMoreSearchResults()}
                      disabled={isSearching}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-md text-sm font-medium transition-colors duration-200 ease-in-out"
                    >
                      {isSearching ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Loading more...
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Show More
                        </div>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 