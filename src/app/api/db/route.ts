import { NextRequest, NextResponse } from 'next/server';
import * as sqliteDB from '../../db/sqliteDB';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  try {
    switch (action) {
      case 'getGroups':
        const groups = await sqliteDB.getGroups();
        return NextResponse.json({ success: true, data: groups });
        
      case 'getGroup':
        const groupId = searchParams.get('id');
        if (!groupId) {
          return NextResponse.json({ success: false, error: 'Group ID is required' }, { status: 400 });
        }
        const group = await sqliteDB.getGroup(groupId);
        return NextResponse.json({ success: true, data: group });
        
      case 'getGroupHierarchy':
        const hierarchy = await sqliteDB.getGroupHierarchy();
        return NextResponse.json({ success: true, data: hierarchy });
        
      case 'getGroupWithSubtree':
        const subtreeGroupId = searchParams.get('id');
        if (!subtreeGroupId) {
          return NextResponse.json({ success: false, error: 'Group ID is required' }, { status: 400 });
        }
        const subtree = await sqliteDB.getGroupWithSubtree(subtreeGroupId);
        return NextResponse.json({ success: true, data: subtree });
        
      case 'getAPIKeys':
        const apiKeys = await sqliteDB.getAPIKeys();
        return NextResponse.json({ success: true, data: apiKeys });
        
      case 'getWorkingAPIKey':
        const apiKey = await sqliteDB.getWorkingAPIKey();
        return NextResponse.json({ success: true, data: apiKey });
        
      case 'getVideosForChannel':
        const channelId = searchParams.get('channelId');
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        if (!channelId) {
          return NextResponse.json({ success: false, error: 'Channel ID is required' }, { status: 400 });
        }
        const videos = await sqliteDB.getVideosForChannel(channelId, limit);
        return NextResponse.json({ success: true, data: videos });
        
      case 'getCacheEntry':
        const cacheKey = searchParams.get('key');
        const cacheType = searchParams.get('type');
        if (!cacheKey || !cacheType) {
          return NextResponse.json({ success: false, error: 'Cache key and type are required' }, { status: 400 });
        }
        const cacheEntry = await sqliteDB.getCacheEntry(cacheKey, cacheType);
        return NextResponse.json({ success: true, data: cacheEntry });
        
      case 'getLinkGroups':
        const linkGroups = await sqliteDB.getLinkGroups();
        return NextResponse.json({ success: true, data: linkGroups });
        
      case 'getLinkGroup':
        const linkGroupId = searchParams.get('id');
        if (!linkGroupId) {
          return NextResponse.json({ success: false, error: 'Missing link group ID' }, { status: 400 });
        }
        const linkGroup = await sqliteDB.getLinkGroup(linkGroupId);
        return NextResponse.json({ success: true, data: linkGroup });
        
      case 'getLinkGroupHierarchy':
        const linkHierarchy = await sqliteDB.getLinkGroupHierarchy();
        return NextResponse.json({ success: true, data: linkHierarchy });
        
      case 'getLinkGroupWithSubtree':
        const subtreeLinkGroupId = searchParams.get('id');
        if (!subtreeLinkGroupId) {
          return NextResponse.json({ success: false, error: 'Missing link group ID' }, { status: 400 });
        }
        const linkSubtree = await sqliteDB.getLinkGroupWithSubtree(subtreeLinkGroupId);
        return NextResponse.json({ success: true, data: linkSubtree });
        
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error(`Error in DB API route (${action}):`, error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;
    
    switch (action) {
      case 'saveGroup':
        if (!data || !data.group) {
          return NextResponse.json({ success: false, error: 'Group data is required' }, { status: 400 });
        }
        try {
          console.log('DB API: Received save request for group:', JSON.stringify({
            id: data.group.id,
            name: data.group.name,
            parentId: data.group.parentId
          }));
          
          const groupId = await sqliteDB.saveGroup(data.group);
          return NextResponse.json({ success: true, data: { id: groupId } });
        } catch (error) {
          console.error('Error saving group:', error);
          return NextResponse.json({ 
            success: false, 
            error: 'Error saving group: ' + (error instanceof Error ? error.message : String(error))
          }, { status: 500 });
        }
        
      case 'deleteGroup':
        if (!data || !data.id) {
          return NextResponse.json({ success: false, error: 'Group ID is required' }, { status: 400 });
        }
        
        console.log(`[API] Received request to delete group: ${data.id}`);
        
        try {
          await sqliteDB.deleteGroup(data.id);
          console.log(`[API] Successfully deleted group: ${data.id}`);
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error(`[API] Error deleting group ${data.id}:`, error);
          return NextResponse.json({ 
            success: false, 
            error: 'Error deleting group: ' + (error instanceof Error ? error.message : String(error))
          }, { status: 500 });
        }
        
      case 'saveAPIKey':
        if (!data || !data.apiKey) {
          return NextResponse.json({ success: false, error: 'API key data is required' }, { status: 400 });
        }
        const apiKeyId = await sqliteDB.saveAPIKey(data.apiKey);
        return NextResponse.json({ success: true, data: { id: apiKeyId } });
        
      case 'deleteAPIKey':
        if (!data || !data.id) {
          return NextResponse.json({ success: false, error: 'API key ID is required' }, { status: 400 });
        }
        await sqliteDB.deleteAPIKey(data.id);
        return NextResponse.json({ success: true });
        
      case 'updateAPIKeyPriorities':
        if (!data || !data.keys) {
          return NextResponse.json({ success: false, error: 'API keys are required' }, { status: 400 });
        }
        await sqliteDB.updateAPIKeyPriorities(data.keys);
        return NextResponse.json({ success: true });
        
      case 'saveVideos':
        if (!data || !data.videos) {
          return NextResponse.json({ success: false, error: 'Videos data is required' }, { status: 400 });
        }
        await sqliteDB.saveVideos(data.videos);
        return NextResponse.json({ success: true });
        
      case 'deleteVideosForChannel':
        if (!data || !data.channelId) {
          return NextResponse.json({ success: false, error: 'Channel ID is required' }, { status: 400 });
        }
        await sqliteDB.deleteVideosForChannel(data.channelId);
        return NextResponse.json({ success: true });
        
      case 'deleteChannel':
        if (!data || !data.channelId) {
          return NextResponse.json({ success: false, error: 'Channel ID is required' }, { status: 400 });
        }
        await sqliteDB.deleteChannel(data.channelId);
        return NextResponse.json({ success: true });
        
      case 'setCacheEntry':
        if (!data || !data.key || !data.type || data.value === undefined) {
          return NextResponse.json({ success: false, error: 'Cache key, type, and value are required' }, { status: 400 });
        }
        await sqliteDB.setCacheEntry(data.key, data.value, data.type);
        return NextResponse.json({ success: true });
        
      case 'clearCache':
        await sqliteDB.clearCache(data?.type);
        return NextResponse.json({ success: true });
        
      case 'saveLinkGroup':
        if (!data || !data.group) {
          return NextResponse.json({ success: false, error: 'Missing link group data' }, { status: 400 });
        }
        try {
          console.log(`[API] Received save request for link group: ${data.group.id || 'new'} (${data.group.name})`);
          const savedLinkGroupId = await sqliteDB.saveLinkGroup(data.group);
          
          if (!savedLinkGroupId) {
            console.error('[API] Failed to get valid ID from saveLinkGroup');
            return NextResponse.json({ 
              success: false, 
              error: 'Failed to save link group: No ID returned' 
            }, { status: 500 });
          }
          
          return NextResponse.json({ 
            success: true, 
            data: { id: savedLinkGroupId } 
          });
        } catch (error) {
          console.error('[API] Error saving link group:', error);
          return NextResponse.json({ 
            success: false, 
            error: 'Failed to save link group: ' + (error instanceof Error ? error.message : 'Unknown error') 
          }, { status: 500 });
        }
        
      case 'deleteLinkGroup':
        const deleteLinkGroupId = data?.id;
        if (!deleteLinkGroupId) {
          return NextResponse.json({ success: false, error: 'Missing link group ID' }, { status: 400 });
        }
        try {
          await sqliteDB.deleteLinkGroup(deleteLinkGroupId);
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error('[API] Error deleting link group:', error);
          return NextResponse.json({ success: false, error: 'Failed to delete link group' }, { status: 500 });
        }
        
      case 'deleteLinkFromGroup':
        const linkGroupId = data?.groupId;
        const linkId = data?.linkId;
        if (!linkGroupId || !linkId) {
          return NextResponse.json({ success: false, error: 'Missing groupId or linkId' }, { status: 400 });
        }
        try {
          console.log(`[API] Deleting link ${linkId} from group ${linkGroupId}`);
          await sqliteDB.deleteLinkFromGroup(linkGroupId, linkId);
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error('[API] Error deleting link from group:', error);
          return NextResponse.json({ success: false, error: 'Failed to delete link from group' }, { status: 500 });
        }
        
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in DB API route (POST):', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
} 