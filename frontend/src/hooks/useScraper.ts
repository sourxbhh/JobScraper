import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import type { ScrapeConfig, ScrapeRun } from '@/types';

export function useScrapeConfigs() {
  const [configs, setConfigs] = useState<ScrapeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/scrapes');
      setConfigs(res.data);
    } catch (err: unknown) {
      console.error('Failed to fetch configs:', err);
      setError('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const createConfig = async (data: Omit<ScrapeConfig, 'id' | 'created_at' | 'updated_at' | 'last_run'>) => {
    const res = await api.post('/scrapes', data);
    await fetchConfigs();
    return res.data;
  };

  const updateConfig = async (id: number, data: Omit<ScrapeConfig, 'id' | 'created_at' | 'updated_at' | 'last_run'>) => {
    const res = await api.put(`/scrapes/${id}`, data);
    await fetchConfigs();
    return res.data;
  };

  const deleteConfig = async (id: number) => {
    await api.delete(`/scrapes/${id}`);
    await fetchConfigs();
  };

  const runScrape = async (id: number) => {
    const res = await api.post(`/scrapes/${id}/run`);
    await fetchConfigs();
    return res.data;
  };

  return { configs, loading, error, refetch: fetchConfigs, createConfig, updateConfig, deleteConfig, runScrape };
}

export function useRecentRuns(limit = 5) {
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/scrapes/runs/recent', { params: { limit } });
      setRuns(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { runs, loading, refetch: fetch };
}
