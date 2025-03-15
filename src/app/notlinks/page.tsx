"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLinkGroupContext } from '../context/LinkGroupContext';
import { Link, LinkGroup } from '../types';
import LinkGroupSidebar from '../components/LinkGroupSidebar';
import LinkList from '../components/LinkList';
import Header from '../components/Header';
import { useRouter, useSearchParams } from 'next/navigation';

export default function NotLinksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const { 
    linkGroups, 
    activeLinkGroupId, 
    setActiveLinkGroupId,
    addLinkGroup,
    editLinkGroup,
    deleteLinkGroup,
    addLinkToGroup,
    removeLinkFromGroup,
    removeMultipleLinksFromGroup,
    toggleSubgroupExpansion,
    getLinkGroupTree
  } = useLinkGroupContext();
  
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkDescription, setNewLinkDescription] = useState('');
  
  // Get the hierarchical tree of link groups
  const linkGroupTree = getLinkGroupTree();
  
  // Track the previous URL parameter to prevent loops
  const [previousUrlGroupId, setPreviousUrlGroupId] = useState<string | null>(null);
  
  // Handle URL parameter for active group - only on initial render and manual URL changes
  useEffect(() => {
    const groupId = searchParams.get('groupId');
    
    // Only update if groupId changed in the URL and it doesn't match the active group
    if (groupId && groupId !== activeLinkGroupId && groupId !== previousUrlGroupId) {
      console.log(`NotLinksPage: Setting active group from URL: ${groupId}`);
      setActiveLinkGroupId(groupId);
      setPreviousUrlGroupId(groupId);
    }
  }, [searchParams, activeLinkGroupId, previousUrlGroupId, setActiveLinkGroupId]);

  // Update URL when active group changes - but only through user interaction, not URL-triggered changes
  useEffect(() => {
    // Skip the effect if it's initialized by a URL change
    if (activeLinkGroupId === previousUrlGroupId) return;
    
    // Only update URL if active group is actually different from URL
    const currentUrlGroupId = searchParams.get('groupId');
    if (activeLinkGroupId !== currentUrlGroupId) {
      console.log(`NotLinksPage: Updating URL for active group: ${activeLinkGroupId}`);
      
      // Remember this URL change so we don't react to it in the other effect
      setPreviousUrlGroupId(activeLinkGroupId);
      
      // Update the URL softly without a full navigation
      if (activeLinkGroupId) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('groupId', activeLinkGroupId);
        router.replace(`/notlinks?${params.toString()}`, { scroll: false });
      } else {
        router.replace('/notlinks', { scroll: false });
      }
    }
  }, [activeLinkGroupId, router, searchParams, previousUrlGroupId]);
  
  // Helper function to find a group by ID in the hierarchical tree
  const findGroupById = (id: string | null, groups: LinkGroup[]): LinkGroup | undefined => {
    if (!id) return undefined;
    
    for (const group of groups) {
      if (group.id === id) {
        return group;
      }
      
      if (group.subgroups && group.subgroups.length > 0) {
        const found = findGroupById(id, group.subgroups);
        if (found) {
          return found;
        }
      }
    }
    
    return undefined;
  };
  
  // Get the active group from the hierarchical tree instead of the flat list
  const activeGroup = useMemo(() => {
    if (!activeLinkGroupId) return undefined;
    
    // First, try to find in the hierarchical tree
    const foundInHierarchy = findGroupById(activeLinkGroupId, linkGroupTree);
    if (foundInHierarchy) {
      console.log(`NotLinksPage: Found active group in hierarchy: ${foundInHierarchy.name}`);
      return foundInHierarchy;
    }
    
    // Fallback to flat list
    const foundInFlatList = linkGroups.find(group => group.id === activeLinkGroupId);
    if (foundInFlatList) {
      console.log(`NotLinksPage: Found active group in flat list: ${foundInFlatList.name}`);
      return foundInFlatList;
    }
    
    console.warn(`NotLinksPage: Could not find active group with ID: ${activeLinkGroupId}`);
    return undefined;
  }, [activeLinkGroupId, linkGroupTree, linkGroups, findGroupById]);
  
  // Debug active group
  useEffect(() => {
    if (activeLinkGroupId) {
      console.log(`NotLinksPage: Active group ID: ${activeLinkGroupId}`);
      if (activeGroup) {
        console.log(`NotLinksPage: Active group details:`, {
          name: activeGroup.name,
          id: activeGroup.id,
          links: activeGroup.links?.length || 0,
          subgroups: activeGroup.subgroups?.length || 0
        });
      } else {
        console.warn(`NotLinksPage: Active group with ID ${activeLinkGroupId} not found in data`);
      }
    }
  }, [activeLinkGroupId, activeGroup]);
  
  // Debug logs
  console.log(`NotLinksPage: Loaded ${linkGroups.length} link groups`);
  
  // More detailed tree visualization
  const logTreeStructure = (groups: LinkGroup[], level = 0) => {
    const indent = ' '.repeat(level * 2);
    groups.forEach(group => {
      console.log(`${indent}- ${group.name} (${group.id}), has ${group.subgroups?.length || 0} subgroups, expanded: ${group.isExpanded}`);
      if (group.subgroups && group.subgroups.length > 0) {
        logTreeStructure(group.subgroups, level + 1);
      }
    });
  };
  
  if (linkGroupTree.length > 0) {
    console.log(`NotLinksPage: Link group tree has ${linkGroupTree.length} top-level groups`);
    console.log('Full Link Group Tree Structure:');
    logTreeStructure(linkGroupTree);
  }
  
  // Handle adding a new link
  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeLinkGroupId || !newLinkUrl) return; // Only URL is required now
    
    // Get the link title - use active group name if no title provided
    let linkTitle = newLinkTitle;
    
    if (!linkTitle && activeGroup) {
      // Use the active group's name as the default link title
      linkTitle = activeGroup.name;
      console.log(`Using active group name "${linkTitle}" as link title`);
    }
    
    // Split the URL string by commas and trim whitespace
    const urls = newLinkUrl.split(',')
      .map(url => {
        // Trim whitespace and handle leading @ symbols
        let cleanUrl = url.trim();
        
        // Remove leading @ symbol but keep the rest of the URL intact
        if (cleanUrl.startsWith('@')) {
          cleanUrl = cleanUrl.substring(1);
        }
        
        // Ensure URL has proper http/https protocol
        if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = 'https://' + cleanUrl;
        }
        
        console.log(`Cleaned URL: ${cleanUrl}`);
        return cleanUrl;
      })
      .filter(url => url); // Remove empty entries
    
    console.log(`Processing ${urls.length} URLs:`, urls);
    
    let successCount = 0;
    
    // Process URLs sequentially instead of concurrently to avoid transaction conflicts
    for (const url of urls) {
      try {
        // Create a new link
        const newLink: Link = {
          id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          title: linkTitle, // Same title for all links
          url: url,
          description: newLinkDescription || undefined,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        // Add the link to the active group
        await addLinkToGroup(activeLinkGroupId, newLink);
        successCount++;
        console.log(`Successfully added link to ${url}`);
      } catch (error) {
        console.error(`Error adding link for URL ${url}:`, error);
      }
      
      // Add a small delay between operations to ensure transactions don't overlap
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    if (successCount > 0) {
      console.log(`Successfully added ${successCount} of ${urls.length} links`);
      
      // Reset form
      setNewLinkTitle('');
      setNewLinkUrl('');
      setNewLinkDescription('');
      setIsAddingLink(false);
    } else {
      console.error('Failed to add any links');
    }
  };
  
  // Wrapper functions to adapt to LinkGroupSidebar props
  const handleAddGroup = async (group: Omit<LinkGroup, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newGroupId = await addLinkGroup(group.name, group.parentId);
      
      if (newGroupId) {
        // Set the new group as active and update URL
        setActiveLinkGroupId(newGroupId);
      }
    } catch (error) {
      console.error('Error adding link group:', error);
    }
  };
  
  const handleEditGroup = async (id: string, updates: Partial<LinkGroup>) => {
    try {
      if (updates.name) {
        await editLinkGroup(id, updates.name);
      }
    } catch (error) {
      console.error('Error editing link group:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <LinkGroupSidebar 
          linkGroups={linkGroupTree}
          activeLinkGroupId={activeLinkGroupId}
          setActiveLinkGroupId={setActiveLinkGroupId}
          addLinkGroup={handleAddGroup}
          editLinkGroup={handleEditGroup}
          deleteLinkGroup={deleteLinkGroup}
          toggleSubgroupExpansion={toggleSubgroupExpansion}
        />
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Debug panel - only shown in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 mb-4 rounded-md text-xs">
                <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">Debug Info</h3>
                <p>Active Group ID: {activeLinkGroupId || 'none'}</p>
                {activeGroup && (
                  <>
                    <p>Name: {activeGroup.name}</p>
                    <p>Links: {activeGroup.links?.length || 0}</p>
                    <p>Subgroups: {activeGroup.subgroups?.length || 0}</p>
                    <p>Is Expanded: {activeGroup.isExpanded ? 'Yes' : 'No'}</p>
                  </>
                )}
              </div>
            )}
            
            {activeLinkGroupId ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {activeGroup?.name || 'Loading...'}
                  </h1>
                  <button
                    onClick={() => setIsAddingLink(!isAddingLink)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {isAddingLink ? 'Cancel' : 'Add Link'}
                  </button>
                </div>
                
                <AnimatePresence>
                  {isAddingLink && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-md overflow-hidden"
                    >
                      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add New Link</h2>
                      <form onSubmit={handleAddLink} className="space-y-4">
                        <div>
                          <label htmlFor="link-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Title <span className="text-xs font-normal text-gray-500">(optional - uses group name if empty)</span>
                          </label>
                          <input
                            id="link-title"
                            type="text"
                            value={newLinkTitle}
                            onChange={(e) => setNewLinkTitle(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Link Title (leave empty to use group name)"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="link-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            URL <span className="text-xs font-normal text-gray-500">(add multiple URLs separated by commas, http:// is optional)</span>
                          </label>
                          <input
                            id="link-url"
                            type="text"
                            value={newLinkUrl}
                            onChange={(e) => setNewLinkUrl(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                            placeholder="youtube.com, github.com, @twitter.com/username"
                            required
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="link-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Description (Optional)
                          </label>
                          <textarea
                            id="link-description"
                            value={newLinkDescription}
                            onChange={(e) => setNewLinkDescription(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Brief description of the link"
                            rows={3}
                          />
                        </div>
                        
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingLink(false)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            disabled={!newLinkUrl}
                          >
                            Add Link
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Link List */}
                {activeGroup ? (
                  <LinkList
                    links={activeGroup.links || []}
                    onRemoveLink={(linkId: string) => removeLinkFromGroup(activeGroup.id, linkId)}
                    onRemoveMultipleLinks={(linkIds: string[]) => removeMultipleLinksFromGroup(activeGroup.id, linkIds)}
                  />
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                    <p className="text-gray-700 dark:text-gray-300">
                      {activeLinkGroupId ? "Error loading group content. Please try again." : "Please select a group to view its links."}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Group Selected</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  Select a group from the sidebar or create a new one to start organizing your links.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
} 