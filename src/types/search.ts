export type SearchEntityType = 'work_order' | 'customer' | 'asset' | 'part' | 'employee' | 'vendor';

export interface SearchResult {
  id: string;
  entity_type: SearchEntityType;
  title: string;
  subtitle: string;
  url: string;
  relevance: number;
  status?: string;
  metadata?: Record<string, string>;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  counts: Record<SearchEntityType, number>;
  total: number;
}
