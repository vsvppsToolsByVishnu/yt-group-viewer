"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGroupContext } from '../context/GroupContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Sidebar() {
  const router = useRouter();
  const {
    groups,
    activeGroupId,
    setActiveGroupId,
    addGroup,
    editGroup,
    deleteGroup
  } = useGroupContext();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  
  // Handle creating a new group
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGroupName.trim()) {
      addGroup(newGroupName.trim());
      setNewGroupName('');
      setShowNewGroupForm(false);
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
      editGroup(groupId, editGroupName.trim());
      setEditingGroupId(null);
      setEditGroupName('');
    }
  };
  
  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setEditGroupName('');
  };
  
  // Handle deleting a group with confirmation
  const handleDeleteGroup = (groupId: string) => {
    if (window.confirm('Are you sure you want to delete this group?')) {
      deleteGroup(groupId);
    }
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
        {!isCollapsed && <h2 className="font-semibold text-lg">My Groups</h2>}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
          {groups.length === 0 && !isCollapsed && (
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
        
        <ul className="space-y-1">
          {groups.map((group) => (
            <motion.li 
              key={group.id} 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative"
            >
              {editingGroupId === group.id ? (
                <form 
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
                <div className="group">
                  <button
                    className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                      activeGroupId === group.id
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    } ${isCollapsed ? 'justify-center' : ''} flex items-center`}
                    onClick={() => setActiveGroupId(group.id)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    {!isCollapsed && (
                      <>
                        <span className="flex-1">{group.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          activeGroupId === group.id 
                            ? 'bg-red-200 dark:bg-red-900/50 text-red-600 dark:text-red-400' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {group.channels.length}
                        </span>
                      </>
                    )}
                  </button>
                  
                  {/* Group Actions (only shown when group is active and sidebar is expanded) */}
                  {!isCollapsed && activeGroupId === group.id && (
                    <div className="absolute right-0 top-0 h-full flex items-center mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/channels/${group.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 p-1"
                        aria-label="Manage channels"
                      >
                        <motion.span
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="inline-block"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </motion.span>
                      </Link>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(group.id, group.name);
                        }}
                        aria-label="Edit group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                        aria-label="Delete group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </motion.button>
                    </div>
                  )}
                </div>
              )}
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        {showNewGroupForm && !isCollapsed ? (
          <form onSubmit={handleCreateGroup} className="mb-2">
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                placeholder="Group name"
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
            <button 
              type="button" 
              onClick={() => setShowNewGroupForm(false)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:underline w-full text-center"
            >
              Cancel
            </button>
          </form>
        ) : (
          <motion.button
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => !isCollapsed && setShowNewGroupForm(true)}
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
        )}
      </div>
    </motion.div>
  );
} 