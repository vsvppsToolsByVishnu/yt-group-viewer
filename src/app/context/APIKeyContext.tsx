"use client";

import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode 
} from 'react';
import { APIKey } from '../types';
import * as dbService from '../services/dbService';

interface APIKeyContextType {
  apiKeys: APIKey[];
  activeKey: string | null;
  isLoading: boolean;
  addAPIKey: (name: string, key: string) => Promise<void>;
  removeAPIKey: (id: string) => Promise<void>;
  reorderAPIKeys: (orderedKeys: APIKey[]) => Promise<void>;
  testAPIKey: (key: string) => Promise<boolean>;
}

// Default context values
const APIKeyContext = createContext<APIKeyContextType>({
  apiKeys: [],
  activeKey: null,
  isLoading: true,
  addAPIKey: async () => {},
  removeAPIKey: async () => {},
  reorderAPIKeys: async () => {},
  testAPIKey: async () => false
});

// Custom hook for using this context
export const useAPIKeyContext = () => useContext(APIKeyContext);

// Provider component
export function APIKeyProvider({ children }: { children: ReactNode }) {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load API keys on initial mount
  useEffect(() => {
    const loadAPIKeys = async () => {
      setIsLoading(true);
      try {
        // Use the new dbService to get API keys
        const keys = await dbService.getAPIKeys();
        setApiKeys(keys);
        
        // Set the active key
        const workingKey = await dbService.getWorkingAPIKey();
        setActiveKey(workingKey);
      } catch (error) {
        console.error('Error loading API keys:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAPIKeys();
  }, []);

  // Add a new API key
  const addAPIKey = async (name: string, key: string) => {
    try {
      // Create a new API key with the next priority
      const newKey: APIKey = {
        name,
        key,
        priority: apiKeys.length,
        isActive: true
      };
      
      // Save to the database using the new dbService
      const id = await dbService.saveAPIKey(newKey);
      
      // Update local state
      setApiKeys([...apiKeys, { ...newKey, id }]);
      
      // If this is the first key, set it as active
      if (apiKeys.length === 0) {
        setActiveKey(key);
      }
    } catch (error) {
      console.error('Error adding API key:', error);
      throw error;
    }
  };

  // Remove an API key
  const removeAPIKey = async (id: string) => {
    try {
      // Delete from the database using the new dbService
      await dbService.deleteAPIKey(id);
      
      // Update local state
      const updatedKeys = apiKeys.filter(key => key.id !== id);
      setApiKeys(updatedKeys);
      
      // If we removed the active key, update the active key
      const removedKey = apiKeys.find(key => key.id === id);
      if (removedKey && removedKey.key === activeKey) {
        const workingKey = await dbService.getWorkingAPIKey();
        setActiveKey(workingKey);
      }
      
      // Reorder remaining keys
      await reorderAPIKeys(updatedKeys);
    } catch (error) {
      console.error('Error removing API key:', error);
      throw error;
    }
  };

  // Reorder API keys (after drag and drop)
  const reorderAPIKeys = async (orderedKeys: APIKey[]) => {
    try {
      // Update priorities in the database using the new dbService
      await dbService.updateAPIKeyPriorities(orderedKeys);
      
      // Update local state with the new order
      setApiKeys([...orderedKeys]);
    } catch (error) {
      console.error('Error reordering API keys:', error);
      throw error;
    }
  };

  // Test if an API key is valid (this would connect to the YouTube API in a real app)
  const testAPIKey = async (key: string): Promise<boolean> => {
    try {
      // In a real app, we would make a test call to the YouTube API
      // For now, just simulate a successful test
      return true;
    } catch (error) {
      console.error('Error testing API key:', error);
      return false;
    }
  };

  // Create the context value
  const value = {
    apiKeys,
    activeKey,
    isLoading,
    addAPIKey,
    removeAPIKey,
    reorderAPIKeys,
    testAPIKey
  };

  return (
    <APIKeyContext.Provider value={value}>
      {children}
    </APIKeyContext.Provider>
  );
} 