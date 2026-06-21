import { Search, X } from 'lucide-react';
import { SOURCE_OPTIONS, sourceLabel } from '@/lib/utils';

interface Filters {
  search: string;
  status: string;
  source: string;
  location: string;
  is_bookmarked?: boolean;
  min_salary: string;
  min_match_score: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const STATUSES = ['new', 'reviewing', 'applied', 'interview', 'offer', 'rejected'];

export default function FilterBar({ filters, onChange }: Props) {
  const update = (key: keyof Filters, value: string | boolean | undefined) => {
    onChange({ ...filters, [key]: value } as Filters);
  };

  const clearAll = () => {
    onChange({
      search: '',
      status: '',
      source: '',
      location: '',
      is_bookmarked: undefined,
      min_salary: '',
      min_match_score: '',
    });
  };

  const hasFilters = filters.search || filters.status || filters.source ||
    filters.location || filters.is_bookmarked || filters.min_salary || filters.min_match_score;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
        <input
          type="text"
          placeholder="Search jobs..."
          value={filters.search}
          onChange={e => update('search', e.target.value)}
          className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-accent transition-colors"
        />
      </div>

      <select
        value={filters.status}
        onChange={e => update('status', e.target.value)}
        className="bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option value="">All Statuses</option>
        {STATUSES.map(s => (
          <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
        ))}
      </select>

      <select
        value={filters.source}
        onChange={e => update('source', e.target.value)}
        className="bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option value="">All Sources</option>
        {SOURCE_OPTIONS.map(s => (
          <option key={s} value={s}>{sourceLabel(s)}</option>
        ))}
      </select>

      <select
        value={filters.location}
        onChange={e => update('location', e.target.value)}
        className="bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option value="">All Locations</option>
        <option value="Charlotte">Charlotte</option>
        <option value="remote">Remote</option>
      </select>

      <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={filters.is_bookmarked || false}
          onChange={e => update('is_bookmarked', e.target.checked || undefined)}
          className="accent-accent"
        />
        Bookmarked
      </label>

      <input
        type="number"
        placeholder="Min salary"
        value={filters.min_salary}
        onChange={e => update('min_salary', e.target.value)}
        className="w-28 bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      />

      <input
        type="number"
        placeholder="Min score"
        value={filters.min_match_score}
        onChange={e => update('min_match_score', e.target.value)}
        className="w-24 bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      />

      {hasFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
}
