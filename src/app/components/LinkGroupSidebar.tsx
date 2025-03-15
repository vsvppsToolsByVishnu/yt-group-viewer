"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { LinkGroup } from '../types';

// GroupItem component to render a group and its subgroups recursively
const GroupItem = ({ 
  group, 
  isCollapsed,
  level = 0,
  onStartEdit,
  onCreateSubgroup,
  linkGroups,
  activeLinkGroupId,
  setActiveLinkGroupId,
  deleteLinkGroup,
  toggleSubgroupExpansion
}: { 
  group: LinkGroup; 
  isCollapsed: boolean;
  level?: number;
  onStartEdit: (groupId: string, name: string) => void;
  onCreateSubgroup: (parentId: string) => void;
  linkGroups: LinkGroup[];
  activeLinkGroupId: string | null;
  setActiveLinkGroupId: (id: string | null) => void;
  deleteLinkGroup: (id: string) => Promise<void>;
  toggleSubgroupExpansion: (id: string) => Promise<void>;
}) => {
  // Always prioritize the subgroups property if it exists
  const subgroups = group.subgroups || [];
  const hasSubgroups = subgroups.length > 0;
  const isActive = activeLinkGroupId === group.id;
  const indent = level * 16; // 16px indentation per level

  // For debugging
  console.log(`Rendering group ${group.name} (${group.id}), has ${subgroups.length} subgroups, isExpanded: ${group.isExpanded}`);
  if (hasSubgroups) {
    console.log(`- Subgroups for ${group.name}: ${subgroups.map(sg => sg.name).join(', ')}`);
  }

  return (
    <>
      <motion.li 
        key={group.id} 
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="relative"
      >
        {/* Connection Line */}
        {level > 0 && !isCollapsed && (
          <>
            <div 
              className="absolute border-l-2 border-gray-300 dark:border-gray-700" 
              style={{ 
                left: `${indent - 12}px`, 
                height: '50%',
                top: 0,
                width: '1px'
              }}
            />
            <div 
              className="absolute border-l-2 border-gray-300 dark:border-gray-700" 
              style={{ 
                left: `${indent - 12}px`, 
                height: '10px',
                top: '50%',
                width: '1px'
              }}
            />
            <div 
              className="absolute border-b-2 border-gray-300 dark:border-gray-700 rounded-bl-lg" 
              style={{ 
                left: `${indent - 12}px`, 
                width: '12px',
                top: 'calc(50% + 9px)',
                height: '10px',
                borderBottomLeftRadius: '8px'
              }}
            />
          </>
        )}

        <div className="group">
          <div 
            className={`w-full text-left rounded-lg transition-colors flex items-center ${
              isActive
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            style={{ paddingLeft: isCollapsed ? '1rem' : `${indent + 16}px` }}
          >
            {/* Toggle Button for Subgroups */}
            {hasSubgroups && !isCollapsed && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log(`Toggling expansion for group ${group.name}`);
                  toggleSubgroupExpansion(group.id).catch(err => 
                    console.error(`Error toggling expansion for group ${group.id}:`, err)
                  );
                }}
                className="mr-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label={group.isExpanded ? "Collapse subgroups" : "Expand subgroups"}
                type="button"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-3.5 w-3.5 transition-transform ${group.isExpanded ? 'rotate-90' : ''}`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            
            {/* Group Icon with Level Indication */}
            <div className="flex-shrink-0 mr-2">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 ${level > 0 ? 'text-gray-500 dark:text-gray-400' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" 
                />
              </svg>
            </div>
            
            <button
              className={`py-2 pr-2 flex-1 flex items-center ${isCollapsed ? 'justify-center' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Set this group as active
                setActiveLinkGroupId(group.id);
                
                // If this group has subgroups and isn't expanded, expand it automatically
                if (hasSubgroups && !group.isExpanded) {
                  console.log(`Auto-expanding group ${group.name} because it was selected and has subgroups`);
                  toggleSubgroupExpansion(group.id).catch(err => 
                    console.error(`Error expanding group ${group.id}:`, err)
                  );
                }
              }}
              type="button"
            >
              {!isCollapsed && (
                <>
                  <span className="flex-1 truncate">{group.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${
                    isActive 
                      ? 'bg-red-200 dark:bg-red-900/50 text-red-600 dark:text-red-400' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {group.links?.length || 0}
                  </span>
                </>
              )}
            </button>
            
            {/* Group Actions */}
            {!isCollapsed && isActive && (
              <div className="absolute right-0 top-0 h-full flex items-center mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 p-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStartEdit(group.id, group.name);
                  }}
                  aria-label="Edit group"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="text-gray-500 hover:text-green-500 dark:text-gray-400 dark:hover:text-green-400 p-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onCreateSubgroup(group.id);
                  }}
                  aria-label="Add subgroup"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 p-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.confirm('Are you sure you want to delete this group and all links in it?')) {
                      deleteLinkGroup(group.id);
                    }
                  }}
                  aria-label="Delete group"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </motion.li>
      
      {/* Render Subgroups */}
      {!isCollapsed && hasSubgroups && (
        <div className={group.isExpanded ? 'ml-4' : 'ml-4 hidden'}>
          <AnimatePresence>
            {subgroups.map(subgroup => (
              <GroupItem 
                key={subgroup.id}
                group={subgroup}
                isCollapsed={isCollapsed}
                level={level + 1}
                onStartEdit={onStartEdit}
                onCreateSubgroup={onCreateSubgroup}
                linkGroups={linkGroups}
                activeLinkGroupId={activeLinkGroupId}
                setActiveLinkGroupId={setActiveLinkGroupId}
                deleteLinkGroup={deleteLinkGroup}
                toggleSubgroupExpansion={toggleSubgroupExpansion}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );
};

interface LinkGroupSidebarProps {
  linkGroups: LinkGroup[];
  activeLinkGroupId: string | null;
  setActiveLinkGroupId: (id: string | null) => void;
  addLinkGroup: (group: Omit<LinkGroup, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  editLinkGroup: (id: string, updates: Partial<LinkGroup>) => Promise<void>;
  deleteLinkGroup: (id: string) => Promise<void>;
  toggleSubgroupExpansion: (id: string) => Promise<void>;
}

export default function LinkGroupSidebar({
  linkGroups,
  activeLinkGroupId,
  setActiveLinkGroupId,
  addLinkGroup,
  editLinkGroup,
  deleteLinkGroup,
  toggleSubgroupExpansion
}: LinkGroupSidebarProps) {
  const router = useRouter();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [parentForNewGroup, setParentForNewGroup] = useState<string | null>(null);
  
  // Get top-level groups (no parentId)
  // Since linkGroups is already a hierarchical tree, these are the top-level items
  const topLevelGroups = linkGroups;
  
  // Debug logs
  console.log(`LinkGroupSidebar: Received ${linkGroups.length} top-level groups`);
  linkGroups.forEach(group => {
    console.log(`- Group: ${group.name} (${group.id}) has ${group.subgroups?.length || 0} subgroups`);
  });

  // Helper function to find a group's parent
  const findParentGroup = (groupId: string, groups: LinkGroup[], parentId: string | null = null): string | null => {
    for (const group of groups) {
      if (group.id === groupId) {
        return parentId;
      }
      
      if (group.subgroups && group.subgroups.length > 0) {
        const foundInSubgroups = findParentGroup(groupId, group.subgroups, group.id);
        if (foundInSubgroups) {
          return foundInSubgroups;
        }
      }
    }
    
    return null;
  };
  
  // Ensure parent groups are expanded when a subgroup is selected
  useEffect(() => {
    if (activeLinkGroupId) {
      const ensureParentExpanded = async (groupId: string) => {
        const parentId = findParentGroup(groupId, linkGroups);
        
        if (parentId) {
          console.log(`LinkGroupSidebar: Ensuring parent group ${parentId} is expanded for active group ${groupId}`);
          
          // Find the parent group to check if it's already expanded
          const findGroup = (id: string, groups: LinkGroup[]): LinkGroup | null => {
            for (const group of groups) {
              if (group.id === id) {
                return group;
              }
              
              if (group.subgroups && group.subgroups.length > 0) {
                const found = findGroup(id, group.subgroups);
                if (found) {
                  return found;
                }
              }
            }
            
            return null;
          };
          
          const parentGroup = findGroup(parentId, linkGroups);
          
          // If parent exists and is not expanded, expand it
          if (parentGroup && !parentGroup.isExpanded) {
            await toggleSubgroupExpansion(parentId);
          }
        }
      };
      
      ensureParentExpanded(activeLinkGroupId);
    }
  }, [activeLinkGroupId, linkGroups, toggleSubgroupExpansion]);
  
  // Handle creating a new group
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGroupName.trim()) {
      addLinkGroup({
        name: newGroupName.trim(),
        parentId: parentForNewGroup || undefined,
        links: [],
        isExpanded: true
      }).then(() => {
        setNewGroupName('');
        setShowNewGroupForm(false);
        setParentForNewGroup(null);
      }).catch(error => {
        console.error('Error creating group:', error);
        // Keep the form open in case of error
      });
    }
  };
  
  // Handle starting to edit a group
  const handleStartEdit = (groupId: string, currentName: string) => {
    setEditingGroupId(groupId);
    setEditGroupName(currentName);
  };
  
  // Handle saving edited group name
  const handleSaveEdit = (e: React.FormEvent, groupId: string) => {
    e.preventDefault();
    if (editGroupName.trim()) {
      editLinkGroup(groupId, {
        name: editGroupName.trim()
      });
      setEditingGroupId(null);
      setEditGroupName('');
    }
  };
  
  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setEditGroupName('');
  };
  
  // Handle starting to create a subgroup
  const handleStartCreateSubgroup = (parentId: string) => {
    setParentForNewGroup(parentId);
    setShowNewGroupForm(true);
  };

  return (
    <motion.div 
      className={`h-full bg-background border-r border-gray-200 dark:border-gray-800 ${
        isCollapsed ? 'w-16' : 'w-64'
      } transition-all duration-300 flex flex-col`}
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        {!isCollapsed && <h2 className="font-semibold text-lg">Link Groups</h2>}
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
        >
          {isCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <AnimatePresence>
          {topLevelGroups.length === 0 && !isCollapsed && (
            <motion.div 
              className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-sm">No groups yet.</p>
              <p className="text-sm mt-1">Create a group to get started.</p>
            </motion.div>
          )}
        </AnimatePresence>
        
        <ul>
          {/* Render Groups */}
          {topLevelGroups.map(group => 
            editingGroupId === group.id ? (
              <form 
                key={group.id}
                onSubmit={(e) => handleSaveEdit(e, group.id)}
                className="px-4 py-2 flex items-center space-x-2"
              >
                <input
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className="flex-1 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-background text-sm"
                  autoFocus
                />
                <button 
                  type="submit"
                  aria-label="Save"
                  className="text-green-600 dark:text-green-400 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button 
                  type="button"
                  onClick={handleCancelEdit}
                  aria-label="Cancel"
                  className="text-red-600 dark:text-red-400 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </form>
            ) : (
              <GroupItem 
                key={group.id} 
                group={group} 
                isCollapsed={isCollapsed} 
                onStartEdit={handleStartEdit}
                onCreateSubgroup={handleStartCreateSubgroup}
                linkGroups={linkGroups}
                activeLinkGroupId={activeLinkGroupId}
                setActiveLinkGroupId={setActiveLinkGroupId}
                deleteLinkGroup={deleteLinkGroup}
                toggleSubgroupExpansion={toggleSubgroupExpansion}
              />
            )
          )}
        </ul>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        {showNewGroupForm && !isCollapsed ? (
          <form onSubmit={handleCreateGroup} className="mb-2">
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                placeholder={parentForNewGroup ? "Subgroup name" : "Group name"}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background"
                autoFocus
              />
              <button 
                type="submit"
                aria-label="Create"
                className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
            {parentForNewGroup && (
              <p className="text-xs text-gray-500 mb-2">
                Creating subgroup in: {linkGroups.find(g => g.id === parentForNewGroup)?.name || "Selected group"}
              </p>
            )}
            <button 
              type="button" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowNewGroupForm(false);
                setParentForNewGroup(null);
              }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:underline w-full text-center"
            >
              Cancel
            </button>
          </form>
        ) :
          <motion.button
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isCollapsed) {
                setShowNewGroupForm(true);
              }
            }}
            type="button"
          >
            {isCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            ) : (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Group</span>
              </div>
            )}
          </motion.button>
        }
      </div>
    </motion.div>
  );
} 