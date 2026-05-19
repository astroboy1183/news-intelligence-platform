import type {
  AnomalyItem,
  BreakingPowerItem,
  BriefSummary,
  CoverageReport,
  EntityDetail,
  EntityListItem,
  IngestionRunItem,
  IngestionSummary,
  InsightsSummary,
  NetworkGraph,
  Page,
  PredictionAccuracy,
  PredictionItem,
  SearchResponse,
  SourceCompareResult,
  SourceHealthSummary,
  SourceItem,
  SourceOverlapRow,
  StateRollup,
  StoryDetail,
  StoryListItem,
  ThreadDetail,
  ThreadListItem,
  TopicDetail,
  TopicListItem,
  TrendSeries,
  TriggerResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  listStories: (params: {
    country?: string; region?: "india" | "global";
    state?: string; since_hours?: number;
    min_sources?: number; sort?: "trending" | "recent" | "most_covered";
    page?: number; page_size?: number;
  } = {}) => get<Page<StoryListItem>>(`/stories${qs(params)}`),

  getStory: (id: number) => get<StoryDetail>(`/stories/${id}`),

  listEntities: (params: { type?: string; since_hours?: number; page?: number; page_size?: number } = {}) =>
    get<Page<EntityListItem>>(`/entities${qs(params)}`),

  getEntity: (slug: string) => get<EntityDetail>(`/entities/${encodeURIComponent(slug)}`),

  listTopics: (params: { since_hours?: number; page?: number; page_size?: number } = {}) =>
    get<Page<TopicListItem>>(`/topics${qs(params)}`),

  getTopic: (slug: string) => get<TopicDetail>(`/topics/${encodeURIComponent(slug)}`),

  listSources: (params: { country?: string; active_only?: boolean; page?: number; page_size?: number } = {}) =>
    get<Page<SourceItem>>(`/sources${qs(params)}`),

  sourcesHealth: () => get<SourceHealthSummary>("/sources/health"),

  sourceCoverage: (slug: string) =>
    get<CoverageReport>(`/sources/${encodeURIComponent(slug)}/coverage`),

  listThreads: (params: { status?: string; page?: number; page_size?: number } = {}) =>
    get<Page<ThreadListItem>>(`/threads${qs(params)}`),
  getThread: (slug: string) => get<ThreadDetail>(`/threads/${encodeURIComponent(slug)}`),

  insightsSummary: () => get<InsightsSummary>("/insights/summary"),

  predictionsRising: (params: { min_confidence?: number; limit?: number } = {}) =>
    get<PredictionItem[]>(`/predictions/rising${qs(params)}`),
  predictionsAccuracy: () => get<PredictionAccuracy>("/predictions/accuracy"),

  network: (params: { min_weight?: number; max_edges?: number } = {}) =>
    get<NetworkGraph>(`/network${qs(params)}`),

  sourceIntelBreaking: (params: { days?: number; limit?: number } = {}) =>
    get<BreakingPowerItem[]>(`/sources/intelligence/breaking${qs(params)}`),
  sourceIntelOverlap: (params: { days?: number; limit?: number } = {}) =>
    get<SourceOverlapRow[]>(`/sources/intelligence/overlap${qs(params)}`),
  sourceIntelCompare: (params: { a: string; b: string; days?: number; limit?: number }) =>
    get<SourceCompareResult>(`/sources/intelligence/compare${qs(params)}`),

  trendTopics: (params: { days?: number; top_n?: number } = {}) =>
    get<TrendSeries[]>(`/trends/topics${qs(params)}`),
  trendsByState: (params: { days?: number } = {}) =>
    get<StateRollup[]>(`/trends/by-state${qs(params)}`),

  brief: () => get<BriefSummary>("/brief/today"),

  search: (params: { q: string; limit?: number }) =>
    get<SearchResponse>(`/search${qs(params)}`),

  ingestionSummary: () => get<IngestionSummary>("/ingestion/summary"),
  ingestionRuns: (params: { status?: string; source_slug?: string; page?: number; page_size?: number } = {}) =>
    get<Page<IngestionRunItem>>(`/ingestion/runs${qs(params)}`),
  triggerIngestion: async () => {
    const res = await fetch(`${API_URL}/ingestion/trigger`, {
      method: "POST",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`POST /ingestion/trigger → ${res.status}`);
    return res.json() as Promise<TriggerResponse>;
  },
};
