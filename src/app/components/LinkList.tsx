"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '../types';

interface LinkListProps {
  links: Link[];
  onRemoveLink: (linkId: string) => void;
  onRemoveMultipleLinks: (linkIds: string[]) => void;
}

export default function LinkList({ links, onRemoveLink, onRemoveMultipleLinks }: LinkListProps) {
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'title' | 'createdAt' | 'updatedAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  // Handle selecting/deselecting a link
  const toggleLinkSelection = (linkId: string) => {
    const newSelection = new Set(selectedLinks);
    if (newSelection.has(linkId)) {
      newSelection.delete(linkId);
    } else {
      newSelection.add(linkId);
    }
    setSelectedLinks(newSelection);
  };
  
  // Handle selecting/deselecting all links
  const toggleSelectAll = () => {
    if (selectedLinks.size === filteredLinks.length) {
      setSelectedLinks(new Set());
    } else {
      setSelectedLinks(new Set(filteredLinks.map(link => link.id)));
    }
  };
  
  // Handle bulk delete
  const handleBulkDelete = () => {
    if (selectedLinks.size > 0) {
      onRemoveMultipleLinks(Array.from(selectedLinks));
      setSelectedLinks(new Set());
    }
  };
  
  // Filter links based on search term
  const filteredLinks = links.filter(link => 
    link.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (link.description && link.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    link.url.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Sort links
  const sortedLinks = [...filteredLinks].sort((a, b) => {
    let valueA, valueB;
    
    if (sortBy === 'title') {
      valueA = a.title.toLowerCase();
      valueB = b.title.toLowerCase();
    } else {
      valueA = a[sortBy];
      valueB = b[sortBy];
    }
    
    if (sortOrder === 'asc') {
      return valueA > valueB ? 1 : -1;
    } else {
      return valueA < valueB ? 1 : -1;
    }
  });
  
  // Toggle sort order
  const handleSortChange = (field: 'title' | 'createdAt' | 'updatedAt') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };
  
  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search links..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {selectedLinks.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Selected ({selectedLinks.size})
          </button>
        )}
      </div>
      
      {/* Links Table */}
      {filteredLinks.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">
                  <input
                    type="checkbox"
                    checked={selectedLinks.size === filteredLinks.length && filteredLinks.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortChange('title')}
                >
                  <div className="flex items-center">
                    Title
                    {sortBy === 'title' && (
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 ${sortOrder === 'desc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  URL
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                  Created
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                  Updated
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedLinks.map(link => (
                <React.Fragment key={link.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedLinks.has(link.id)}
                        onChange={() => toggleLinkSelection(link.id)}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{link.title}</div>
                      {link.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{link.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-sm text-red-600 dark:text-red-400 hover:underline truncate block max-w-xs"
                      >
                        {link.url.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '')}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {formatDate(link.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      {formatDate(link.updatedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => setConfirmDelete(link.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  
                  {/* Delete confirmation */}
                  <AnimatePresence>
                    {confirmDelete === link.id && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-50 dark:bg-red-900/30"
                      >
                        <td colSpan={6} className="px-6 py-4">
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-red-800 dark:text-red-200">
                              Are you sure you want to delete "{link.title}"?
                            </p>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  onRemoveLink(link.id);
                                  setConfirmDelete(null);
                                  if (selectedLinks.has(link.id)) {
                                    const newSelection = new Set(selectedLinks);
                                    newSelection.delete(link.id);
                                    setSelectedLinks(newSelection);
                                  }
                                }}
                                className="px-3 py-1 text-xs bg-red-600 text-white rounded"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {searchTerm ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-lg">No links match your search</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <p className="text-lg">No links in this group yet</p>
              <p className="text-sm mt-1">Click the "Add Link" button to add your first link</p>
            </>
          )}
        </div>
      )}
    </div>
  );
} 