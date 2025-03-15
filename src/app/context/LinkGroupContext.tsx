"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { LinkGroup, Link } from '../types';
import * as dbService from '../services/dbService';
import { useRouter } from 'next/navigation';

// Define the context interface
export interface LinkGroupContextType {
  linkGroups: LinkGroup[];
  activeLinkGroupId: string | null;
  setActiveLinkGroupId: (id: string | null) => void;
  addLinkGroup: (name: string, parentId?: string) => Promise<string | null>;
  editLinkGroup: (id: string, name: string) => Promise<void>;
  deleteLinkGroup: (id: string) => Promise<void>;
  addLinkToGroup: (groupId: string, link: Link) => Promise<void>;
  removeLinkFromGroup: (groupId: string, linkId: string) => Promise<void>;
  removeMultipleLinksFromGroup: (groupId: string, linkIds: string[]) => Promise<void>;
  loadLinkGroups: () => Promise<void>;
  toggleSubgroupExpansion: (groupId: string) => Promise<void>;
  getSubgroups: (parentId: string | null) => LinkGroup[];
  getTopLevelLinkGroups: () => LinkGroup[];
  getLinkGroupTree: (parentId?: string | null) => LinkGroup[];
}

// Create the context with default values
const LinkGroupContext = createContext<LinkGroupContextType>({
  linkGroups: [],
  activeLinkGroupId: null,
  setActiveLinkGroupId: () => {},
  addLinkGroup: async () => null,
  editLinkGroup: async () => {},
  deleteLinkGroup: async () => {},
  addLinkToGroup: async () => {},
  removeLinkFromGroup: async () => {},
  removeMultipleLinksFromGroup: async () => {},
  loadLinkGroups: async () => {},
  toggleSubgroupExpansion: async () => {},
  getSubgroups: () => [],
  getTopLevelLinkGroups: () => [],
  getLinkGroupTree: () => []
});

// Custom hook to use the link group context
export const useLinkGroupContext = () => useContext(LinkGroupContext);

// Provider component
export const LinkGroupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [linkGroups, setLinkGroups] = useState<LinkGroup[]>([]);
  const [activeLinkGroupId, setActiveLinkGroupId] = useState<string | null>(null);
  const router = useRouter();
  
  // Load link groups from the database
  const loadLinkGroups = useCallback(async () => {
    console.log('[LinkGroupContext] Loading link groups');
    try {
      let fetchedGroups = await dbService.getLinkGroupHierarchy();
      console.log(`[LinkGroupContext] Loaded ${fetchedGroups.length} top-level link groups`);
      
      // Enhanced debugging to show the full structure
      const debugGroup = (group: LinkGroup, level = 0): void => {
        const indent = ' '.repeat(level * 2);
        console.log(`${indent}- Group: ${group.name} (${group.id}), parentId: ${group.parentId || 'none'}`);
        console.log(`${indent}  Has ${group.subgroups?.length || 0} subgroups`);
        if (group.subgroups && group.subgroups.length > 0) {
          group.subgroups.forEach(subgroup => debugGroup(subgroup, level + 1));
        }
      };
      
      // Log the full hierarchy
      console.log('[LinkGroupContext] Full hierarchy:');
      fetchedGroups.forEach(group => debugGroup(group));
      
      // Count total groups including subgroups
      const countAllGroups = (groups: LinkGroup[]): number => {
        return groups.reduce((count, group) => {
          return count + 1 + (group.subgroups ? countAllGroups(group.subgroups) : 0);
        }, 0);
      };
      
      const totalGroups = countAllGroups(fetchedGroups);
      console.log(`[LinkGroupContext] Total link groups including subgroups: ${totalGroups}`);
      
      // Make sure subgroups are properly set
      if (totalGroups > fetchedGroups.length && fetchedGroups.every(g => !g.subgroups || g.subgroups.length === 0)) {
        console.warn('[LinkGroupContext] Hierarchy data may be incorrect - rebuilding tree');
        // Re-build the hierarchy client-side if needed
        const allGroups = await dbService.getLinkGroups();
        const rebuilt = getLinkGroupTreeFromFlatList(allGroups);
        console.log(`[LinkGroupContext] Rebuilt tree has ${rebuilt.length} top groups and ${countAllGroups(rebuilt)} total groups`);
        setLinkGroups(rebuilt);
      } else {
        setLinkGroups(fetchedGroups);
      }
    } catch (error) {
      console.error('[LinkGroupContext] Error loading link groups:', error);
      // If there was an error, try to load from localStorage as a fallback
      setLinkGroups([]);
    }
  }, []);
  
  // Helper function to build a tree from a flat list
  const getLinkGroupTreeFromFlatList = (flatGroups: LinkGroup[]): LinkGroup[] => {
    // Create a map of groups by ID for quick lookup
    const groupMap = new Map<string, LinkGroup>();
    flatGroups.forEach(group => {
      // Clone the group and ensure it has a subgroups array
      const groupClone = { ...group, subgroups: [] };
      groupMap.set(group.id, groupClone);
    });
    
    // Build the hierarchy
    const topLevelGroups: LinkGroup[] = [];
    
    flatGroups.forEach(group => {
      const groupWithSubgroups = groupMap.get(group.id)!;
      
      if (group.parentId && groupMap.has(group.parentId)) {
        // This is a subgroup, add it to its parent
        const parent = groupMap.get(group.parentId)!;
        parent.subgroups!.push(groupWithSubgroups);
      } else {
        // This is a top-level group
        topLevelGroups.push(groupWithSubgroups);
      }
    });
    
    return topLevelGroups;
  };
  
  // Load link groups on initial render
  useEffect(() => {
    loadLinkGroups();
  }, [loadLinkGroups]);
  
  // Load the active group's links when the active group changes
  useEffect(() => {
    const loadActiveGroupLinks = async () => {
      if (!activeLinkGroupId) return;
      
      console.log(`[LinkGroupContext] Loading links for active group: ${activeLinkGroupId}`);
      
      try {
        // Get the existing group from state first to check if we need to load data
        const existingGroup = findGroupById(activeLinkGroupId);
        
        // Skip loading if we already have links for this group
        if (existingGroup && existingGroup.links && existingGroup.links.length > 0) {
          console.log(`[LinkGroupContext] Group ${activeLinkGroupId} already has ${existingGroup.links.length} links loaded, skipping fetch`);
          return;
        }
        
        // We need to load data for this group
        console.log(`[LinkGroupContext] Fetching data for group ${activeLinkGroupId}`);
        const fullGroup = await dbService.getLinkGroup(activeLinkGroupId);
        
        if (fullGroup) {
          console.log(`[LinkGroupContext] Fetched group data with ${fullGroup.links?.length || 0} links`);
          
          // Update the linkGroups state with the fresh data
          setLinkGroups(prevGroups => {
            // First try to find the group in the hierarchy
            const findAndUpdateGroup = (groups: LinkGroup[]): LinkGroup[] => {
              return groups.map(group => {
                if (group.id === activeLinkGroupId) {
                  return {
                    ...group,
                    links: fullGroup.links || []
                  };
                }
                
                if (group.subgroups && group.subgroups.length > 0) {
                  return {
                    ...group,
                    subgroups: findAndUpdateGroup(group.subgroups)
                  };
                }
                
                return group;
              });
            };
            
            return findAndUpdateGroup(prevGroups);
          });
        } else {
          console.error(`[LinkGroupContext] Failed to fetch group: ${activeLinkGroupId}`);
        }
      } catch (error) {
        console.error(`[LinkGroupContext] Error loading links for group ${activeLinkGroupId}:`, error);
      }
    };
    
    // Use a small delay to avoid rapid consecutive calls
    const timer = setTimeout(() => {
      loadActiveGroupLinks();
    }, 50);
    
    return () => clearTimeout(timer);
  }, [activeLinkGroupId]);
  
  // Add a new link group
  const addLinkGroup = async (name: string, parentId?: string): Promise<string | null> => {
    console.log(`[LinkGroupContext] Adding new link group: ${name}${parentId ? ` (parent: ${parentId})` : ''}`);
    
    try {
      // Create a new group object
      const newGroup: LinkGroup = {
        id: '', // Will be assigned by the database
        name,
        links: [],
        parentId,
        isExpanded: true
      };
      
      // Save to database
      const groupId = await dbService.saveLinkGroup(newGroup);
      
      if (groupId) {
        // Reload groups to get the updated hierarchy
        await loadLinkGroups();
        return groupId;
      } else {
        console.error('[LinkGroupContext] Failed to add link group');
        return null;
      }
    } catch (error) {
      console.error('[LinkGroupContext] Error adding link group:', error);
      return null;
    }
  };
  
  // Edit a link group
  const editLinkGroup = async (id: string, name: string): Promise<void> => {
    console.log(`[LinkGroupContext] Editing link group: ${id} -> ${name}`);
    
    try {
      // Find the group in the current state
      const group = findGroupById(id);
      
      if (!group) {
        console.error(`[LinkGroupContext] Cannot edit link group: Group with ID ${id} not found`);
        return;
      }
      
      // Update the group
      const updatedGroup: LinkGroup = {
        ...group,
        name
      };
      
      // Save to database
      await dbService.saveLinkGroup(updatedGroup);
      
      // Update state
      setLinkGroups(prevGroups => updateGroupInHierarchy(prevGroups, updatedGroup));
    } catch (error) {
      console.error('[LinkGroupContext] Error editing link group:', error);
    }
  };
  
  // Delete a link group
  const deleteLinkGroup = async (id: string): Promise<void> => {
    console.log(`[LinkGroupContext] Deleting link group: ${id}`);
    
    try {
      // Find the position of the group to be deleted in the top-level groups array
      // so we can select a nearby group after deletion
      const topLevelGroups = linkGroups.filter(g => !g.parentId);
      const deletedGroupIndex = topLevelGroups.findIndex(g => g.id === id);
      console.log(`[LinkGroupContext] Group to delete is at index ${deletedGroupIndex} of ${topLevelGroups.length} top-level groups`);
      
      // Determine which group to select after deletion (prefer the one above)
      let groupToSelectAfterDeletion: LinkGroup | null = null;
      
      if (deletedGroupIndex > 0) {
        // Select the group above if possible
        groupToSelectAfterDeletion = topLevelGroups[deletedGroupIndex - 1];
        console.log(`[LinkGroupContext] Will select previous group: ${groupToSelectAfterDeletion.name} (${groupToSelectAfterDeletion.id})`);
      } else if (topLevelGroups.length > 1) {
        // If deleting the first group, select the next one
        groupToSelectAfterDeletion = topLevelGroups[1];
        console.log(`[LinkGroupContext] Will select next group: ${groupToSelectAfterDeletion.name} (${groupToSelectAfterDeletion.id})`);
      }
      
      // Get all subgroups that need to be deleted along with this group
      const subgroupIds = getAllSubgroupIds(id);
      const allGroupsToDelete = [id, ...subgroupIds];
      
      console.log(`[LinkGroupContext] Deleting group ${id} and ${subgroupIds.length} subgroups:`, subgroupIds);
      
      // If the active group is being deleted, clear it first
      if (activeLinkGroupId && allGroupsToDelete.includes(activeLinkGroupId)) {
        setActiveLinkGroupId(null);
      }
      
      // Update state first for immediate UI response (optimistic update)
      setLinkGroups(prev => prev.filter(g => !allGroupsToDelete.includes(g.id)));
      
      // Delete from database
      console.log(`[LinkGroupContext] Deleting group from database: ${id}`);
      const success = await dbService.deleteLinkGroup(id);
      
      if (!success) {
        console.error(`[LinkGroupContext] Failed to delete link group: ${id} from database`);
        return;
      }
      
      console.log(`[LinkGroupContext] Successfully deleted link group: ${id} from database`);
      
      // Navigate to the selected group after deletion
      if (groupToSelectAfterDeletion) {
        console.log(`[LinkGroupContext] Navigating to selected group: ${groupToSelectAfterDeletion.name} (${groupToSelectAfterDeletion.id})`);
        router.replace(`/notlinks?groupId=${groupToSelectAfterDeletion.id}`);
      } else if (topLevelGroups.length > allGroupsToDelete.length) {
        // If we still have other groups, navigate to the first available one
        const remainingGroups = topLevelGroups.filter(g => !allGroupsToDelete.includes(g.id));
        if (remainingGroups.length > 0) {
          console.log(`[LinkGroupContext] Navigating to first remaining group: ${remainingGroups[0].name} (${remainingGroups[0].id})`);
          router.replace(`/notlinks?groupId=${remainingGroups[0].id}`);
        } else {
          router.replace('/notlinks');
        }
      } else {
        // No groups left, go to base route
        router.replace('/notlinks');
      }
    } catch (error) {
      console.error('[LinkGroupContext] Error deleting link group:', error);
    }
  };
  
  // Add a link to a group
  const addLinkToGroup = async (groupId: string, link: Link): Promise<void> => {
    console.log(`[LinkGroupContext] Adding link to group: ${groupId}`);
    
    try {
      // Load the group directly from the database to get the latest state
      const dbGroup = await dbService.getLinkGroup(groupId);
      
      if (!dbGroup) {
        console.error(`[LinkGroupContext] Cannot add link: Group with ID ${groupId} not found in database`);
        return;
      }
      
      // Check if the link already exists in the group
      const linkExists = dbGroup.links.some(l => l.id === link.id);
      if (linkExists) {
        console.log(`[LinkGroupContext] Link ${link.id} already exists in group ${groupId}`);
        return;
      }
      
      // Update the group with the new link
      const updatedGroup: LinkGroup = {
        ...dbGroup,
        links: [...dbGroup.links, link]
      };
      
      console.log(`[LinkGroupContext] Adding link ${link.id} to group ${groupId} with ${updatedGroup.links.length} total links`);
      
      // Save to database
      await dbService.saveLinkGroup(updatedGroup);
      
      // Reload link groups to get the updated state
      await loadLinkGroups();
    } catch (error) {
      console.error('[LinkGroupContext] Error adding link to group:', error);
    }
  };
  
  // Remove a link from a group
  const removeLinkFromGroup = async (groupId: string, linkId: string): Promise<void> => {
    console.log(`[LinkGroupContext] Removing link ${linkId} from group ${groupId}`);
    
    try {
      // Find the group in the current state
      const group = findGroupById(groupId);
      
      if (!group) {
        console.error(`[LinkGroupContext] Cannot remove link: Group with ID ${groupId} not found`);
        return;
      }
      
      // Find the link to remove
      const linkToRemove = group.links.find(l => l.id === linkId);
      if (!linkToRemove) {
        console.log(`[LinkGroupContext] Link ${linkId} not found in group ${groupId}`);
        return;
      }
      
      // Update the group without the link
      const updatedGroup: LinkGroup = {
        ...group,
        links: group.links.filter(link => link.id !== linkId)
      };
      
      // Save to database - this will update the links in the database
      console.log(`[LinkGroupContext] Saving group ${groupId} after removing link ${linkId}`);
      await dbService.saveLinkGroup(updatedGroup);
      
      // Also explicitly delete the link from the database to ensure it's removed
      try {
        // We can use a direct db query here if needed
        console.log(`[LinkGroupContext] Ensuring link ${linkId} is deleted from the database`);
        await dbService.deleteLinkFromGroup(groupId, linkId);
      } catch (deleteError) {
        console.warn(`[LinkGroupContext] Error during explicit link deletion:`, deleteError);
        // Continue with state update even if explicit deletion fails
      }
      
      // Update state
      setLinkGroups(prevGroups => updateGroupInHierarchy(prevGroups, updatedGroup));
      console.log(`[LinkGroupContext] Successfully removed link ${linkId} from group ${groupId}`);
    } catch (error) {
      console.error('[LinkGroupContext] Error removing link from group:', error);
    }
  };
  
  // Remove multiple links from a group
  const removeMultipleLinksFromGroup = async (groupId: string, linkIds: string[]): Promise<void> => {
    console.log(`[LinkGroupContext] Removing ${linkIds.length} links from group ${groupId}`);
    
    try {
      // Find the group in the current state
      const group = findGroupById(groupId);
      
      if (!group) {
        console.error(`[LinkGroupContext] Cannot remove links: Group with ID ${groupId} not found`);
        return;
      }
      
      // Find the links to remove
      const linksToRemove = group.links.filter(l => linkIds.includes(l.id));
      if (linksToRemove.length === 0) {
        console.log(`[LinkGroupContext] No links to remove from group ${groupId}`);
        return;
      }
      
      // Update the group without the links
      const updatedGroup: LinkGroup = {
        ...group,
        links: group.links.filter(link => !linkIds.includes(link.id))
      };
      
      // Save to database
      console.log(`[LinkGroupContext] Saving group ${groupId} after removing ${linkIds.length} links`);
      await dbService.saveLinkGroup(updatedGroup);
      
      // Also explicitly delete the links from the database to ensure they're removed
      try {
        console.log(`[LinkGroupContext] Ensuring all ${linkIds.length} links are deleted from the database`);
        // Delete each link individually to ensure they're all removed
        for (const linkId of linkIds) {
          await dbService.deleteLinkFromGroup(groupId, linkId);
        }
      } catch (deleteError) {
        console.warn(`[LinkGroupContext] Error during explicit link deletion:`, deleteError);
        // Continue with state update even if explicit deletion fails
      }
      
      // Update state
      setLinkGroups(prevGroups => updateGroupInHierarchy(prevGroups, updatedGroup));
      console.log(`[LinkGroupContext] Successfully removed ${linkIds.length} links from group ${groupId}`);
    } catch (error) {
      console.error('[LinkGroupContext] Error removing multiple links from group:', error);
    }
  };
  
  // Toggle subgroup expansion
  const toggleSubgroupExpansion = async (groupId: string): Promise<void> => {
    console.log(`[LinkGroupContext] Toggling subgroup expansion for group: ${groupId}`);
    
    try {
      // Find the group in the current state
      const group = findGroupById(groupId);
      
      if (!group) {
        console.error(`[LinkGroupContext] Cannot toggle expansion: Group with ID ${groupId} not found`);
        return;
      }
      
      // Update the group with the toggled expansion state
      const updatedGroup: LinkGroup = {
        ...group,
        isExpanded: !group.isExpanded
      };
      
      // Save to database
      await dbService.saveLinkGroup(updatedGroup);
      
      // Update state
      setLinkGroups(prevGroups => updateGroupInHierarchy(prevGroups, updatedGroup));
    } catch (error) {
      console.error('[LinkGroupContext] Error toggling subgroup expansion:', error);
    }
  };
  
  // Helper function to find a group by ID in the hierarchy
  const findGroupById = (id: string): LinkGroup | null => {
    const findGroup = (groups: LinkGroup[]): LinkGroup | null => {
      for (const group of groups) {
        if (group.id === id) {
          return group;
        }
        
        if (group.subgroups && group.subgroups.length > 0) {
          const subgroup = findGroup(group.subgroups);
          if (subgroup) {
            return subgroup;
          }
        }
      }
      
      return null;
    };
    
    return findGroup(linkGroups);
  };
  
  // Helper function to update a group in the hierarchy
  const updateGroupInHierarchy = (groups: LinkGroup[], updatedGroup: LinkGroup): LinkGroup[] => {
    return groups.map(group => {
      if (group.id === updatedGroup.id) {
        return updatedGroup;
      }
      
      if (group.subgroups && group.subgroups.length > 0) {
        return {
          ...group,
          subgroups: updateGroupInHierarchy(group.subgroups, updatedGroup)
        };
      }
      
      return group;
    });
  };
  
  // Get subgroups for a parent ID
  const getSubgroups = (parentId: string | null): LinkGroup[] => {
    return linkGroups.filter(group => group.parentId === parentId);
  };
  
  // Get top-level groups (no parent)
  const getTopLevelLinkGroups = (): LinkGroup[] => {
    return linkGroups.filter(group => !group.parentId);
  };
  
  // Get a hierarchical tree of groups
  const getLinkGroupTree = (parentId: string | null = null): LinkGroup[] => {
    console.log(`[LinkGroupTree] Building tree for parentId: ${parentId || 'null'}`);
    
    // First check if the linkGroups already have proper hierarchy
    const hasProperHierarchy = linkGroups.some(g => g.subgroups && g.subgroups.length > 0);
    
    if (hasProperHierarchy) {
      console.log('[LinkGroupTree] Using existing hierarchy');
      return parentId === null 
        ? linkGroups.filter(g => !g.parentId)
        : linkGroups
            .filter(g => g.id === parentId)
            .flatMap(g => g.subgroups || []);
    }
    
    // If we don't have a proper hierarchy, build it
    console.log('[LinkGroupTree] Building hierarchy from flat list');
    const filteredGroups = parentId === null
      ? linkGroups.filter(group => !group.parentId)
      : linkGroups.filter(group => group.parentId === parentId);
    
    const result = filteredGroups.map(group => ({
      ...group,
      subgroups: getLinkGroupTree(group.id)
    }));
    
    console.log(`[LinkGroupTree] Built ${result.length} groups for parentId: ${parentId || 'null'}`);
    return result;
  };
  
  // Helper function to get all subgroup IDs recursively (similar to channel group implementation)
  const getAllSubgroupIds = (groupId: string): string[] => {
    const group = findGroupById(groupId);
    if (!group || !group.subgroups || group.subgroups.length === 0) {
      return [];
    }
    
    let subgroupIds: string[] = [];
    for (const subgroup of group.subgroups) {
      subgroupIds.push(subgroup.id);
      subgroupIds = [...subgroupIds, ...getAllSubgroupIds(subgroup.id)];
    }
    
    return subgroupIds;
  };
  
  // Context value with memoization to prevent unnecessary rerenders
  const contextValue = React.useMemo<LinkGroupContextType>(() => ({
    linkGroups,
    activeLinkGroupId,
    setActiveLinkGroupId,
    addLinkGroup,
    editLinkGroup,
    deleteLinkGroup,
    addLinkToGroup,
    removeLinkFromGroup,
    removeMultipleLinksFromGroup,
    loadLinkGroups,
    toggleSubgroupExpansion,
    getSubgroups,
    getTopLevelLinkGroups,
    getLinkGroupTree
  }), [
    linkGroups, 
    activeLinkGroupId, 
    setActiveLinkGroupId,
    addLinkGroup,
    editLinkGroup,
    deleteLinkGroup,
    addLinkToGroup,
    removeLinkFromGroup,
    removeMultipleLinksFromGroup,
    loadLinkGroups,
    toggleSubgroupExpansion,
    getSubgroups,
    getTopLevelLinkGroups,
    getLinkGroupTree
  ]);
  
  return (
    <LinkGroupContext.Provider value={contextValue}>
      {children}
    </LinkGroupContext.Provider>
  );
}; 