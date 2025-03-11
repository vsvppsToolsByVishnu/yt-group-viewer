"use client";

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
    publishedAt: string;
    viewCount: string;
  };
}

export default function VideoCard({ video }: VideoCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Format the date to show how long ago the video was published
  const formatPublishedDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      if (diffInHours === 0) {
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        return `${diffInMinutes} minutes ago`;
      }
      return `${diffInHours} hours ago`;
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Format view count with commas
  const formatViewCount = (viewCount: string) => {
    return parseInt(viewCount).toLocaleString();
  };

  // Use a fallback thumbnail URL if the original fails
  const getFallbackThumbnail = () => {
    // Try to get a higher quality fallback if possible - maxresdefault first
    return `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`;
  };

  // Second fallback if the maxres version fails
  const getSecondFallbackThumbnail = () => {
    return `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
  };

  // Toggle video playback
  const togglePlayback = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsPlaying(!isPlaying);
  };

  // The embedded player URL
  const embedUrl = `https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`;

  return (
    <motion.div 
      className="bg-background shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 hover:shadow-md"
      whileHover={{ 
        y: -8, 
        scale: 1.02,
        transition: { 
          duration: 0.15,
          ease: "easeOut" 
        } 
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative pb-[56.25%] bg-gray-100 dark:bg-gray-800">
        {isPlaying ? (
          <iframe
            className="absolute inset-0 w-full h-full border-none"
            src={embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        ) : (
          <>
            {imageError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            ) : (
              <div className="group absolute inset-0 cursor-pointer" onClick={togglePlayback}>
                <Image 
                  src={video.thumbnailUrl}
                  alt={video.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover"
                  onError={(e) => {
                    // Try the maxres fallback first
                    const target = e.target as HTMLImageElement;
                    target.src = getFallbackThumbnail();
                    
                    // Add an additional error handler for the fallback
                    target.onerror = () => {
                      target.src = getSecondFallbackThumbnail();
                      
                      // Final fallback
                      target.onerror = () => {
                        setImageError(true);
                      };
                    };
                  }}
                  id={`thumbnail-${video.id}`}
                  priority
                  quality={100}
                  loading="eager"
                  unoptimized={false} // Let Next.js optimize for max quality
                />
                <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-40 transition-opacity duration-300"></div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-red-600 rounded-full p-3 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1 py-0.5 rounded">
              {formatPublishedDate(video.publishedAt)}
            </div>
          </>
        )}
      </div>
      
      <div className="p-3">
        <h3 className="font-medium line-clamp-2 text-sm sm:text-base mb-1" title={video.title}>
          {video.title}
        </h3>
        <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <span>{video.channelTitle}</span>
          <span>{formatViewCount(video.viewCount)} views</span>
        </div>
        
        <div className="mt-3 flex justify-end">
          {isPlaying ? (
            <motion.button
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs rounded-full flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsPlaying(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              Close
            </motion.button>
          ) : (
            <motion.a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-red-600 text-white text-xs rounded-full flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Watch on YouTube
            </motion.a>
          )}
        </div>
      </div>
    </motion.div>
  );
} 