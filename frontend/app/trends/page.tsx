import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import TrendsChart from "@/components/TrendsChart";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const series = await api.trendTopics({ days: 7, top_n: 8 });
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Velocity"
        title="Trends"
        description="Top 8 topics by article count over the last 7 days."
      />
      <Panel title="Topics over time">
        {series.length === 0 ? (
          <p className="text-sm text-slate-500">No topic data yet.</p>
        ) : (
          <TrendsChart series={series} />
        )}
      </Panel>
    </div>
  );
}
