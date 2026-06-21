import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Star, ExternalLink, CheckCircle, EyeOff,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { Job, JobsResponse } from '@/types';
import StatusBadge from './StatusBadge';
import { timeAgo, formatSalary, cn, SOURCE_OPTIONS, sourceLabel } from '@/lib/utils';

interface Props {
  data: JobsResponse;
  onUpdateJob: (id: number, update: Partial<Job>) => void;
  onBulkUpdate: (ids: number[], update: Record<string, unknown>) => void;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
  sortBy: string;
  sortOrder: string;
  onPerPageChange: (n: number) => void;
  source: string;
  onSourceChange: (source: string) => void;
}

const STATUS_OPTIONS = ['new', 'reviewing', 'applied', 'interview', 'offer', 'rejected'];

export default function JobTable({
  data,
  onUpdateJob,
  onBulkUpdate,
  onPageChange,
  onSort,
  sortBy,
  sortOrder,
  onPerPageChange,
  source,
  onSourceChange,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === data.jobs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.jobs.map(j => j.id)));
    }
  };

  const toggleExpand = (id: number) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
  };

  const headerClass = 'px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary select-none';

  return (
    <div>
      {selected.size > 0 && (
        <div className="bg-surface border border-border rounded-lg p-3 mb-3 flex items-center gap-3">
          <span className="text-sm text-text-secondary">{selected.size} selected</span>
          <select
            value={bulkStatus}
            onChange={e => setBulkStatus(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-1 text-sm text-text-primary"
          >
            <option value="">Change status...</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          {bulkStatus && (
            <button
              onClick={() => {
                onBulkUpdate(Array.from(selected), { status: bulkStatus });
                setSelected(new Set());
                setBulkStatus('');
              }}
              className="bg-accent text-white px-3 py-1 rounded-md text-sm hover:bg-accent/80"
            >
              Apply
            </button>
          )}
          <button
            onClick={() => {
              onBulkUpdate(Array.from(selected), { is_bookmarked: true });
              setSelected(new Set());
            }}
            className="text-sm text-yellow-400 hover:text-yellow-300"
          >
            Bookmark All
          </button>
          <button
            onClick={() => {
              onBulkUpdate(Array.from(selected), { is_hidden: true });
              setSelected(new Set());
            }}
            className="text-sm text-text-secondary hover:text-danger"
          >
            Hide All
          </button>
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="w-full">
            <thead className="border-b border-border sticky top-0 z-10 bg-surface">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === data.jobs.length && data.jobs.length > 0}
                    onChange={toggleAll}
                    className="accent-accent"
                  />
                </th>
                <th className={headerClass} onClick={() => onSort('status')}>Status <SortIcon field="status" /></th>
                <th className={headerClass} onClick={() => onSort('title')}>Title <SortIcon field="title" /></th>
                <th className={headerClass} onClick={() => onSort('company')}>Company <SortIcon field="company" /></th>
                <th className={headerClass} onClick={() => onSort('location')}>Location <SortIcon field="location" /></th>
                <th className="px-3 py-2 text-left">
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary select-none"
                      onClick={() => onSort('source')}
                    >
                      Source <SortIcon field="source" />
                    </span>
                    <select
                      value={source}
                      onClick={e => e.stopPropagation()}
                      onChange={e => onSourceChange(e.target.value)}
                      className="bg-background border border-border rounded px-1.5 py-0.5 text-xs font-normal normal-case text-text-primary outline-none focus:border-accent cursor-pointer"
                    >
                      <option value="">All sites</option>
                      {SOURCE_OPTIONS.map(s => (
                        <option key={s} value={s}>{sourceLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                </th>
                <th className={headerClass} onClick={() => onSort('date_scraped')}>Posted <SortIcon field="date_scraped" /></th>
                <th className={headerClass} onClick={() => onSort('min_salary')}>Salary <SortIcon field="min_salary" /></th>
                <th className={headerClass} onClick={() => onSort('match_score')}>Score <SortIcon field="match_score" /></th>
                <th className="px-3 py-2 text-xs font-medium text-text-secondary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map(job => (
                <>
                  <tr
                    key={job.id}
                    className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(job.id)}
                        onChange={() => toggleSelect(job.id)}
                        className="accent-accent"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={job.status}
                        onChange={e => onUpdateJob(job.id, { status: e.target.value as Job['status'] })}
                        className="bg-transparent text-xs border-none outline-none cursor-pointer"
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s} className="bg-surface">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => toggleExpand(job.id)}
                        className="text-left group"
                      >
                        <Link
                          to={`/jobs/${job.id}`}
                          className="text-sm font-medium text-text-primary hover:text-accent transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          {job.title}
                        </Link>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-text-secondary">{job.company || '—'}</td>
                    <td className="px-3 py-2.5 text-sm text-text-secondary">
                      {job.location || '—'}
                      {job.is_remote && <span className="ml-1 text-xs text-green-400">(Remote)</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-text-secondary capitalize">
                        {sourceLabel(job.source)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-text-secondary" title={job.date_scraped || ''}>
                      {timeAgo(job.date_posted || job.date_scraped)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-text-secondary">
                      {formatSalary(job.min_salary, job.max_salary)}
                    </td>
                    <td className="px-3 py-2.5">
                      {job.match_score != null ? (
                        <span className={cn(
                          'text-sm font-medium',
                          job.match_score >= 70 ? 'text-green-400' :
                          job.match_score >= 40 ? 'text-yellow-400' : 'text-text-secondary'
                        )}>
                          {Math.round(job.match_score)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onUpdateJob(job.id, { is_bookmarked: !job.is_bookmarked })}
                          title="Bookmark"
                          className={cn('p-1 rounded hover:bg-white/10', job.is_bookmarked ? 'text-yellow-400' : 'text-text-secondary')}
                        >
                          <Star className="w-4 h-4" fill={job.is_bookmarked ? 'currentColor' : 'none'} />
                        </button>
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-white/10 text-text-secondary hover:text-accent"
                          title="Open link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => onUpdateJob(job.id, { status: 'applied' })}
                          title="Mark applied"
                          className="p-1 rounded hover:bg-white/10 text-text-secondary hover:text-green-400"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onUpdateJob(job.id, { is_hidden: true })}
                          title="Hide"
                          className="p-1 rounded hover:bg-white/10 text-text-secondary hover:text-danger"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded.has(job.id) && (
                    <tr key={`exp-${job.id}`} className="border-b border-border/50">
                      <td colSpan={10} className="px-6 py-4 bg-background/50">
                        <p className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-6">
                          {job.description || 'No description available.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {data.jobs.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-text-secondary">
                    No jobs found. Try adjusting your filters or run a new scrape.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-secondary">
              Showing {(data.page - 1) * data.per_page + 1}-{Math.min(data.page * data.per_page, data.total)} of {data.total} jobs
            </span>
            <select
              value={data.per_page}
              onChange={e => onPerPageChange(Number(e.target.value))}
              className="bg-background border border-border rounded-md px-2 py-1 text-sm text-text-primary"
            >
              {[25, 50, 100, 250, 500, 1000].map(n => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(data.page - 1)}
              disabled={data.page <= 1}
              className="p-1 rounded hover:bg-white/10 text-text-secondary disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-text-secondary">
              Page {data.page} of {data.total_pages || 1}
            </span>
            <button
              onClick={() => onPageChange(data.page + 1)}
              disabled={data.page >= data.total_pages}
              className="p-1 rounded hover:bg-white/10 text-text-secondary disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
