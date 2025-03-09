"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useGroupContext } from '../../context/GroupContext';
import Header from '../../components/Header';
import ChannelSearch from '../../components/ChannelSearch';
import * as dbService from '../../services/dbService';

export default function ManageChannelsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  
  const { groups, setActiveGroupId, activeGroupId, loadGroups } = useGroupContext();
  
  const [groupName, setGroupName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use a ref to track if we've successfully loaded the group data
  // This prevents infinite fetching loops
  const dataLoadedRef = useRef(false);
  
  // Keep track of the last fetch time to implement a cooldown
  const lastFetchTimeRef = useRef(0);
  
  // Track whether we're in the process of loading group data
  const isLoadingRef = useRef(false);
  
  // Memoize group IDs to prevent dependency changes
  const groupIdsRef = useRef<Set<string>>(new Set());
  
  // Update the group IDs ref whenever groups change
  useEffect(() => {
    const currentGroupIds = new Set(groups.map(g => g.id));
    groupIdsRef.current = currentGroupIds;
  }, [groups]);
  
  // Function to load the group data with better dependency management
  const loadGroupData = useCallback(async () => {
    // Implement a cooldown to prevent rapid successive calls
    const now = Date.now();
    const cooldownPeriod = 1000; // 1 second cooldown
    
    if (now - lastFetchTimeRef.current < cooldownPeriod) {
      console.log(`Request throttled: Waiting for cooldown (${cooldownPeriod}ms)`);
      return;
    }
    
    // Skip if we've already successfully loaded the data
    if (dataLoadedRef.current) {
      console.log('Group data already loaded, skipping fetch');
      return;
    }
    
    // Skip if we're already in the process of loading
    if (isLoadingRef.current) {
      console.log('Group data loading already in progress, skipping duplicate fetch');
      return;
    }
    
    // Set loading state
    isLoadingRef.current = true;
    lastFetchTimeRef.current = now;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log("Starting group data load for ID:", groupId);
      
      // First try: Get the group directly from the database
      try {
        if (groupId) {
          const group = await dbService.getGroup(groupId);
          
          if (group) {
            console.log("Found group via direct fetch:", group.name);
            setGroupName(group.name);
            setActiveGroupId(groupId);
            setLoading(false);
            setError(null);
            dataLoadedRef.current = true;  // Mark as loaded
            isLoadingRef.current = false;
            return;
          }
        }
      } catch (dbError) {
        console.error('Error fetching group from database:', dbError);
      }
      
      // Before proceeding to other methods, check if the group ID exists in already loaded groups
      if (groupIdsRef.current.has(groupId)) {
        const groupFromMemory = groups.find(g => g.id === groupId);
        if (groupFromMemory) {
          console.log("Found group in memory:", groupFromMemory.name);
          setGroupName(groupFromMemory.name);
          setActiveGroupId(groupId);
          setLoading(false);
          setError(null);
          dataLoadedRef.current = true;
          isLoadingRef.current = false;
          return;
        }
      }
      
      // Second try: Load all groups and check if our target is there
      console.log("Loading all groups to find target group");
      await loadGroups();
      
      // Add a small delay to ensure state updates are complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if the group is in the state after loadGroups
      const groupFromState = groups.find(g => g.id === groupId);
      
      if (groupFromState) {
        console.log("Found group in state after loadGroups:", groupFromState.name);
        setGroupName(groupFromState.name);
        setActiveGroupId(groupId);
        setLoading(false);
        setError(null);
        dataLoadedRef.current = true;  // Mark as loaded
        isLoadingRef.current = false;
        return;
      }
      
      // If we still don't have the group, something is wrong
      console.log('Group not found after multiple attempts');
      setError('Group not found');
      setLoading(false);
      
    } catch (err) {
      console.error('Error initializing channel management page:', err);
      setError('Failed to load group. Please try again later.');
      setLoading(false);
    } finally {
      isLoadingRef.current = false;
    }
  }, [groupId, setActiveGroupId, loadGroups]);
  
  // Load group data on component mount and when groupId changes
  useEffect(() => {
    // Reset the ref when the groupId changes
    dataLoadedRef.current = false;
    
    // Load the data with a small delay to avoid rapid successive requests
    const timeoutId = setTimeout(() => {
      if (!dataLoadedRef.current) {
        loadGroupData();
      }
    }, 50);
    
    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
    };
  }, [groupId, loadGroupData]);
  
  // Handle back button click
  const handleBackToDashboard = () => {
    router.push('/');
  };
  
  // Handle retry button click
  const handleRetry = () => {
    dataLoadedRef.current = false;  // Reset the loaded state
    lastFetchTimeRef.current = 0;   // Reset the cooldown
    loadGroupData();
  };
  
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading group data...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex-1 container mx-auto px-4 py-8">
          <div className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 p-4 rounded-lg text-center">
            <p className="font-medium mb-2">Error</p>
            <p className="mb-4">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Retry Loading
              </button>
              <button
                onClick={handleBackToDashboard}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Manage Channels: {groupName}
          </h1>
          <button
            onClick={handleBackToDashboard}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <ChannelSearch />
        </div>
      </div>
    </div>
  );
} 