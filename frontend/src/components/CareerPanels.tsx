import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles, FileText, Mail, MessageSquareQuote, AlertTriangle, MessagesSquare, Check } from 'lucide-react';
import api from '@/lib/api';
import { useResumes, useLlmStatus } from '@/hooks/useCareer';
import type { ResumeEvaluation, AiEvaluation, GeneratedDocument } from '@/types';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'resume', label: 'Resume Match', icon: FileText },
  { id: 'ai', label: 'AI Evaluation', icon: Sparkles },
  { id: 'docs', label: 'Documents', icon: Mail },
  { id: 'interview', label: 'Interview', icon: MessagesSquare },
] as const;
type TabId = (typeof TABS)[number]['id'];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500')}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="text-sm font-medium w-10 text-right">{Math.round(value)}%</span>
    </div>
  );
}

export default function CareerPanels({ jobId }: { jobId: number }) {
  const [tab, setTab] = useState<TabId>('resume');
  const { status } = useLlmStatus();
  const llmDown = status && (!status.reachable || !status.model_present);

  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-1 border-b border-border -mx-5 px-5 pb-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
              tab === t.id ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {llmDown && tab !== 'resume' && (
        <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 text-xs text-yellow-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Local LLM not ready ({status?.reachable ? `model ${status?.model} not pulled` : 'Ollama unreachable'}).
            Run <code className="text-yellow-200">ollama pull {status?.model}</code> and make sure Ollama is running.
          </span>
        </div>
      )}

      {tab === 'resume' && <ResumeMatch jobId={jobId} />}
      {tab === 'ai' && <AiEval jobId={jobId} />}
      {tab === 'docs' && <Documents jobId={jobId} />}
      {tab === 'interview' && <InterviewGen jobId={jobId} />}
    </div>
  );
}

// ── Interview story generation ──

interface Story { id: number; job_id: number | null; source: string; }

function InterviewGen({ jobId }: { jobId: number }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [added, setAdded] = useState(0);

  const countGenerated = async () => {
    const stories: Story[] = (await api.get('/interview/stories')).data;
    return stories.filter(s => s.job_id === jobId && s.source === 'generated').length;
  };

  const generate = async () => {
    setBusy(true);
    setDone(false);
    setAdded(0);
    try {
      const before = await countGenerated();
      await api.post('/interview/generate', null, { params: { job_id: jobId } });
      // Poll for the background task to insert new generated stories for this job.
      for (let i = 0; i < 60; i++) {
        await sleep(3000);
        const now = await countGenerated();
        if (now > before) {
          setAdded(now - before);
          setDone(true);
          break;
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        Draft STAR+Reflection interview stories from your primary resume tailored to this job.
        Drafts are added to your story bank to edit.
      </p>
      <button
        onClick={generate}
        disabled={busy}
        className="flex items-center gap-1.5 bg-accent text-white px-3 py-2 rounded-md text-sm hover:bg-accent/80 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessagesSquare className="w-4 h-4" />}
        {busy ? 'Generating… (local model)' : 'Generate STAR Stories'}
      </button>
      {done && (
        <div className="flex items-center gap-2 text-sm text-green-400">
          <Check className="w-4 h-4" /> {added} draft{added === 1 ? '' : 's'} added —{' '}
          <Link to="/interview" className="underline hover:text-green-300">view in Interview Prep</Link>
        </div>
      )}
      {busy && <p className="text-xs text-text-secondary">Generating with the local model — this can take up to a minute.</p>}
    </div>
  );
}

// ── Resume Match ──

function ResumeMatch({ jobId }: { jobId: number }) {
  const { resumes } = useResumes();
  const [resumeId, setResumeId] = useState<number | ''>('');
  const [ev, setEv] = useState<ResumeEvaluation | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/resumes/job/${jobId}/evaluations`).then(r => { if (r.data[0]) setEv(r.data[0]); }).catch(() => {});
  }, [jobId]);

  useEffect(() => {
    if (resumes.length && resumeId === '') {
      setResumeId(resumes.find(r => r.is_primary)?.id ?? resumes[0].id);
    }
  }, [resumes, resumeId]);

  const run = useCallback(async () => {
    if (resumeId === '') return;
    setBusy(true);
    try {
      const res = await api.post(`/resumes/${resumeId}/evaluate`, null, { params: { job_id: jobId } });
      let cur: ResumeEvaluation = res.data;
      setEv(cur);
      // keyword score is instant; poll for the LLM part.
      for (let i = 0; i < 90 && (cur.status === 'pending' || cur.status === 'running'); i++) {
        await sleep(2000);
        cur = (await api.get(`/resumes/evaluations/${cur.id}`)).data;
        setEv(cur);
      }
    } finally {
      setBusy(false);
    }
  }, [resumeId, jobId]);

  if (!resumes.length) {
    return <p className="text-sm text-text-secondary">Upload a resume first (Resumes page), then score it against this job.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          value={resumeId}
          onChange={e => setResumeId(Number(e.target.value))}
          className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
        >
          {resumes.map(r => <option key={r.id} value={r.id}>{r.name}{r.is_primary ? ' (primary)' : ''}</option>)}
        </select>
        <button
          onClick={run}
          disabled={busy}
          className="flex items-center gap-1.5 bg-accent text-white px-3 py-2 rounded-md text-sm hover:bg-accent/80 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {busy ? 'Scoring...' : 'Score'}
        </button>
      </div>

      {ev && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-text-secondary mb-1">Keyword coverage</div>
              {ev.keyword_score != null ? <ScoreBar value={ev.keyword_score} /> : <span className="text-sm">—</span>}
            </div>
            <div>
              <div className="text-xs text-text-secondary mb-1">AI fit score</div>
              {ev.llm_fit_score != null ? <ScoreBar value={ev.llm_fit_score} />
                : <span className="text-sm text-text-secondary flex items-center gap-1.5">
                    {ev.status === 'running' || ev.status === 'pending' ? <><Loader2 className="w-3 h-3 animate-spin" /> analyzing…</> : '—'}
                  </span>}
            </div>
          </div>

          {ev.matched.length > 0 && (
            <div>
              <div className="text-xs text-text-secondary mb-1.5">Matched ({ev.matched.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {ev.matched.map(k => <span key={k} className="bg-green-500/15 text-green-400 px-2 py-0.5 rounded text-xs capitalize">{k}</span>)}
              </div>
            </div>
          )}
          {ev.missing.length > 0 && (
            <div>
              <div className="text-xs text-text-secondary mb-1.5">Gaps / missing ({ev.missing.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {ev.missing.map(k => <span key={k} className="bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded text-xs capitalize">{k}</span>)}
              </div>
            </div>
          )}
          {ev.llm_feedback && (
            <div>
              <div className="text-xs text-text-secondary mb-1">Feedback</div>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{ev.llm_feedback}</p>
            </div>
          )}
          {ev.suggestions.length > 0 && (
            <div>
              <div className="text-xs text-text-secondary mb-1.5">Suggestions</div>
              <ul className="list-disc list-inside text-sm text-text-secondary space-y-1">
                {ev.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {ev.status === 'failed' && <p className="text-xs text-danger">AI step failed: {ev.error}</p>}
        </div>
      )}
    </div>
  );
}

// ── AI Evaluation (A-F) ──

const BLOCK_LABELS: Record<string, string> = {
  role_fit: 'Role Fit',
  cv_match: 'CV Match',
  level_strategy: 'Level Strategy',
  comp_notes: 'Compensation',
  personalization: 'Personalization',
  red_flags: 'Red Flags',
};

function AiEval({ jobId }: { jobId: number }) {
  const [ev, setEv] = useState<AiEvaluation | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/jobs/${jobId}/ai-evaluation`).then(r => setEv(r.data)).catch(() => {});
  }, [jobId]);

  const run = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/jobs/${jobId}/ai-evaluate`);
      let cur: AiEvaluation = res.data;
      setEv(cur);
      for (let i = 0; i < 120 && (cur.status === 'pending' || cur.status === 'running'); i++) {
        await sleep(2500);
        cur = (await api.get(`/jobs/${jobId}/ai-evaluation`)).data;
        setEv(cur);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={run}
        disabled={busy}
        className="flex items-center gap-1.5 bg-accent text-white px-3 py-2 rounded-md text-sm hover:bg-accent/80 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {busy ? 'Evaluating… (local model, ~30-90s)' : ev ? 'Re-run Evaluation' : 'Run AI Evaluation'}
      </button>

      {ev && ev.status === 'done' && (
        <div className="space-y-4">
          {ev.fit_score != null && (
            <div>
              <div className="text-xs text-text-secondary mb-1">Overall fit</div>
              <ScoreBar value={ev.fit_score} />
            </div>
          )}
          {ev.summary && <p className="text-sm text-text-secondary">{ev.summary}</p>}
          {ev.recommendation && (
            <div className="bg-accent/10 border border-accent/30 rounded-md p-3 text-sm">
              <span className="text-accent font-medium">Recommendation: </span>{ev.recommendation}
            </div>
          )}
          <div className="space-y-3">
            {Object.entries(ev.blocks).map(([k, v]) => (
              <div key={k}>
                <div className="text-xs font-medium text-text-primary mb-1">{BLOCK_LABELS[k] || k}</div>
                <div className="text-sm text-text-secondary whitespace-pre-wrap">
                  {Array.isArray(v) ? (v as unknown[]).map((x, i) => <div key={i}>• {String(x)}</div>) : String(v)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {ev && ev.status === 'failed' && <p className="text-xs text-danger">Evaluation failed: {ev.error}</p>}
    </div>
  );
}

// ── Documents ──

function Documents({ jobId }: { jobId: number }) {
  const [docs, setDocs] = useState<GeneratedDocument[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get(`/jobs/${jobId}/documents`).then(r => setDocs(r.data)).catch(() => {});
  }, [jobId]);
  useEffect(() => { load(); }, [load]);

  const generate = async (type: 'cover_letter' | 'outreach') => {
    setBusy(type);
    try {
      const res = await api.post(`/jobs/${jobId}/generate-document`, null, { params: { type } });
      let cur: GeneratedDocument = res.data;
      for (let i = 0; i < 120 && (cur.status === 'pending' || cur.status === 'running'); i++) {
        await sleep(2500);
        cur = (await api.get(`/jobs/documents/${cur.id}`)).data;
      }
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => generate('cover_letter')} disabled={!!busy}
          className="flex items-center gap-1.5 bg-accent text-white px-3 py-2 rounded-md text-sm hover:bg-accent/80 disabled:opacity-50">
          {busy === 'cover_letter' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Cover Letter
        </button>
        <button onClick={() => generate('outreach')} disabled={!!busy}
          className="flex items-center gap-1.5 border border-border text-text-secondary px-3 py-2 rounded-md text-sm hover:text-text-primary disabled:opacity-50">
          {busy === 'outreach' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareQuote className="w-4 h-4" />} Outreach Message
        </button>
      </div>
      {busy && <p className="text-xs text-text-secondary">Generating with the local model — this can take up to a minute.</p>}

      <div className="space-y-3">
        {docs.map(d => (
          <div key={d.id} className="border border-border rounded-md p-3">
            <div className="text-xs text-text-secondary mb-1.5 capitalize">{d.type.replace('_', ' ')}</div>
            {d.status === 'done' ? (
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{d.content}</p>
            ) : d.status === 'failed' ? (
              <p className="text-xs text-danger">Failed: {d.error}</p>
            ) : (
              <p className="text-xs text-text-secondary flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> generating…</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
