"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { APIKey } from '../../types';
import { useState } from 'react';

interface APIKeyItemProps {
  apiKey: APIKey;
  onDelete: (id: string) => Promise<void>;
}

export default function APIKeyItem({ apiKey, onDelete }: APIKeyItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: apiKey.id! });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 1
  };
  
  // Mask the API key for display
  const getMaskedKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };
  
  // Handle delete button click
  const handleDelete = async () => {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }
    
    setIsDeleting(true);
    try {
      await onDelete(apiKey.id!);
    } catch (error) {
      console.error('Error deleting API key:', error);
    } finally {
      setIsDeleting(false);
      setIsConfirming(false);
    }
  };
  
  // Cancel delete confirmation
  const cancelDelete = () => {
    setIsConfirming(false);
  };
  
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between ${isDragging ? 'shadow-md' : ''}`}
    >
      <div className="flex items-center w-full">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab mr-3 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
        
        {/* Key details */}
        <div className="flex-1 pr-3">
          <div className="font-medium text-gray-800 dark:text-white truncate">
            {apiKey.name}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">
            {getMaskedKey(apiKey.key)}
          </div>
        </div>
        
        {/* Priority indicator */}
        <div className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs mr-3">
          Priority: {apiKey.priority + 1}
        </div>
        
        {/* Delete button */}
        {isConfirming ? (
          <div className="flex items-center">
            <button
              onClick={cancelDelete}
              disabled={isDeleting}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 p-1 mr-2"
              aria-label="Cancel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
              aria-label="Confirm Delete"
            >
              {isDeleting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-red-500"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
            aria-label="Delete"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </li>
  );
} 