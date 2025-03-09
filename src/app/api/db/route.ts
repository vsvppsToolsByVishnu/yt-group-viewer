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
        
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error(`Error in DB API route (${action}):`, error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
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
        const groupId = await sqliteDB.saveGroup(data.group);
        return NextResponse.json({ success: true, data: { id: groupId } });
        
      case 'deleteGroup':
        if (!data || !data.id) {
          return NextResponse.json({ success: false, error: 'Group ID is required' }, { status: 400 });
        }
        await sqliteDB.deleteGroup(data.id);
        return NextResponse.json({ success: true });
        
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
        
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in DB API route (POST):', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
} 