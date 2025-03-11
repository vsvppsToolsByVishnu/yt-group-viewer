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
  parentId?: string; // Optional parent group id for subgroups
  subgroups?: Group[]; // Optional array of subgroups
  isExpanded?: boolean; // Whether the subgroups are expanded/visible
  subgroupCount?: number; // Number of direct subgroups
  channelCount?: number; // Number of channels in this group
  createdAt?: number; // Creation timestamp
  updatedAt?: number; // Last update timestamp
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