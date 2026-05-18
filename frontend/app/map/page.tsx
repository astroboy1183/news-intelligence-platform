import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import StateBarChart from "@/components/StateBarChart";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const states = await api.trendsByState({ days: 7 });
  const total = states.reduce((acc, s) => acc + s.story_count, 0);
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow="Geographic"
        title="India by state"
        description={`${total} stories tagged to ${states.length} states/UTs in the last 7 days.`}
      />
      <Panel title="Story density">
        {states.length === 0 ? (
          <p className="text-sm text-slate-500">No state-tagged stories yet.</p>
        ) : (
          <StateBarChart rows={states} />
        )}
      </Panel>
    </div>
  );
}
