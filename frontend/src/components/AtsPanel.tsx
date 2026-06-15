import { useEffect, useState } from 'react';
import { Radar, ShieldCheck, Loader2, Building2 } from 'lucide-react';
import api from '@/lib/api';

interface PortalSummary {
  total_companies: number;
  enabled: number;
  scannable_via_api: number;
  by_platform: Record<string, number>;
}

interface VerifyEntry { name: string; platform: string; analyst_roles?: number; total_roles?: number; error?: string; }
interface VerifyResult { checked: number; live: VerifyEntry[]; no_analyst_match: VerifyEntry[]; dead: VerifyEntry[]; }

export default function AtsPanel({ onScanned }: { onScanned?: (newJobs: number) => void }) {
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get('/ats/portals').then(r => setSummary(r.data)).catch(() => {});
  }, []);

  const runScan = async () => {
    setScanning(true);
    setMsg(null);
    try {
      const res = await api.post('/ats/scan');
      setMsg(`ATS scan ${res.data.status}: ${res.data.new_jobs} new, ${res.data.duplicates} duplicates, ${res.data.total_found} matched.`);
      onScanned?.(res.data.new_jobs);
    } catch {
      setMsg('ATS scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const runVerify = async () => {
    setVerifying(true);
    try {
      const res = await api.post('/ats/verify');
      setVerify(res.data);
    } catch {
      setMsg('Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-medium flex items-center gap-2">
            <Radar className="w-4 h-4 text-accent" /> Direct ATS Scan
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Pulls jobs straight from company Greenhouse / Lever / Ashby APIs (more reliable than board scraping).
            {summary && ` ${summary.scannable_via_api} companies via API.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runScan} disabled={scanning}
            className="flex items-center gap-1.5 bg-accent text-white px-3 py-2 rounded-md text-sm hover:bg-accent/80 disabled:opacity-50">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
            {scanning ? 'Scanning...' : 'Run ATS Scan'}
          </button>
          <button onClick={runVerify} disabled={verifying}
            className="flex items-center gap-1.5 border border-border text-text-secondary px-3 py-2 rounded-md text-sm hover:text-text-primary disabled:opacity-50">
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {verifying ? 'Verifying...' : 'Verify Employers'}
          </button>
        </div>
      </div>

      {msg && <div className="text-sm text-text-secondary">{msg}</div>}

      {verify && (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="text-xs text-text-secondary">
            Checked {verify.checked} · <span className="text-green-400">{verify.live.length} live with analyst roles</span> ·{' '}
            {verify.no_analyst_match.length} no match · <span className="text-danger">{verify.dead.length} dead</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {verify.live.slice(0, 30).map(e => (
              <span key={e.name} className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {e.name} ({e.analyst_roles})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
