import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Star, MapPin, Clock, Briefcase, DollarSign } from 'lucide-react';
import api from '@/lib/api';
import type { Job } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import { timeAgo, formatSalary, cn } from '@/lib/utils';

const STATUS_OPTIONS = ['new', 'reviewing', 'applied', 'interview', 'offer', 'rejected'];

const SKILL_KEYWORDS = [
  'python', 'sql', 'excel', 'power bi', 'tableau', 'r', 'javascript', 'java',
  'aws', 'azure', 'gcp', 'snowflake', 'bigquery', 'spark', 'pandas', 'numpy',
  'scikit-learn', 'tensorflow', 'dax', 'etl', 'data warehouse', 'airflow',
  'dbt', 'git', 'docker', 'machine learning', 'statistics', 'data visualization',
  'mongodb', 'postgresql', 'mysql', 'redshift', 'looker', 'qlik',
];

function extractSkills(description: string): string[] {
  const lower = description.toLowerCase();
  return SKILL_KEYWORDS.filter(kw => lower.includes(kw));
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      api.get(`/jobs/${id}`).then(r => {
        setJob(r.data);
        setNotes(r.data.notes || '');
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [id]);

  const updateJob = async (update: Partial<Job>) => {
    if (!job) return;
    await api.patch(`/jobs/${job.id}`, update);
    setJob(prev => prev ? { ...prev, ...update } : prev);
  };

  const saveNotes = async () => {
    setSaving(true);
    await updateJob({ notes } as Partial<Job>);
    setSaving(false);
  };

  if (loading) {
    return <div className="py-12 text-center text-text-secondary">Loading...</div>;
  }

  if (!job) {
    return <div className="py-12 text-center text-text-secondary">Job not found.</div>;
  }

  const skills = job.description ? extractSkills(job.description) : [];

  return (
    <div className="max-w-5xl space-y-6">
      <Link to="/jobs" className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Jobs
      </Link>

      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{job.title}</h1>
            <div className="flex items-center gap-3 text-text-secondary">
              {job.company && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" /> {job.company}
                </span>
              )}
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {job.location}
                  {job.is_remote && <span className="text-green-400 text-xs">(Remote)</span>}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" /> {timeAgo(job.date_posted || job.date_scraped)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-zinc-800 text-text-secondary px-2 py-0.5 rounded text-xs capitalize">
                {job.source.replace('_', ' ')}
              </span>
              {job.job_type && (
                <span className="bg-zinc-800 text-text-secondary px-2 py-0.5 rounded text-xs capitalize">
                  {job.job_type}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => updateJob({ is_bookmarked: !job.is_bookmarked })}
              className={cn('p-2 rounded-md border border-border hover:bg-white/5', job.is_bookmarked ? 'text-yellow-400' : 'text-text-secondary')}
            >
              <Star className="w-5 h-5" fill={job.is_bookmarked ? 'currentColor' : 'none'} />
            </button>
            <a
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-md text-sm hover:bg-accent/80 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Apply Now
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {skills.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-secondary mb-2">Skills Found</h3>
              <div className="flex flex-wrap gap-1.5">
                {skills.map(s => (
                  <span key={s} className="bg-accent/15 text-accent px-2 py-0.5 rounded text-xs capitalize">{s}</span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-surface border border-border rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">Job Description</h3>
            <div className="prose prose-invert prose-sm max-w-none text-text-secondary whitespace-pre-wrap leading-relaxed">
              {job.description || 'No description available.'}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            <div>
              <label className="text-xs text-text-secondary">Status</label>
              <select
                value={job.status}
                onChange={e => updateJob({ status: e.target.value as Job['status'] })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary mt-1"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-text-secondary">Salary</label>
              <div className="flex items-center gap-1 mt-1 text-sm">
                <DollarSign className="w-4 h-4 text-text-secondary" />
                {formatSalary(job.min_salary, job.max_salary)}
              </div>
            </div>

            {job.match_score != null && (
              <div>
                <label className="text-xs text-text-secondary">Match Score</label>
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          job.match_score >= 70 ? 'bg-green-500' :
                          job.match_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        )}
                        style={{ width: `${job.match_score}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{Math.round(job.match_score)}%</span>
                  </div>
                </div>
              </div>
            )}

            <StatusBadge status={job.status} className="mt-2" />
          </div>

          <div className="bg-surface border border-border rounded-lg p-4">
            <label className="text-xs text-text-secondary">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary mt-1 min-h-[100px] outline-none focus:border-accent resize-y"
              placeholder="Add personal notes..."
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 bg-accent text-white px-3 py-1.5 rounded-md text-xs hover:bg-accent/80 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
