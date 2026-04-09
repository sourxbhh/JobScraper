import type { ScrapeRun } from '@/types';
import StatusBadge from './StatusBadge';
import { timeAgo } from '@/lib/utils';

interface Props {
  runs: ScrapeRun[];
}

const RUN_STATUS_MAP: Record<string, string> = {
  running: 'new',
  completed: 'offer',
  failed: 'rejected',
  partial: 'interview',
};

export default function RunHistory({ runs }: Props) {
  if (runs.length === 0) {
    return <p className="text-sm text-text-secondary">No runs yet.</p>;
  }

  return (
    <div className="space-y-2">
      {runs.map(run => (
        <div key={run.id} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={RUN_STATUS_MAP[run.status] || 'new'} />
            <span className="text-sm text-text-secondary">{timeAgo(run.started_at)}</span>
            {run.config_name && (
              <span className="text-sm text-text-primary">{run.config_name}</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-green-400">+{run.new_jobs} new</span>
            <span className="text-text-secondary">{run.duplicates} dupes</span>
            <span className="text-text-secondary">{run.total_found} total</span>
          </div>
        </div>
      ))}
    </div>
  );
}
