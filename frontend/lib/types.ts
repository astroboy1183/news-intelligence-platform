// Types mirror the FastAPI response shapes in backend/app/schemas/*.
// Keep in sync when API changes.

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type StoryListItem = {
  id: number;
  slug: string;
  name: string;
  tldr: string[];
  first_seen_at: string;
  last_updated_at: string;
  article_count: number;
  source_count: number;
  velocity_score: number;
  primary_state: string | null;
  primary_country: string | null;
  category: string | null;
};

export type StoryArticleSummary = {
  id: number;
  title: string;
  url: string;
  source_slug: string;
  source_name: string;
  published_at: string | null;
  fetched_at: string;
};

export type StoryEntityRef = {
  slug: string;
  name: string;
  type: string;
  mention_count: number;
};

export type StoryTopicRef = {
  slug: string;
  name: string;
  score: number;
};

export type CoverageBreakdownItem = {
  country: string;
  outlet_count: number;
};

export type StoryDetail = StoryListItem & {
  articles: StoryArticleSummary[];
  entities: StoryEntityRef[];
  topics: StoryTopicRef[];
  coverage_by_country: CoverageBreakdownItem[];
  first_reported_by_source_slug: string | null;
};

export type EntityListItem = {
  slug: string;
  name: string;
  type: string;
  mention_count_7d: number;
};

export type RelatedEntity = {
  slug: string;
  name: string;
  type: string;
  cooccurrence: number;
};

export type EntityDetail = EntityListItem & {
  canonical_name: string | null;
  wiki_url: string | null;
  recent_stories: Array<{ id: number; slug: string; name: string; source_count: number; last_updated_at: string }>;
  related: RelatedEntity[];
};

export type TopicListItem = {
  slug: string;
  name: string;
  article_count_7d: number;
};

export type TopicDetail = TopicListItem & {
  recent_stories: Array<{ id: number; slug: string; name: string; source_count: number; last_updated_at: string }>;
  related_topics: string[];
};

export type SourceItem = {
  slug: string;
  name: string;
  url: string;
  country: string;
  region: string | null;
  region_bucket: string;
  political_lean: string;
  tier: string;
  is_active: boolean;
  last_fetched_at: string | null;
  articles_24h: number;
  last_run_status: string | null;
};

export type CoverageReport = {
  source_slug: string;
  raw_in_feed: number;
  unique_in_feed: number;
  in_db: number;
  coverage_pct: number;
  missing: Array<{ url: string; title: string }>;
};

export type SourceHealthSummary = {
  active: number;
  total: number;
  healthy: number;
  stale: number;
  failing: number;
  articles_per_hour: number;
  last_run_at: string | null;
};

export type ThreadListItem = {
  id: number;
  slug: string;
  name: string;
  first_seen_at: string;
  last_updated_at: string;
  story_count: number;
  status: string;
};

export type ThreadStoryRef = {
  id: number;
  slug: string;
  name: string;
  source_count: number;
  first_seen_at: string;
  role: string;
};

export type ThreadDetail = ThreadListItem & { stories: ThreadStoryRef[] };

export type AnomalyItem = {
  id: number;
  type: string;
  severity: number;
  detected_at: string;
  label: string;
  href: string | null;
  payload: Record<string, unknown>;
};

export type BreakingPowerItem = {
  slug: string;
  name: string;
  stories_broken: number;
};

export type InsightsSummary = {
  anomalies_today: AnomalyItem[];
  first_to_break: BreakingPowerItem[];
  quiet_but_important: Array<{
    id: number; slug: string; name: string; source_count: number; last_updated_at: string;
  }>;
  coverage_gaps: Array<{
    story_id: number; slug: string; name: string; in: number; global: number; gap: string;
  }>;
};

export type PredictionItem = {
  story_id: number;
  story_slug: string;
  story_name: string;
  source_count_now: number;
  predicted_outlets_24h: number;
  confidence: number;
  predicted_at: string;
};

export type PredictionAccuracy = {
  total: number;
  correct: number;
  accuracy: number;
  avg_lead_hours: number | null;
};

export type NetworkNode = {
  id: number; slug: string; name: string; type: string; weight: number;
};
export type NetworkEdge = { source: number; target: number; weight: number };
export type NetworkGraph = { nodes: NetworkNode[]; edges: NetworkEdge[] };

export type SourceOverlapRow = {
  a_slug: string; b_slug: string; overlap: number; shared_stories: number;
};

export type TrendPoint = { bucket: string; count: number };
export type TrendSeries = { name: string; slug: string; points: TrendPoint[] };

export type StateRollup = { state: string; code: string | null; story_count: number };

export type IngestionRunItem = {
  id: number;
  source_slug: string;
  source_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  articles_seen: number;
  articles_inserted: number;
  articles_skipped: number;
  error: string | null;
};

export type IngestionSummary = {
  runs_last_hour: number;
  runs_last_24h: number;
  success_count_24h: number;
  error_count_24h: number;
  not_modified_24h: number;
  articles_inserted_24h: number;
  articles_skipped_24h: number;
  avg_duration_ms: number | null;
  sources_total: number;
  sources_active: number;
  last_run_at: string | null;
  ingestion_running: boolean;
};

export type TriggerResponse = {
  status: "started" | "already_running";
  sources: number;
  message: string;
};

export type SearchHit = {
  kind: "story" | "entity" | "topic";
  id: number;
  slug: string;
  label: string;
  sublabel: string;
  href: string;
  score: number;
};

export type SearchResponse = {
  query: string;
  hits: SearchHit[];
};

export type BriefSummary = {
  generated_at: string;
  top_stories: Array<{
    id: number; slug: string; name: string; source_count: number; tldr: string[];
    primary_country: string | null; primary_state: string | null;
  }>;
  whats_changed: { new: number; escalated: number; resolved: number };
  anomalies: AnomalyItem[];
  regional_pulse: Array<{ state: string; stories_24h: number }>;
};
