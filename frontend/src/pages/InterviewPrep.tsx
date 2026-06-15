import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Save, X, Sparkles, MessageSquare } from 'lucide-react';
import { useInterviewStories } from '@/hooks/useCareer';
import type { InterviewStory } from '@/types';
import api from '@/lib/api';

const EMPTY: Partial<InterviewStory> = {
  title: '', theme: '', situation: '', task: '', action: '', result: '', reflection: '', best_for: '',
};

const FIELDS: { key: keyof InterviewStory; label: string }[] = [
  { key: 'situation', label: 'Situation' },
  { key: 'task', label: 'Task' },
  { key: 'action', label: 'Action' },
  { key: 'result', label: 'Result' },
  { key: 'reflection', label: 'Reflection' },
  { key: 'best_for', label: 'Best for' },
];

export default function InterviewPrep() {
  const { stories, loading, create, update, remove } = useInterviewStories();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Partial<InterviewStory>>(EMPTY);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  useEffect(() => {
    api.get('/interview/settings/negotiation_notes')
      .then(r => setNotes(r.data.value || ''))
      .catch(() => {});
  }, []);

  const saveNotes = async () => {
    setNotesSaving(true);
    try {
      await api.put('/interview/settings/negotiation_notes', { value: notes });
    } finally {
      setNotesSaving(false);
    }
  };

  const startNew = () => { setDraft(EMPTY); setEditing('new'); };
  const startEdit = (s: InterviewStory) => { setDraft(s); setEditing(s.id); };
  const cancel = () => { setEditing(null); setDraft(EMPTY); };

  const save = async () => {
    if (!draft.title?.trim()) return;
    if (editing === 'new') await create(draft);
    else if (typeof editing === 'number') await update(editing, draft);
    cancel();
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Interview Prep</h1>
          <p className="text-sm text-text-secondary mt-1">
            A STAR+Reflection story bank. Write your own, or generate drafts from a job (open a job → Interview).
          </p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-md text-sm hover:bg-accent/80 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Story
        </button>
      </div>

      {editing !== null && (
        <div className="bg-surface border border-accent/40 rounded-lg p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Title *"
              value={draft.title || ''}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              placeholder="Theme (e.g. leadership)"
              value={draft.theme || ''}
              onChange={e => setDraft({ ...draft, theme: e.target.value })}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          {FIELDS.map(f => (
            <textarea
              key={f.key}
              placeholder={f.label}
              value={(draft[f.key] as string) || ''}
              onChange={e => setDraft({ ...draft, [f.key]: e.target.value })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent resize-y min-h-[52px]"
            />
          ))}
          <div className="flex items-center gap-2">
            <button onClick={save} className="flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-md text-xs hover:bg-accent/80">
              <Save className="w-3 h-3" /> Save
            </button>
            <button onClick={cancel} className="flex items-center gap-1.5 border border-border text-text-secondary px-3 py-1.5 rounded-md text-xs hover:text-text-primary">
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      )}

      <section className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-text-secondary">Loading stories...</div>
        ) : stories.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-10 text-center text-text-secondary">
            No stories yet. Add one, or generate drafts from a job.
          </div>
        ) : (
          stories.map(s => (
            <div key={s.id} className="bg-surface border border-border rounded-lg p-5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    {s.title}
                    {s.source === 'generated' && (
                      <span className="bg-accent/15 text-accent px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> AI draft
                      </span>
                    )}
                  </h3>
                  {s.theme && <span className="text-xs text-text-secondary">{s.theme}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(s)} className="text-text-secondary hover:text-text-primary p-1.5"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm('Delete this story?')) remove(s.id); }} className="text-text-secondary hover:text-danger p-1.5"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="text-sm text-text-secondary space-y-1.5">
                {FIELDS.map(f => (s[f.key] ? (
                  <p key={f.key}><span className="text-text-primary font-medium">{f.label}:</span> {s[f.key] as string}</p>
                ) : null))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="bg-surface border border-border rounded-lg p-5">
        <h2 className="font-medium flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-accent" /> Negotiation Notes
        </h2>
        <p className="text-xs text-text-secondary mb-3">
          Salary frameworks, counter-offer scripts, geographic-discount pushback — your personal cheat sheet.
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent resize-y min-h-[140px]"
          placeholder="e.g. Target: $X base. If they open low, anchor with market data from Levels.fyi..."
        />
        <button
          onClick={saveNotes}
          disabled={notesSaving}
          className="mt-2 bg-accent text-white px-3 py-1.5 rounded-md text-xs hover:bg-accent/80 disabled:opacity-50"
        >
          {notesSaving ? 'Saving...' : 'Save Notes'}
        </button>
      </section>
    </div>
  );
}
