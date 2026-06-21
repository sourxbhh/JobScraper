import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useJobs } from '@/hooks/useJobs';
import JobTable from '@/components/JobTable';
import FilterBar from '@/components/FilterBar';
import ExportButton from '@/components/ExportButton';

interface Filters {
  search: string;
  status: string;
  source: string;
  location: string;
  is_bookmarked?: boolean;
  min_salary: string;
  min_match_score: string;
}

export default function Jobs() {
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: searchParams.get('status') || '',
    source: '',
    location: '',
    is_bookmarked: searchParams.get('is_bookmarked') === 'true' ? true : undefined,
    min_salary: '',
    min_match_score: '',
  });
  const [sortBy, setSortBy] = useState('match_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);

  const { data, loading, updateJob, bulkUpdate } = useJobs({
    search: filters.search || undefined,
    status: filters.status || undefined,
    source: filters.source || undefined,
    location: filters.location || undefined,
    is_bookmarked: filters.is_bookmarked,
    min_salary: filters.min_salary ? Number(filters.min_salary) : undefined,
    min_match_score: filters.min_match_score ? Number(filters.min_match_score) : undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    page,
    per_page: perPage,
  });

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <ExportButton filters={{ search: filters.search, status: filters.status, source: filters.source }} />
      </div>

      <FilterBar filters={filters} onChange={f => { setFilters(f); setPage(1); }} />

      {loading && !data ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center text-text-secondary">
          Loading jobs...
        </div>
      ) : data ? (
        <JobTable
          data={data}
          onUpdateJob={updateJob}
          onBulkUpdate={bulkUpdate}
          onPageChange={setPage}
          onSort={handleSort}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onPerPageChange={n => { setPerPage(n); setPage(1); }}
          source={filters.source}
          onSourceChange={s => { setFilters({ ...filters, source: s }); setPage(1); }}
        />
      ) : null}
    </div>
  );
}
