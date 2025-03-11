import { NextRequest, NextResponse } from 'next/server';
import * as sqliteDB from '../../../app/db/sqliteDB';
import { getDbConnection } from '../../../app/db/sqliteSetup';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { options, selectedGroups } = body;
    
    if (!options || !selectedGroups) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters'
      }, { status: 400 });
    }
    
    // Initialize export data object
    const exportData: any = {};
    
    // Get direct database connection for complex queries
    const db = await getDbConnection();
    
    // Export API keys if selected
    if (options.apiKeys) {
      const apiKeys = await sqliteDB.getAPIKeys();
      exportData.apiKeys = apiKeys;
    }
    
    // Export SQLite sequence if selected
    if (options.sqliteSequence) {
      const sequence = await db.get('SELECT * FROM sqlite_sequence WHERE name = ?', ['api_keys']);
      exportData.sqliteSequence = sequence || { name: 'api_keys', seq: 0 };
    }
    
    // Get the list of selected group IDs
    const selectedGroupIds = Object.entries(selectedGroups)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);
    
    // Export groups if selected
    if (options.groups && selectedGroupIds.length > 0) {
      // Get all groups for filtering subgroups
      const allGroups = await db.all('SELECT * FROM groups');
      
      // Create a map to track processed groups to avoid duplicates
      const processedGroupIds = new Set<string>();
      const exportedGroups: any[] = [];
      
      // Function to get all subgroups recursively
      const collectSubgroups = (parentId: string): void => {
        const subgroups = allGroups.filter((g: any) => g.parent_id === parentId);
        for (const subgroup of subgroups) {
          if (!processedGroupIds.has(subgroup.id)) {
            exportedGroups.push(subgroup);
            processedGroupIds.add(subgroup.id);
            collectSubgroups(subgroup.id); // Recursively collect deeper subgroups
          }
        }
      };
      
      // For each selected group ID, get the group from allGroups and add it and its subgroups
      for (const groupId of selectedGroupIds) {
        const group = allGroups.find((g: any) => g.id === groupId);
        if (group && !processedGroupIds.has(group.id)) {
          exportedGroups.push(group);
          processedGroupIds.add(group.id);
          collectSubgroups(group.id);
        }
      }
      
      const subgroupCount = exportedGroups.length - selectedGroupIds.length;
      console.log(`Exporting ${exportedGroups.length} total groups, including ${subgroupCount} subgroups`);
      
      if (subgroupCount > 0) {
        console.log('Subgroups included:');
        exportedGroups
          .filter((g: any) => g.parent_id) // Only log subgroups
          .forEach((sg: any) => {
            const parentName = allGroups.find((g: any) => g.id === sg.parent_id)?.name || 'unknown';
            console.log(`- ${sg.name} (parent: ${parentName})`);
          });
      }
      
      // For each group, get its channels and format them
      const formattedGroups = await Promise.all(exportedGroups.map(async (group: any) => {
        // Get channels for this group
        const channels = await db.all(
          `SELECT c.* 
           FROM channels c
           JOIN group_channels gc ON c.id = gc.channel_id
           WHERE gc.group_id = ?`,
          [group.id]
        );
        
        // Format the group to match the client-side export format
        return {
          id: group.id,
          name: group.name,
          parentId: group.parent_id || undefined, // Use undefined instead of null for consistency
          isExpanded: group.is_expanded === 1, // Convert to boolean
          subgroups: [], // Initialize empty subgroups array
          channels: channels.map((c: any) => ({
            id: c.id,
            title: c.title,
            thumbnailUrl: c.thumbnail_url,
            description: c.description
          })),
          createdAt: group.created_at,
          updatedAt: group.updated_at
        };
      }));
      
      // Now build a hierarchical structure
      const groupMap = new Map();
      formattedGroups.forEach(group => {
        group.subgroups = []; // Initialize subgroups array for all groups
        groupMap.set(group.id, group);
      });
      
      // Identify top-level groups and build the hierarchy
      const hierarchicalGroups: any[] = [];
      
      formattedGroups.forEach(group => {
        if (group.parentId) {
          // This is a subgroup - add it to its parent
          const parent = groupMap.get(group.parentId);
          if (parent) {
            parent.subgroups.push(group);
          } else {
            // Parent not found, add as top-level
            hierarchicalGroups.push(group);
          }
        } else {
          // This is a top-level group
          hierarchicalGroups.push(group);
        }
      });
      
      // Log the hierarchical structure
      const countNestedSubgroups = (groups: any[]): number => {
        let count = 0;
        groups.forEach(group => {
          if (group.subgroups && group.subgroups.length > 0) {
            count += group.subgroups.length;
            count += countNestedSubgroups(group.subgroups);
          }
        });
        return count;
      };
      
      const nestedSubgroupCount = countNestedSubgroups(hierarchicalGroups);
      console.log(`Built hierarchical structure with ${hierarchicalGroups.length} top-level groups and ${nestedSubgroupCount} nested subgroups`);
      
      // Export the hierarchical structure
      exportData.groups = hierarchicalGroups;
    }
    
    // Export channels if selected
    if (options.channels && selectedGroupIds.length > 0) {
      // Get channels from selected groups
      const placeholders = selectedGroupIds.map(() => '?').join(',');
      const channels = await db.all(
        `SELECT DISTINCT c.* 
         FROM channels c
         JOIN group_channels gc ON c.id = gc.channel_id
         WHERE gc.group_id IN (${placeholders})`,
        selectedGroupIds
      );
      
      // Format channels to match client-side export format
      exportData.channels = channels.map((c: any) => ({
        id: c.id,
        title: c.title,
        thumbnailUrl: c.thumbnail_url,
        description: c.description
      }));
      
      console.log(`Exporting ${exportData.channels.length} unique channels`);
    }
    
    // Export group-channel relationships if selected
    if (options.groupChannels && selectedGroupIds.length > 0) {
      // Get group-channel relationships for selected groups
      const placeholders = selectedGroupIds.map(() => '?').join(',');
      const groupChannels = await db.all(
        `SELECT group_id, channel_id, added_at
         FROM group_channels
         WHERE group_id IN (${placeholders})`,
        selectedGroupIds
      );
      
      // Format group-channel relationships to match client-side export
      exportData.groupChannels = groupChannels.map((gc: any) => ({
        groupId: gc.group_id,
        channelId: gc.channel_id,
        addedAt: gc.added_at
      }));
      
      console.log(`Exporting ${exportData.groupChannels.length} group-channel relationships`);
    }
    
    // Apply consistent formatting to the export data
    console.log('Export data summary:', {
      apiKeys: exportData.apiKeys?.length || 0,
      groups: exportData.groups?.length || 0,
      channels: exportData.channels?.length || 0,
      groupChannels: exportData.groupChannels?.length || 0
    });
    
    return NextResponse.json({ 
      success: true, 
      data: exportData 
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to export data' 
    }, { status: 500 });
  }
} 