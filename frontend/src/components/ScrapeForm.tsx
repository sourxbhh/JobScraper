import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { ScrapeConfig } from '@/types';

type FormData = Omit<ScrapeConfig, 'id' | 'created_at' | 'updated_at' | 'last_run'>;

interface Props {
  initial?: ScrapeConfig;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

const SITES = ['indeed', 'linkedin', 'glassdoor', 'google', 'zip_recruiter', 'ycombinator'];
const SITE_LABELS: Record<string, string> = { ycombinator: 'Y Combinator' };
const SCHEDULES = ['', 'every 6h', 'every 12h', 'daily'];
const JOB_TYPES = ['internship', 'co-op', 'fulltime', 'parttime', 'contract'];

export default function ScrapeForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name || '');
  const [searchTerms, setSearchTerms] = useState<string[]>(initial?.search_terms || []);
  const [termInput, setTermInput] = useState('');
  const [sites, setSites] = useState<string[]>(initial?.sites || ['indeed', 'linkedin']);
  const [locations, setLocations] = useState<string[]>(initial?.locations || ['Charlotte, NC']);
  const [locationInput, setLocationInput] = useState('');
  const [distance, setDistance] = useState(initial?.distance || 50);
  const [maxAgeHours, setMaxAgeHours] = useState(initial?.max_age_hours || 72);
  const [resultsPerSite, setResultsPerSite] = useState(initial?.results_per_site || 25);
  const [jobTypes, setJobTypes] = useState<string[]>(initial?.job_types || []);
  const [includeRemote, setIncludeRemote] = useState(initial?.include_remote ?? true);
  const [googleSearchTerm, setGoogleSearchTerm] = useState(initial?.google_search_term || '');
  const [schedule, setSchedule] = useState(initial?.schedule || '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const addTerm = () => {
    if (termInput.trim() && !searchTerms.includes(termInput.trim())) {
      setSearchTerms([...searchTerms, termInput.trim()]);
      setTermInput('');
    }
  };

  const removeTerm = (term: string) => {
    setSearchTerms(searchTerms.filter(t => t !== term));
  };

  const addLocation = () => {
    if (locationInput.trim() && !locations.includes(locationInput.trim())) {
      setLocations([...locations, locationInput.trim()]);
      setLocationInput('');
    }
  };

  const removeLocation = (loc: string) => {
    setLocations(locations.filter(l => l !== loc));
  };

  const toggleSite = (site: string) => {
    setSites(sites.includes(site) ? sites.filter(s => s !== site) : [...sites, site]);
  };

  const toggleJobType = (jt: string) => {
    setJobTypes(jobTypes.includes(jt) ? jobTypes.filter(t => t !== jt) : [...jobTypes, jt]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      search_terms: searchTerms,
      sites,
      locations,
      distance,
      max_age_hours: maxAgeHours,
      results_per_site: resultsPerSite,
      job_types: jobTypes.length > 0 ? jobTypes : null,
      include_remote: includeRemote,
      google_search_term: googleSearchTerm || null,
      schedule: schedule || null,
      is_active: isActive,
    });
  };

  const labelClass = 'block text-sm font-medium text-text-secondary mb-1';
  const inputClass = 'w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-accent';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Config Name</label>
        <input value={name} onChange={e => setName(e.target.value)} className={inputClass} required />
      </div>

      <div>
        <label className={labelClass}>Search Terms</label>
        <div className="flex gap-2 mb-2 flex-wrap">
          {searchTerms.map(t => (
            <span key={t} className="flex items-center gap-1 bg-accent/20 text-accent px-2 py-1 rounded-full text-xs">
              {t}
              <button type="button" onClick={() => removeTerm(t)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={termInput}
            onChange={e => setTermInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTerm(); } }}
            placeholder="Add search term..."
            className={inputClass}
          />
          <button type="button" onClick={addTerm} className="bg-accent text-white px-3 py-2 rounded-md text-sm hover:bg-accent/80">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <label className={labelClass}>Job Sites</label>
        <div className="flex flex-wrap gap-2">
          {SITES.map(s => (
            <label key={s} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="checkbox" checked={sites.includes(s)} onChange={() => toggleSite(s)} className="accent-accent" />
              {SITE_LABELS[s] || s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>Locations</label>
        <div className="flex gap-2 mb-2 flex-wrap">
          {locations.map(loc => (
            <span key={loc} className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">
              {loc}
              <button type="button" onClick={() => removeLocation(loc)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={locationInput}
            onChange={e => setLocationInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLocation(); } }}
            placeholder="Add location (e.g. New York, NY)..."
            className={inputClass}
          />
          <button type="button" onClick={addLocation} className="bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <label className={labelClass}>Distance (miles per location)</label>
        <input type="number" value={distance} onChange={e => setDistance(Number(e.target.value))} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Max Age</label>
          <select value={maxAgeHours} onChange={e => setMaxAgeHours(Number(e.target.value))} className={inputClass}>
            <option value={24}>1 day</option>
            <option value={72}>3 days</option>
            <option value={168}>7 days</option>
            <option value={336}>14 days</option>
            <option value={720}>30 days</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Results Per Site</label>
          <input type="number" value={resultsPerSite} onChange={e => setResultsPerSite(Number(e.target.value))} className={inputClass} min={1} max={100} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Job Types</label>
        <div className="flex flex-wrap gap-2">
          {JOB_TYPES.map(jt => (
            <label key={jt} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="checkbox" checked={jobTypes.includes(jt)} onChange={() => toggleJobType(jt)} className="accent-accent" />
              {jt.charAt(0).toUpperCase() + jt.slice(1)}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input type="checkbox" checked={includeRemote} onChange={e => setIncludeRemote(e.target.checked)} className="accent-accent" />
          Include Remote
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-accent" />
          Active
        </label>
      </div>

      <div>
        <label className={labelClass}>Schedule</label>
        <select value={schedule} onChange={e => setSchedule(e.target.value)} className={inputClass}>
          <option value="">Manual only</option>
          {SCHEDULES.filter(Boolean).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Google Search Term (optional)</label>
        <input value={googleSearchTerm} onChange={e => setGoogleSearchTerm(e.target.value)} className={inputClass} placeholder="Custom Google query..." />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="bg-accent text-white px-4 py-2 rounded-md text-sm hover:bg-accent/80 transition-colors">
          {initial ? 'Update Config' : 'Create Config'}
        </button>
        <button type="button" onClick={onCancel} className="bg-surface border border-border text-text-secondary px-4 py-2 rounded-md text-sm hover:text-text-primary transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
