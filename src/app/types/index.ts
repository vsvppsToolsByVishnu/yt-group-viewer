// Channel types
export interface Channel {
  id: string;
  title: string;
  thumbnailUrl: string;
  description?: string;
}

// Group types
export interface Group {
  id: string;
  name: string;
  channels: Channel[];
}

// Video types
export interface Video {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: string;
}

// API Key types
export interface APIKey {
  id?: string;  // Optional as it will be auto-generated when first saved
  name: string;
  key: string;
  priority: number;
  isActive: boolean;
}

// Filter types
export type FilterOption = 'latest' | '3days' | '7days' | 'all';
export type SortOption = 'date' | 'views'; 