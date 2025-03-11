"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import VideoCard from './VideoCard';
import { Video } from '../types';
import { useGroupContext } from '../context/GroupContext';
import youtubeService from '../services/youtubeService';
import APIKeyWarning from './APIKeyWarning';

interface VideoGridProps {
  filterOption?: 'latest' | '3days' | '7days' | 'all';
  sortOption?: 'date' | 'views';
}

export default function VideoGrid({ 
  filterOption = 'latest', 
  sortOption = 'date' 
}: VideoGridProps) {
  const { groups, activeGroupId } = useGroupContext();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAPIKeyWarning, setShowAPIKeyWarning] = useState(false);
  
  // Get the active group
  const activeGroup = groups.find(group => group.id === activeGroupId);
  
  // Fetch videos when active group changes or exists
  useEffect(() => {
    const fetchVideos = async () => {
      if (!activeGroup || activeGroup.channels.length === 0) {
        setVideos([]);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      setShowAPIKeyWarning(false);
      
      try {
        // Initialize YouTube service if needed
        const initialized = await youtubeService.initialize();
        if (!initialized) {
          setShowAPIKeyWarning(true);
          setIsLoading(false);
          return;
        }
        
        // Extract channel IDs from the active group
        const channelIds = activeGroup.channels.map(channel => channel.id);
        
        // Fetch videos from these channels
        const fetchedVideos = await youtubeService.getVideosFromChannels(channelIds);
        
        setVideos(fetchedVideos);
      } catch (err) {
        console.error('Error fetching videos:', err);
        
        // Check if this is an API key error
        if (err && typeof err === 'object' && 'type' in err) {
          const apiError = err as { type: string, message: string };
          if (apiError.type === 'no_api_key' || apiError.type === 'auth') {
            setShowAPIKeyWarning(true);
          } else {
            setError(apiError.message || 'Failed to load videos. Please try again later.');
          }
        } else if (err instanceof Error && 
                  (err.message.includes('API key') || 
                   err.message.toLowerCase().includes('authentication'))) {
          setShowAPIKeyWarning(true);
        } else {
          setError('Failed to load videos. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVideos();
  }, [activeGroup]);
  
  // Filter videos based on the selected filter option
  const filterVideos = () => {
    if (!videos.length) return [];
    
    const now = new Date();
    let timeThreshold: Date;
    
    switch(filterOption) {
      case 'latest':
        timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        break;
      case '3days':
        timeThreshold = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
        break;
      case '7days':
        timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        break;
      case 'all':
      default:
        return videos;
    }
    
    return videos.filter(video => {
      const videoDate = new Date(video.publishedAt);
      return videoDate >= timeThreshold;
    });
  };
  
  // Sort videos based on the selected sort option
  const sortVideos = (filteredVideos: Video[]) => {
    return [...filteredVideos].sort((a, b) => {
      if (sortOption === 'date') {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      } else { // views
        return parseInt(b.viewCount) - parseInt(a.viewCount);
      }
    });
  };
  
  const filteredAndSortedVideos = sortVideos(filterVideos());
  
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  if (showAPIKeyWarning) {
    return <APIKeyWarning message="YouTube API Key Required" />;
  }
  
  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading videos...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 p-4 rounded-lg">
          <p className="font-medium mb-2">Error Loading Videos</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!activeGroup) {
    return (
      <div className="p-8 text-center text-gray-600 dark:text-gray-400">
        <p>Select a group to view videos</p>
      </div>
    );
  }
  
  if (activeGroup.channels.length === 0) {
    return (
      <div className="p-8 text-center text-gray-600 dark:text-gray-400">
        <p className="mb-2">No channels in this group yet</p>
        <p className="text-sm">Add channels to see videos</p>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      {filteredAndSortedVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">No videos found</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {filterOption !== 'all'
              ? 'Try changing your filter settings or check back later for new videos'
              : 'No videos available from the channels in this group'}
          </p>
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {filteredAndSortedVideos.map(video => (
            <VideoCard key={video.id} video={video} />
          ))}
        </motion.div>
      )}
    </div>
  );
} 