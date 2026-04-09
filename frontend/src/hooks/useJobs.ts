import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import type { Job, JobsResponse } from '@/types';

interface JobFilters {
  search?: string;
  status?: string;
  source?: string;
  location?: string;
  is_bookmarked?: boolean;
  is_hidden?: boolean;
  min_salary?: number;
  min_match_score?: number;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  per_page?: number;
}

export function useJobs(filters: JobFilters = {}) {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params[key] = val;
        }
      });
      const res = await api.get('/jobs', { params });
      setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const updateJob = async (id: number, update: Partial<Job>) => {
    await api.patch(`/jobs/${id}`, update);
    fetchJobs();
  };

  const bulkUpdate = async (jobIds: number[], update: Record<string, unknown>) => {
    await api.patch('/jobs/bulk/update', { job_ids: jobIds, ...update });
    fetchJobs();
  };

  return { data, loading, error, refetch: fetchJobs, updateJob, bulkUpdate };
}
