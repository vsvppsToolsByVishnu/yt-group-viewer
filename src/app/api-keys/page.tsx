"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAPIKeyContext } from '../context/APIKeyContext';
import Header from '../components/Header';
import APIKeyItem from './components/APIKeyItem';

export default function APIKeysPage() {
  const router = useRouter();
  const { apiKeys, addAPIKey, removeAPIKey, reorderAPIKeys, isLoading, testAPIKey } = useAPIKeyContext();
  
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = apiKeys.findIndex(key => key.id === active.id);
      const newIndex = apiKeys.findIndex(key => key.id === over.id);
      
      const newOrder = arrayMove(apiKeys, oldIndex, newIndex);
      reorderAPIKeys(newOrder);
    }
  };
  
  // Handle form submission for adding a new API key
  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newKeyName.trim() || !newKeyValue.trim()) {
      setError('Please provide both a name and an API key.');
      return;
    }
    
    try {
      // Test if the key is valid
      const isValid = await testAPIKey(newKeyValue);
      
      if (!isValid) {
        setError('The API key is not valid. Please check and try again.');
        return;
      }
      
      // Add the key
      await addAPIKey(newKeyName.trim(), newKeyValue.trim());
      
      // Reset form
      setNewKeyName('');
      setNewKeyValue('');
      setError(null);
      setSuccess('API key added successfully.');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError('An error occurred while adding the API key. Please try again.');
      console.error(err);
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">YouTube API Keys</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Add New API Key</h2>
          
          <form onSubmit={handleAddKey} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="keyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  id="keyName"
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="My YouTube API Key"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="keyValue" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
                </label>
                <input
                  id="keyValue"
                  type="text"
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder="AIza..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Add API Key
              </button>
            </div>
            
            {error && (
              <div className="p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md">
                {error}
              </div>
            )}
            
            {success && (
              <div className="p-3 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md">
                {success}
              </div>
            )}
          </form>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
            API Keys Priority
            {apiKeys.length > 0 && <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">(Drag to reorder)</span>}
          </h2>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="mb-2">No API keys added yet.</p>
              <p className="text-sm">Add an API key above to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Keys are tried in order from top to bottom. If one key fails, the next one will be used.
              </p>
              
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={apiKeys.map(key => key.id!)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2">
                    {apiKeys.map((key) => (
                      <APIKeyItem
                        key={key.id}
                        apiKey={key}
                        onDelete={removeAPIKey}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
        
        {/* API Quota Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
            YouTube API Quota Information
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md mb-4">
              <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Understanding YouTube API Quota</h3>
              <p className="text-sm mb-2">
                The YouTube Data API uses a quota system to ensure fair usage. Each API key has a quota limit of <strong>10,000 units per day</strong>.
              </p>
              <p className="text-sm">
                Different operations consume different amounts of quota:
              </p>
              <ul className="list-disc list-inside text-sm mt-1 space-y-1 ml-2">
                <li>Reading channel information: <strong>1 unit</strong></li>
                <li>Searching for channels: <strong>100 units</strong></li>
                <li>Listing videos from a channel: <strong>1 unit</strong> + <strong>5 units</strong> for video details</li>
              </ul>
            </div>
            
            <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Tips to Avoid Quota Issues:</h3>
            <ol className="list-decimal list-inside space-y-2 ml-2 text-sm">
              <li>
                <strong>Add multiple API keys</strong> - The app will automatically switch to the next key if one reaches its quota limit
              </li>
              <li>
                <strong>Use channel IDs when possible</strong> - Adding channels by ID (youtube.com/channel/UC...) uses less quota than searching
              </li>
              <li>
                <strong>Limit search operations</strong> - Channel searches consume significant quota (100 units each)
              </li>
              <li>
                <strong>Create project-specific API keys</strong> - Create separate keys for different projects to better manage quotas
              </li>
            </ol>
            
            <h3 className="font-medium text-gray-800 dark:text-gray-200 mt-4 mb-2">How to Create YouTube API Keys:</h3>
            <ol className="list-decimal list-inside space-y-2 ml-2 text-sm">
              <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">Google Cloud Console</a></li>
              <li>Create a new project or select an existing one</li>
              <li>Navigate to <strong>APIs &amp; Services</strong> {'->'} <strong>Library</strong></li>
              <li>Search for "<strong>YouTube Data API v3</strong>" and enable it</li>
              <li>Go to <strong>APIs &amp; Services</strong> {'->'} <strong>Credentials</strong></li>
              <li>Click <strong>Create Credentials</strong> {'->'} <strong>API Key</strong></li>
              <li>Copy the API key and add it to this app</li>
              <li>Optional: Restrict the key to YouTube Data API only</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
} 