"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { useGroupContext } from '../context/GroupContext';
import { useAPIKeyContext } from '../context/APIKeyContext';
import { useLinkGroupContext } from '../context/LinkGroupContext';
import { motion } from 'framer-motion';
import * as dbService from '../services/dbService';
import { Group } from '../types';

export default function SettingsPage() {
  const router = useRouter();
  const { groups } = useGroupContext();
  const { apiKeys } = useAPIKeyContext();
  const { linkGroups } = useLinkGroupContext();
  
  // State for export options
  const [exportOptions, setExportOptions] = useState({
    apiKeys: true,
    sqliteSequence: true,
    groups: true,
    channels: true,
    groupChannels: true,
    linkGroups: true
  });
  
  // State for selected groups (initialize with all groups selected)
  const [selectedGroups, setSelectedGroups] = useState<Record<string, boolean>>({});
  
  // State for export progress
  const [isExporting, setIsExporting] = useState(false);
  
  // Add new state for import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | 'loading' | null; message: string }>({
    type: null,
    message: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize selected groups when groups data loads
  useEffect(() => {
    const initialSelectedGroups: Record<string, boolean> = {};
    // Only include top-level groups in the selection list
    const topLevelGroups = groups.filter(group => !group.parentId);
    topLevelGroups.forEach(group => {
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
    // Only select top-level groups
    groups.filter(group => !group.parentId).forEach(group => {
      allSelected[group.id] = true;
    });
    setSelectedGroups(allSelected);
  };
  
  // Deselect all groups
  const deselectAllGroups = () => {
    const allDeselected: Record<string, boolean> = {};
    // Only include top-level groups
    groups.filter(group => !group.parentId).forEach(group => {
      allDeselected[group.id] = false;
    });
    setSelectedGroups(allDeselected);
  };
  
  // Export data using server-side API
  const exportDataServerSide = async () => {
    try {
      setIsExporting(true);
      
      console.log('Starting server-side export process...');
      
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
        const errorText = await response.text();
        console.error(`Server error response:`, errorText);
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      let result;
      try {
        result = await response.json();
      } catch (error) {
        console.error('Error parsing server response:', error);
        throw new Error('Failed to parse server response');
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred');
      }
      
      console.log(`Export successful. Received data structure:`, {
        hasGroups: !!result.data.groups && Array.isArray(result.data.groups),
        groupCount: result.data.groups?.length || 0,
        hasApiKeys: !!result.data.apiKeys && Array.isArray(result.data.apiKeys),
        apiKeyCount: result.data.apiKeys?.length || 0,
        hasChannels: !!result.data.channels && Array.isArray(result.data.channels),
        channelCount: result.data.channels?.length || 0
      });
      
      // Ensure the data is properly formatted JSON
      let formattedData;
      try {
        // First stringify with null replacer to handle any circular references
        const sanitized = JSON.stringify(result.data);
        // Then parse and re-stringify with formatting
        formattedData = JSON.stringify(JSON.parse(sanitized), null, 2);
      } catch (error) {
        console.error('Error formatting export data:', error);
        throw new Error('Failed to format export data');
      }
      
      // Create a blob with the data
      const blob = new Blob([formattedData], { type: 'application/json' });
      
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
      
      console.log('Export file has been generated and download has started');
    } catch (error) {
      console.error('Error exporting data server-side:', error);
      alert(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };
  
  // Main export function - directly use server-side
  const exportData = async () => {
    await exportDataServerSide();
  };
  
  // Handle file selection for import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setImportFile(files[0]);
      setImportStatus({ type: null, message: '' });
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
      
      // Log file content length for debugging
      console.log(`File content length: ${fileContent.length} characters`);
      if (fileContent.length < 50) {
        console.log(`Full file content (might be empty): ${fileContent}`);
      } else {
        console.log(`File content preview: ${fileContent.substring(0, 50)}...`);
      }
      
      // Parse the JSON data with error handling
      let data;
      try {
        data = JSON.parse(fileContent);
      } catch (error) {
        console.error('JSON parse error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown JSON parsing error';
        setImportStatus({
          type: 'error',
          message: `Invalid JSON file: ${errorMessage}. Please select a properly formatted export file.`
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
      
      // Enhanced debugging for API keys
      if (data.apiKeys && Array.isArray(data.apiKeys)) {
        console.log(`Processing ${data.apiKeys.length} API keys`);
      }
      
      // Process groups to ensure hierarchical structure
      if (data.groups && Array.isArray(data.groups)) {
        console.log(`Processing ${data.groups.length} groups`);
        
        // Type the groups for easier handling
        interface ImportedGroup {
          id: string;
          name: string;
          parentId?: string;
          channels?: any[];
          isExpanded?: boolean;
          subgroups?: ImportedGroup[];
          [key: string]: any;
        }
        
        // Check if data already has a hierarchical structure (with nested subgroups)
        let hasHierarchicalStructure = false;
        for (const group of data.groups) {
          if (group.subgroups && Array.isArray(group.subgroups) && group.subgroups.length > 0) {
            hasHierarchicalStructure = true;
            break;
          }
        }
        
        // If the data already has a hierarchical structure, we need to flatten it
        // for the server to correctly process it, then rebuild the hierarchy
        if (hasHierarchicalStructure) {
          console.log("Found hierarchical structure in import data - flattening for processing");
          
          // Function to flatten hierarchical groups
          const flattenGroups = (groups: ImportedGroup[], parentId?: string): ImportedGroup[] => {
            let result: ImportedGroup[] = [];
            
            for (const group of groups) {
              // Clone the group without subgroups
              const flatGroup = { ...group };
              if (parentId) {
                flatGroup.parentId = parentId;
              }
              
              // Remove subgroups from the cloned group
              delete flatGroup.subgroups;
              
              // Add the flattened group to the result
              result.push(flatGroup);
              
              // Process subgroups if they exist
              if (group.subgroups && group.subgroups.length > 0) {
                // Recursively flatten subgroups, passing current group id as parent
                const flattenedSubgroups = flattenGroups(group.subgroups, group.id);
                result = [...result, ...flattenedSubgroups];
              }
            }
            
            return result;
          };
          
          // Flatten the hierarchical groups
          const flatGroups = flattenGroups(data.groups as ImportedGroup[]);
          console.log(`Flattened ${data.groups.length} hierarchical groups into ${flatGroups.length} flat groups`);
          
          // Replace the groups in the data
          data.groups = flatGroups;
        }
        
        // Now rebuild the hierarchical structure from the flat list
        console.log("Building hierarchical structure from groups...");
        
        // Cast the groups to the typed interface
        const typedGroups = data.groups as ImportedGroup[];
        
        // Create a map of all groups by ID for quick lookup
        const groupMap = new Map<string, ImportedGroup>();
        typedGroups.forEach(group => {
          groupMap.set(group.id, {
            ...group,
            subgroups: [] // Initialize empty subgroups array
          });
        });
        
        // Identify top-level groups and build the hierarchy
        const topLevelGroups: ImportedGroup[] = [];
        
        // First, organize groups into parent-child relationships
        typedGroups.forEach(group => {
          if (group.parentId) {
            // This is a subgroup - find its parent
            const parent = groupMap.get(group.parentId);
            if (parent) {
              // Add this group as a subgroup of its parent
              if (!parent.subgroups) parent.subgroups = [];
              
              // Get the complete group from the map to ensure it has its own subgroups properly set
              const completeGroup = groupMap.get(group.id);
              if (completeGroup) {
                console.log(`Adding ${group.name} (${group.id}) as subgroup of ${parent.name} (${parent.id})`);
                parent.subgroups.push(completeGroup);
              }
            } else {
              console.warn(`Parent group ${group.parentId} not found for ${group.name} (${group.id}) - treating as top-level`);
              topLevelGroups.push(groupMap.get(group.id)!);
            }
          } else {
            // This is a top-level group
            topLevelGroups.push(groupMap.get(group.id)!);
          }
        });
        
        console.log(`Organized into ${topLevelGroups.length} top-level groups with proper hierarchy`);
        
        // Replace the groups with the hierarchical structure
        data.groups = topLevelGroups;
        
        // Log detailed information about the hierarchy
        const countAllSubgroups = (groups: ImportedGroup[]): number => {
          let count = 0;
          groups.forEach(group => {
            if (group.subgroups && group.subgroups.length > 0) {
              count += group.subgroups.length;
              count += countAllSubgroups(group.subgroups);
            }
          });
          return count;
        };
        
        const totalSubgroups = countAllSubgroups(topLevelGroups);
        console.log(`Hierarchical structure: ${topLevelGroups.length} top-level groups with ${totalSubgroups} total subgroups`);
        
        // Log sample of the first group's hierarchy if available
        if (topLevelGroups.length > 0 && topLevelGroups[0].subgroups && topLevelGroups[0].subgroups.length > 0) {
          console.log(`First top-level group "${topLevelGroups[0].name}" has ${topLevelGroups[0].subgroups.length} direct subgroups:`);
          topLevelGroups[0].subgroups.forEach(sg => {
            console.log(`  - ${sg.name} (${sg.id})`);
          });
        }
      }
      
      // Prepare data for server-side import with stringified data
      // Using a sanitized approach to avoid circular references
      const sanitizeForJSON = (obj: any) => {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular Reference]';
            }
            seen.add(value);
          }
          return value;
        });
      };
      
      // Create a sanitized payload to avoid circular references
      // and ensure we're sending valid JSON
      const sanitizedData = JSON.parse(sanitizeForJSON(data));
      
      // Send the sanitized data to the server with proper content type
      console.log('Sending data to server...');
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sanitizedData),
      });
      
      // Handle response
      if (!response.ok) {
        let errorMessage = `Server returned ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      let result;
      try {
        result = await response.json();
      } catch (error) {
        console.error('Error parsing response:', error);
        throw new Error('Error parsing server response');
      }
      
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
        message: `Import successful! Imported ${result.data.apiKeys || 0} API keys, ${result.data.topLevelGroups || 0} top-level groups, ${result.data.subgroups || 0} subgroups, ${result.data.channels || 0} channels, ${result.data.linkGroups || 0} link groups, and ${result.data.links || 0} links.`
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
  
  // Main import function - directly use server-side
  const importData = async () => {
    await importDataServerSide();
  };
  
  // Helper function to read file content
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }
      
      if (file.size === 0) {
        reject(new Error('File is empty'));
        return;
      }
      
      console.log(`Reading file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === 'string') {
          const content = e.target.result;
          console.log(`Successfully read file, content length: ${content.length} characters`);
          
          // Basic validation that the content looks like JSON
          if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
            resolve(content);
          } else {
            console.error('File content does not appear to be valid JSON');
            reject(new Error('File content does not appear to be valid JSON'));
          }
        } else {
          console.error('FileReader did not return a string');
          reject(new Error('Failed to read file as text'));
        }
      };
      
      reader.onerror = (event) => {
        console.error('FileReader error:', reader.error);
        reject(new Error(`File read error: ${reader.error?.message || 'Unknown error'}`));
      };
      
      reader.onabort = () => {
        console.error('File reading aborted');
        reject(new Error('File reading aborted'));
      };
      
      reader.readAsText(file);
    });
  };
  
  // Validate the import data structure
  const validateImportData = (data: any): boolean => {
    if (!data || typeof data !== 'object') {
      console.error('Import validation failed: Data is not an object');
      return false;
    }

    // Check if the data has at least one of the expected properties
    const hasValidContent = (
      (data.apiKeys && Array.isArray(data.apiKeys)) ||
      (data.groups && Array.isArray(data.groups)) ||
      (data.channels && Array.isArray(data.channels)) ||
      (data.groupChannels && Array.isArray(data.groupChannels))
    );
    
    if (!hasValidContent) {
      console.error('Import validation failed: Missing required arrays (apiKeys, groups, channels, or groupChannels)');
      return false;
    }
    
    // Check data structure in more detail
    let validationDetails = {
      apiKeys: data.apiKeys ? `${data.apiKeys.length} items` : 'not present',
      groups: data.groups ? `${data.groups.length} items` : 'not present',
      channels: data.channels ? `${data.channels.length} items` : 'not present',
      groupChannels: data.groupChannels ? `${data.groupChannels.length} items` : 'not present'
    };
    
    console.log('Import data validation:', validationDetails);
    
    // If groups are present, validate their structure
    if (data.groups && Array.isArray(data.groups) && data.groups.length > 0) {
      // Check sample group structure
      const sampleGroup = data.groups[0];
      if (!sampleGroup.id || typeof sampleGroup.id !== 'string') {
        console.error('Import validation failed: Groups must have string id property');
        return false;
      }
      
      if (!sampleGroup.name || typeof sampleGroup.name !== 'string') {
        console.error('Import validation failed: Groups must have string name property');
        return false;
      }
      
      // Log group structure for debugging
      console.log('Sample group structure:', {
        id: sampleGroup.id,
        name: sampleGroup.name,
        hasParentId: sampleGroup.parentId !== undefined,
        parentId: sampleGroup.parentId,
        hasChannels: Array.isArray(sampleGroup.channels),
        channelsCount: Array.isArray(sampleGroup.channels) ? sampleGroup.channels.length : 0,
        hasSubgroups: Array.isArray(sampleGroup.subgroups),
        subgroupsCount: Array.isArray(sampleGroup.subgroups) ? sampleGroup.subgroups.length : 0
      });
      
      // Check for proper data types in channels if present
      if (sampleGroup.channels && sampleGroup.channels.length > 0) {
        const sampleChannel = sampleGroup.channels[0];
        if (!sampleChannel.id || typeof sampleChannel.id !== 'string') {
          console.warn('Warning: Channel in group does not have a valid ID');
        }
      }
    }
    
    console.log('Import data validation passed');
    return true;
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
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 mb-4">
                      <strong>Note:</strong> When importing groups, the hierarchical structure will be preserved. Subgroups will be properly imported as subgroups of their parent groups.
                    </p>
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
              
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Export Options
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
                  
                  {exportOptions.groups && (
                    <div className="col-span-2 mt-1 ml-8">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Note: Only top-level groups are shown in the selection list below. When a group is exported, all its subgroups will be automatically included.
                      </p>
                    </div>
                  )}
                  
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
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={exportOptions.linkGroups}
                      onChange={() => toggleExportOption('linkGroups')}
                      className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Link Groups</span>
                  </label>
                </div>
              </div>
            </div>
            
            {/* Group selection section */}
            {exportOptions.groups && (
              <div className="mt-4">
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
                
                {/* Only display top-level groups in the selection UI */}
                {groups.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 italic">No groups found</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded">
                    {groups
                      .filter(group => !group.parentId) // Only show top-level groups
                      .map(group => (
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
            )}
            
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
        
        {/* Additional settings sections can be added here in the future */}
      </div>
    </div>
  );
} 