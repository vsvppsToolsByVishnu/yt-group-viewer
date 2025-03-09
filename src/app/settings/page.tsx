"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { useGroupContext } from '../context/GroupContext';
import { useAPIKeyContext } from '../context/APIKeyContext';
import { motion } from 'framer-motion';
import * as dbService from '../services/dbService';

export default function SettingsPage() {
  const router = useRouter();
  const { groups } = useGroupContext();
  const { apiKeys } = useAPIKeyContext();
  
  // State for export options
  const [exportOptions, setExportOptions] = useState({
    apiKeys: true,
    sqliteSequence: true,
    groups: true,
    channels: true,
    groupChannels: true
  });
  
  // State for selected groups (initialize with all groups selected)
  const [selectedGroups, setSelectedGroups] = useState<Record<string, boolean>>({});
  
  // State for export progress
  const [isExporting, setIsExporting] = useState(false);
  const [exportMethod, setExportMethod] = useState<'client' | 'server'>('client');
  
  // Add new state for import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | 'loading' | null; message: string }>({
    type: null,
    message: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Add importMethod state
  const [importMethod, setImportMethod] = useState<'client' | 'server'>('client');
  
  // Initialize selected groups when groups data loads
  useEffect(() => {
    const initialSelectedGroups: Record<string, boolean> = {};
    groups.forEach(group => {
      initialSelectedGroups[group.id] = true;
    });
    setSelectedGroups(initialSelectedGroups);
  }, [groups]);
  
  // Toggle export option
  const toggleExportOption = (option: keyof typeof exportOptions) => {
    setExportOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };
  
  // Toggle group selection
  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };
  
  // Select all groups
  const selectAllGroups = () => {
    const allSelected: Record<string, boolean> = {};
    groups.forEach(group => {
      allSelected[group.id] = true;
    });
    setSelectedGroups(allSelected);
  };
  
  // Deselect all groups
  const deselectAllGroups = () => {
    const allDeselected: Record<string, boolean> = {};
    groups.forEach(group => {
      allDeselected[group.id] = false;
    });
    setSelectedGroups(allDeselected);
  };
  
  // Export data using client-side method
  const exportDataClientSide = async () => {
    try {
      setIsExporting(true);
      
      // Gather data to export
      const dataToExport: any = {};
      
      // Include API keys if selected
      if (exportOptions.apiKeys) {
        dataToExport.apiKeys = apiKeys;
      }
      
      // Include SQLite sequence if selected
      if (exportOptions.sqliteSequence) {
        dataToExport.sqliteSequence = { name: 'api_keys', seq: apiKeys.length };
      }
      
      // Include groups if selected
      if (exportOptions.groups) {
        dataToExport.groups = groups.filter(group => selectedGroups[group.id]);
      }
      
      // Include channels and group-channel relationships if selected
      if (exportOptions.channels || exportOptions.groupChannels) {
        const selectedGroupsArray = groups.filter(group => selectedGroups[group.id]);
        
        if (exportOptions.channels) {
          // Extract unique channels from selected groups
          const channelsMap = new Map();
          selectedGroupsArray.forEach(group => {
            group.channels.forEach(channel => {
              channelsMap.set(channel.id, channel);
            });
          });
          dataToExport.channels = Array.from(channelsMap.values());
        }
        
        if (exportOptions.groupChannels) {
          // Create group-channel relationships
          const groupChannels: {groupId: string, channelId: string}[] = [];
          selectedGroupsArray.forEach(group => {
            group.channels.forEach(channel => {
              groupChannels.push({
                groupId: group.id,
                channelId: channel.id
              });
            });
          });
          dataToExport.groupChannels = groupChannels;
        }
      }
      
      // Create a blob with the data
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtube-groups-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data client-side:', error);
      alert('Failed to export data client-side. Try using server-side export instead.');
    } finally {
      setIsExporting(false);
    }
  };
  
  // Export data using server-side API
  const exportDataServerSide = async () => {
    try {
      setIsExporting(true);
      
      // Call the export API
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          options: exportOptions,
          selectedGroups
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred');
      }
      
      // Create a blob with the data
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtube-groups-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data server-side:', error);
      alert(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };
  
  // Main export function that chooses the appropriate method
  const exportData = async () => {
    if (exportMethod === 'client') {
      await exportDataClientSide();
    } else {
      await exportDataServerSide();
    }
  };
  
  // Handle file selection for import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setImportFile(files[0]);
      setImportStatus({ type: null, message: '' });
    }
  };
  
  // Import data using client-side method
  const importDataClientSide = async () => {
    if (!importFile) {
      setImportStatus({
        type: 'error',
        message: 'Please select a file to import'
      });
      return;
    }
    
    try {
      setImportStatus({
        type: 'loading',
        message: 'Importing data...'
      });
      
      // Read the file content
      const fileContent = await readFileAsText(importFile);
      
      // Parse the JSON data
      let data;
      try {
        data = JSON.parse(fileContent);
      } catch (error) {
        setImportStatus({
          type: 'error',
          message: 'Invalid JSON file. Please select a properly formatted export file.'
        });
        return;
      }
      
      // Validate the imported data
      if (!validateImportData(data)) {
        setImportStatus({
          type: 'error',
          message: 'Invalid data format. The file does not contain valid export data.'
        });
        return;
      }
      
      // Process API keys
      if (data.apiKeys && Array.isArray(data.apiKeys)) {
        for (const apiKey of data.apiKeys) {
          // Remove the id to create new entries
          const { id, ...apiKeyData } = apiKey;
          await dbService.saveAPIKey(apiKeyData);
        }
      }
      
      // Process groups and their channels
      if (data.groups && Array.isArray(data.groups)) {
        for (const group of data.groups) {
          await dbService.saveGroup(group);
        }
      }
      
      // Process individual channels if they exist
      if (data.channels && Array.isArray(data.channels)) {
        // We don't directly save individual channels since they are saved with groups
        console.log(`Found ${data.channels.length} individual channels in import`);
      }
      
      // Process group-channel relationships if they exist separately
      if (data.groupChannels && Array.isArray(data.groupChannels)) {
        console.log(`Found ${data.groupChannels.length} group-channel relationships in import`);
        
        // We don't need to process these separately as they're handled with group saves
      }
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setImportFile(null);
      
      // Show success message
      setImportStatus({
        type: 'success',
        message: 'Data imported successfully. Refresh the page to see the changes.'
      });
      
      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Error importing data:', error);
      setImportStatus({
        type: 'error',
        message: `Error importing data: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };
  
  // Import data using server-side API
  const importDataServerSide = async () => {
    if (!importFile) {
      setImportStatus({
        type: 'error',
        message: 'Please select a file to import'
      });
      return;
    }
    
    try {
      setImportStatus({
        type: 'loading',
        message: 'Importing data...'
      });
      
      // Read the file content
      const fileContent = await readFileAsText(importFile);
      
      // Parse the JSON data
      let data;
      try {
        data = JSON.parse(fileContent);
      } catch (error) {
        setImportStatus({
          type: 'error',
          message: 'Invalid JSON file. Please select a properly formatted export file.'
        });
        return;
      }
      
      // Send the data to the server
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred');
      }
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setImportFile(null);
      
      // Show success message
      setImportStatus({
        type: 'success',
        message: 'Data imported successfully. Refresh the page to see the changes.'
      });
      
      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Error importing data server-side:', error);
      setImportStatus({
        type: 'error',
        message: `Error importing data: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };
  
  // Main import function that chooses the appropriate method
  const importData = async () => {
    if (importMethod === 'client') {
      await importDataClientSide();
    } else {
      await importDataServerSide();
    }
  };
  
  // Helper function to read file content
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === 'string') {
          resolve(e.target.result);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsText(file);
    });
  };
  
  // Validate the import data structure
  const validateImportData = (data: any): boolean => {
    // Check if it has at least one of the expected properties
    return (
      (data.apiKeys && Array.isArray(data.apiKeys)) ||
      (data.groups && Array.isArray(data.groups)) ||
      (data.channels && Array.isArray(data.channels)) ||
      (data.groupChannels && Array.isArray(data.groupChannels))
    );
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Settings</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
        
        {/* Import Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Import Data</h2>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Import data from a previously exported file. This will add the imported data to your existing data.
              </p>
              
              <div className="mb-4">
                <h3 className="text-md font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Import Method
                </h3>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="importMethod"
                      checked={importMethod === 'client'}
                      onChange={() => setImportMethod('client')}
                      className="h-4 w-4 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Client-side (Faster)</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="importMethod"
                      checked={importMethod === 'server'}
                      onChange={() => setImportMethod('server')}
                      className="h-4 w-4 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Server-side (For larger files)</span>
                  </label>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="flex-1">
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="sr-only"
                      ref={fileInputRef}
                    />
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="relative px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-l-lg text-sm transition-colors flex-shrink-0 text-gray-700 dark:text-gray-300"
                      >
                        Choose File
                      </button>
                      <div className="border border-gray-300 dark:border-gray-600 py-2 px-3 rounded-r-lg text-sm text-gray-500 dark:text-gray-400 truncate flex-1 min-w-0">
                        {importFile ? importFile.name : 'No file selected'}
                      </div>
                    </div>
                  </div>
                </label>
                
                <button
                  onClick={importData}
                  disabled={!importFile || importStatus.type === 'loading'}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center sm:w-auto"
                >
                  {importStatus.type === 'loading' ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing...
                    </>
                  ) : (
                    'Import Data'
                  )}
                </button>
              </div>
              
              {importStatus.type && (
                <div className={`mt-3 p-3 rounded-md text-sm ${
                  importStatus.type === 'success' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : importStatus.type === 'error'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {importStatus.message}
                </div>
              )}
              
              <div className="mt-4 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800/50">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Import Notes:</h3>
                <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <li>Only JSON files exported from this application are supported</li>
                  <li>Importing will add to your existing data, not replace it</li>
                  <li>Duplicate entries (same ID) will be updated with the imported data</li>
                  <li>After import, the page will refresh to show the updated data</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Export Data</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-md font-medium mb-2 text-gray-700 dark:text-gray-300">
                What would you like to export?
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.apiKeys}
                    onChange={() => toggleExportOption('apiKeys')}
                    className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">API Keys</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.sqliteSequence}
                    onChange={() => toggleExportOption('sqliteSequence')}
                    className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">SQLite Sequence</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.groups}
                    onChange={() => toggleExportOption('groups')}
                    className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Groups</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.channels}
                    onChange={() => toggleExportOption('channels')}
                    className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Channels</span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={exportOptions.groupChannels}
                    onChange={() => toggleExportOption('groupChannels')}
                    className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Group-Channel Relationships</span>
                </label>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300">
                  Which groups would you like to include?
                </h3>
                
                <div className="flex gap-2">
                  <button
                    onClick={selectAllGroups}
                    className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAllGroups}
                    className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              
              {groups.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 italic">No groups found</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded">
                  {groups.map(group => (
                    <label key={group.id} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={!!selectedGroups[group.id]}
                        onChange={() => toggleGroupSelection(group.id)}
                        className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300 truncate">
                        {group.name} <span className="text-gray-400 text-xs">({group.channels.length} channels)</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="mb-4">
                <h3 className="text-md font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Export Method
                </h3>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="exportMethod"
                      checked={exportMethod === 'client'}
                      onChange={() => setExportMethod('client')}
                      className="h-4 w-4 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Client-side (Faster)</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="exportMethod"
                      checked={exportMethod === 'server'}
                      onChange={() => setExportMethod('server')}
                      className="h-4 w-4 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Server-side (More reliable)</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Use server-side for large datasets or if client-side export fails.
                </p>
              </div>
              
              <button
                onClick={exportData}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center"
                disabled={
                  isExporting ||
                  !Object.values(exportOptions).some(val => val) || // At least one export option must be selected
                  (exportOptions.groups && !Object.values(selectedGroups).some(val => val)) // If groups are selected, at least one group must be selected
                }
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  'Export Data'
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Additional settings sections can be added here in the future */}
      </div>
    </div>
  );
} 