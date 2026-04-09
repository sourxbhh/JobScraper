import { Download } from 'lucide-react';

interface Props {
  filters?: Record<string, string>;
  selectedIds?: number[];
}

export default function ExportButton({ filters, selectedIds }: Props) {
  const handleExport = () => {
    const params = new URLSearchParams();
    if (selectedIds && selectedIds.length > 0) {
      params.set('job_ids', selectedIds.join(','));
    }
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
    }
    window.open(`/api/jobs/export?${params.toString()}`, '_blank');
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
    >
      <Download className="w-4 h-4" />
      Export CSV
    </button>
  );
}
