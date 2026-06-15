import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import type { Resume, InterviewStory, LlmStatus } from '@/types';

export function useLlmStatus() {
  const [status, setStatus] = useState<LlmStatus | null>(null);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/llm/status');
      setStatus(res.data);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    fetch();
    const t = setInterval(fetch, 30000);
    return () => clearInterval(t);
  }, [fetch]);

  return { status, refetch: fetch };
}

export function useResumes() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResumes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/resumes');
      setResumes(res.data);
    } catch {
      setError('Failed to load resumes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResumes(); }, [fetchResumes]);

  const upload = async (file: File, name?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);
    // Unset the instance's default application/json so the browser sets
    // multipart/form-data WITH the boundary param (required to parse the upload).
    await api.post('/resumes', form, { headers: { 'Content-Type': undefined } });
    await fetchResumes();
  };

  const setPrimary = async (id: number) => {
    await api.patch(`/resumes/${id}`);
    await fetchResumes();
  };

  const remove = async (id: number) => {
    await api.delete(`/resumes/${id}`);
    await fetchResumes();
  };

  return { resumes, loading, error, refetch: fetchResumes, upload, setPrimary, remove };
}

export function useInterviewStories() {
  const [stories, setStories] = useState<InterviewStory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/interview/stories');
      setStories(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  const create = async (data: Partial<InterviewStory>) => {
    await api.post('/interview/stories', data);
    await fetchStories();
  };
  const update = async (id: number, data: Partial<InterviewStory>) => {
    await api.put(`/interview/stories/${id}`, data);
    await fetchStories();
  };
  const remove = async (id: number) => {
    await api.delete(`/interview/stories/${id}`);
    await fetchStories();
  };

  return { stories, loading, refetch: fetchStories, create, update, remove };
}
