import IngestionPanel from "@/components/IngestionPanel";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function IngestionPage() {
  const [summary, runs] = await Promise.all([
    api.ingestionSummary(),
    api.ingestionRuns({ page_size: 50 }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Pipeline observability"
        title="Ingestion"
        description="Every poll cycle, every source, every dedup. Trigger an extra pass manually if you want to force-refresh."
      />
      <IngestionPanel initialSummary={summary} initialRuns={runs.items} />
    </div>
  );
}
