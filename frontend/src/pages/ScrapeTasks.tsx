import { useState } from 'react';
import { Play, Edit, Trash2, Plus, Clock, MapPin, Search, Loader2 } from 'lucide-react';
import { useScrapeConfigs } from '@/hooks/useScraper';
import ScrapeForm from '@/components/ScrapeForm';
import RunHistory from '@/components/RunHistory';
import type { ScrapeConfig, ScrapeRun } from '@/types';
import { timeAgo } from '@/lib/utils';
import api from '@/lib/api';

export default function ScrapeTasks() {
  const { configs, loading, error: loadError, createConfig, updateConfig, deleteConfig, runScrape } = useScrapeConfigs();
  const [showForm, setShowForm] = useState(false);
  const [editConfig, setEditConfig] = useState<ScrapeConfig | null>(null);
  const [runningIds, setRunningIds] = useState<Set<number>>(new Set());
  const [historyConfigId, setHistoryConfigId] = useState<number | null>(null);
  const [history, setHistory] = useState<ScrapeRun[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const handleRun = async (id: number) => {
    setRunningIds(prev => new Set(prev).add(id));
    try {
      const result = await runScrape(id);
      setToast(`Scrape complete: ${result.new_jobs} new jobs found`);
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Scrape failed. Check the logs.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setRunningIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleShowHistory = async (configId: number) => {
    if (historyConfigId === configId) {
      setHistoryConfigId(null);
      return;
    }
    try {
      const res = await api.get(`/scrapes/${configId}/history`);
      setHistory(res.data);
      setHistoryConfigId(configId);
    } catch {
      // ignore
    }
  };

  if (showForm || editConfig) {
    return (
      <div className="max-w-2xl">
        {toast && (
          <div className="fixed top-4 right-4 bg-surface border border-danger/50 rounded-lg px-4 py-3 text-sm text-danger shadow-lg z-50">
            {toast}
          </div>
        )}
        <h1 className="text-2xl font-semibold mb-6">
          {editConfig ? 'Edit Scrape Config' : 'New Scrape Config'}
        </h1>
        <div className="bg-surface border border-border rounded-lg p-6">
          <ScrapeForm
            initial={editConfig || undefined}
            onSubmit={async data => {
              try {
                if (editConfig) {
                  await updateConfig(editConfig.id, data);
                } else {
                  await createConfig(data);
                }
                setShowForm(false);
                setEditConfig(null);
              } catch (err) {
                console.error('Failed to save config:', err);
                setToast('Failed to save configuration. Make sure the backend is running.');
                setTimeout(() => setToast(null), 4000);
              }
            }}
            onCancel={() => { setShowForm(false); setEditConfig(null); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 bg-surface border border-border rounded-lg px-4 py-3 text-sm text-text-primary shadow-lg z-50 animate-in fade-in">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Scrape Tasks</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-md text-sm hover:bg-accent/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Config
        </button>
      </div>

      {loadError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-sm text-danger">
          {loadError} — Make sure the backend server is running on port 8000.
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-text-secondary">Loading configs...</div>
      ) : configs.length === 0 && !loadError ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <p className="text-text-secondary mb-4">No scrape configurations yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-accent text-white px-4 py-2 rounded-md text-sm hover:bg-accent/80"
          >
            Create Your First Config
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {configs.map(config => (
            <div key={config.id} className="bg-surface border border-border rounded-lg p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-text-primary">{config.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {config.locations?.join(', ') || '—'}
                    </span>
                    {config.schedule && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {config.schedule}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${config.is_active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700/50 text-zinc-400'}`}>
                  {config.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {config.search_terms.map(term => (
                  <span key={term} className="bg-accent/10 text-accent px-2 py-0.5 rounded text-xs flex items-center gap-1">
                    <Search className="w-3 h-3" /> {term}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {config.sites.map(site => (
                  <span key={site} className="bg-zinc-800 text-text-secondary px-2 py-0.5 rounded text-xs capitalize">
                    {site.replace('_', ' ')}
                  </span>
                ))}
              </div>

              <div className="text-xs text-text-secondary">
                {config.distance > 0 && `${config.distance} mi radius`}
                {config.distance > 0 && ' · '}
                {config.results_per_site}/site
                {config.include_remote && ' · Remote included'}
              </div>

              {config.last_run && (
                <div className="text-xs text-text-secondary border-t border-border pt-2">
                  Last run: {timeAgo(config.last_run.started_at)} — {config.last_run.new_jobs} new jobs
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleRun(config.id)}
                  disabled={runningIds.has(config.id)}
                  className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-md text-xs hover:bg-accent/80 disabled:opacity-50 transition-colors"
                >
                  {runningIds.has(config.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  {runningIds.has(config.id) ? 'Running...' : 'Run Now'}
                </button>
                <button
                  onClick={() => setEditConfig(config)}
                  className="flex items-center gap-1.5 bg-surface border border-border text-text-secondary px-3 py-1.5 rounded-md text-xs hover:text-text-primary transition-colors"
                >
                  <Edit className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => handleShowHistory(config.id)}
                  className="flex items-center gap-1.5 bg-surface border border-border text-text-secondary px-3 py-1.5 rounded-md text-xs hover:text-text-primary transition-colors"
                >
                  <Clock className="w-3 h-3" /> History
                </button>
                <button
                  onClick={() => { if (confirm('Delete this config?')) deleteConfig(config.id); }}
                  className="flex items-center gap-1.5 text-text-secondary px-2 py-1.5 rounded-md text-xs hover:text-danger transition-colors ml-auto"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {historyConfigId === config.id && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-medium mb-2">Run History</h4>
                  <RunHistory runs={history} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
