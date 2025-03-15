"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import FilterBar from "./components/FilterBar";
import VideoGrid from "./components/VideoGrid";
import { useGroupContext } from "./context/GroupContext";
import { motion } from 'framer-motion';
import youtubeService from './services/youtubeService';

type FilterOption = 'latest' | '3days' | '7days' | 'all';
type SortOption = 'date' | 'views';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeGroupId, setActiveGroupId, setActiveGroupIdFromUrl } = useGroupContext();
  const [filterOption, setFilterOption] = useState<FilterOption>('latest');
  const [sortOption, setSortOption] = useState<SortOption>('date');
  const [showCacheCleared, setShowCacheCleared] = useState(false);
  
  // Track the previous URL parameter to prevent loops
  const [previousUrlGroupId, setPreviousUrlGroupId] = useState<string | null>(null);
  
  // Add a ref to track initial mount
  const isInitialMount = useRef(true);
  
  // Handle URL parameter for active group - prioritize on initial render and manual URL changes
  useEffect(() => {
    const groupId = searchParams.get('groupId');
    
    if (groupId) {
      // On initial mount or page refresh, always set from URL
      if (isInitialMount.current) {
        console.log(`Home (initial): Setting active group from URL: ${groupId}`);
        setActiveGroupIdFromUrl(groupId);
        setPreviousUrlGroupId(groupId);
        isInitialMount.current = false;
        
        // Store the group ID in localStorage to ensure it persists across refreshes
        localStorage.setItem('lastActiveGroupId', groupId);
        
        // Access the internal GroupContext ref to signal we've processed the URL parameter
        const groupContextElement = document.getElementById('group-context-debug');
        if (groupContextElement) {
          groupContextElement.dispatchEvent(new CustomEvent('url-processed'));
        }
        return;
      }
      
      // On subsequent URL changes, only update if it doesn't match the active group
      // and isn't the result of our own URL update
      if (groupId !== activeGroupId && groupId !== previousUrlGroupId) {
        console.log(`Home: Setting active group from URL: ${groupId}`);
        setActiveGroupIdFromUrl(groupId);
        setPreviousUrlGroupId(groupId);
        
        // Store the group ID in localStorage to ensure it persists across refreshes
        localStorage.setItem('lastActiveGroupId', groupId);
      }
    } else {
      // If no groupId in URL on initial mount, check if we have a stored groupId
      if (isInitialMount.current) {
        const storedGroupId = localStorage.getItem('lastActiveGroupId');
        if (storedGroupId) {
          console.log(`Home (initial): Restoring group from localStorage: ${storedGroupId}`);
          setActiveGroupIdFromUrl(storedGroupId);
          setPreviousUrlGroupId(storedGroupId);
          
          // Update the URL to match the stored group
          const params = new URLSearchParams();
          params.set('groupId', storedGroupId);
          router.replace(`/?${params.toString()}`, { scroll: false });
        }
        
        isInitialMount.current = false;
        
        // Signal that no URL parameter was found, so GroupContext can use default if needed
        const groupContextElement = document.getElementById('group-context-debug');
        if (groupContextElement) {
          groupContextElement.dispatchEvent(new CustomEvent('no-url-parameter'));
        }
      }
    }
  }, [searchParams, activeGroupId, previousUrlGroupId, setActiveGroupId, setActiveGroupIdFromUrl, router]);

  // Update URL when active group changes - but only through user interaction, not URL-triggered changes
  useEffect(() => {
    // Skip the effect on initial render or if initialized by a URL change
    if (isInitialMount.current || activeGroupId === previousUrlGroupId) return;
    
    // Only update URL if active group is actually different from URL
    const currentUrlGroupId = searchParams.get('groupId');
    if (activeGroupId !== currentUrlGroupId) {
      console.log(`Home: Updating URL for active group: ${activeGroupId}`);
      
      // Remember this URL change so we don't react to it in the other effect
      setPreviousUrlGroupId(activeGroupId);
      
      // Update the URL softly without a full navigation
      if (activeGroupId) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('groupId', activeGroupId);
        router.replace(`/?${params.toString()}`, { scroll: false });
      } else {
        router.replace('/', { scroll: false });
      }
    }
  }, [activeGroupId, router, searchParams, previousUrlGroupId]);

  const handleFilterChange = (filter: FilterOption) => {
    setFilterOption(filter);
  };

  const handleSortChange = (sort: SortOption) => {
    setSortOption(sort);
  };

  const handleClearCache = async () => {
    try {
      setShowCacheCleared(true);
      await youtubeService.clearCache();
      localStorage.removeItem('searchCache');
      console.log('Cache cleared successfully');
      
      // Refresh the current page to ensure data is reloaded
      window.location.reload();
    } catch (error) {
      console.error('Error clearing cache:', error);
      setShowCacheCleared(false);
    } finally {
      setTimeout(() => {
        setShowCacheCleared(false);
      }, 3000);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
            <FilterBar 
              onFilterChange={handleFilterChange} 
              onSortChange={handleSortChange}
            />
          </div>
          
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearCache}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Clear cached data to refresh content"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Clear Cache
              </button>
              
              {activeGroupId && (
                <Link
                  href={`/channels/${activeGroupId}`}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Manage Channels
                </Link>
              )}
              
              <Link
                href="/api-keys"
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm flex items-center cursor-pointer transition-colors"
              >
                API Keys
              </Link>
              
              <Link
                href="/settings"
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm flex items-center cursor-pointer transition-colors"
              >
                Settings
              </Link>
            </div>
          </div>
          
          {/* Cache cleared notification */}
          {showCacheCleared && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto mt-4 max-w-md p-3 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md text-center text-sm"
            >
              Cache cleared successfully. Refresh pages to see new data.
            </motion.div>
          )}
          
          <div className="flex-1 overflow-y-auto">
            <VideoGrid 
              filterOption={filterOption} 
              sortOption={sortOption} 
            />
          </div>
        </main>
      </div>
    </div>
  );
}
