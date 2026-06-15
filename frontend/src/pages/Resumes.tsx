import { useRef, useState } from 'react';
import { Upload, Star, Trash2, FileText, Loader2 } from 'lucide-react';
import { useResumes } from '@/hooks/useCareer';
import { timeAgo, cn } from '@/lib/utils';

export default function Resumes() {
  const { resumes, loading, error, upload, setPrimary, remove } = useResumes();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await upload(file);
      flash(`Uploaded ${file.name}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      flash(detail || 'Upload failed — only .docx, .pdf, .md, .txt are supported.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 bg-surface border border-border rounded-lg px-4 py-3 text-sm text-text-primary shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Resumes</h1>
          <p className="text-sm text-text-secondary mt-1">
            Tailor your resume in Word, upload it here, then score it against any job. The{' '}
            <span className="text-text-primary">primary</span> resume is the CV context for AI features.
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-md text-sm hover:bg-accent/80 disabled:opacity-50 transition-colors"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading...' : 'Upload Resume'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".docx,.pdf,.md,.txt"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-sm text-danger">
          {error} — Make sure the backend is running on port 8000.
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-text-secondary">Loading resumes...</div>
      ) : resumes.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-text-secondary mb-3" />
          <p className="text-text-secondary mb-4">No resumes yet. Upload a .docx or .pdf to get started.</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="bg-accent text-white px-4 py-2 rounded-md text-sm hover:bg-accent/80"
          >
            Upload Your First Resume
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {resumes.map(r => (
            <div key={r.id} className="bg-surface border border-border rounded-lg p-4 flex items-center gap-4">
              <FileText className="w-8 h-8 text-text-secondary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{r.name}</h3>
                  {r.is_primary && (
                    <span className="bg-accent/15 text-accent px-2 py-0.5 rounded text-xs flex items-center gap-1">
                      <Star className="w-3 h-3" fill="currentColor" /> Primary
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {r.filename} · {r.chars.toLocaleString()} chars · uploaded {timeAgo(r.created_at)}
                </div>
              </div>
              <button
                onClick={() => setPrimary(r.id)}
                disabled={r.is_primary}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-border transition-colors',
                  r.is_primary ? 'text-text-secondary opacity-50 cursor-default' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <Star className="w-3 h-3" /> {r.is_primary ? 'Primary' : 'Set Primary'}
              </button>
              <button
                onClick={() => { if (confirm(`Delete "${r.name}"?`)) remove(r.id); }}
                className="text-text-secondary hover:text-danger p-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
