import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar,
} from 'recharts';
import api from '@/lib/api';
import { CHART_COLORS, SOURCE_COLORS } from '@/lib/utils';
import type { SourceData, TimeData, CompanyData, SalaryData, SkillData, FunnelData, OverviewStats } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  new: '#60a5fa',
  reviewing: '#c084fc',
  applied: '#facc15',
  interview: '#f97316',
  offer: '#22c55e',
  rejected: '#ef4444',
};

const tooltipStyle = {
  contentStyle: { background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fafafa' },
};

export default function Analytics() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [bySource, setBySource] = useState<SourceData[]>([]);
  const [overTime, setOverTime] = useState<TimeData[]>([]);
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [salaries, setSalaries] = useState<SalaryData[]>([]);
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [funnel, setFunnel] = useState<FunnelData[]>([]);

  useEffect(() => {
    api.get('/analytics/overview').then(r => setStats(r.data)).catch(() => {});
    api.get('/analytics/by-source').then(r => setBySource(r.data)).catch(() => {});
    api.get('/analytics/over-time', { params: { days: 30 } }).then(r => setOverTime(r.data)).catch(() => {});
    api.get('/analytics/companies', { params: { limit: 15 } }).then(r => setCompanies(r.data)).catch(() => {});
    api.get('/analytics/salaries').then(r => setSalaries(r.data)).catch(() => {});
    api.get('/analytics/skills', { params: { limit: 20 } }).then(r => setSkills(r.data)).catch(() => {});
    api.get('/analytics/funnel').then(r => setFunnel(r.data)).catch(() => {});
  }, []);

  const chartCard = (title: string, content: React.ReactNode) => (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3 className="text-base font-medium mb-4">{title}</h3>
      {content}
    </div>
  );

  const noData = <p className="text-sm text-text-secondary text-center py-8">No data yet.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-text-secondary uppercase">Total Unique Jobs</p>
            <p className="text-2xl font-semibold mt-1">{stats.total_jobs}</p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-text-secondary uppercase">Applied</p>
            <p className="text-2xl font-semibold mt-1">{stats.applied}</p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-text-secondary uppercase">Application Rate</p>
            <p className="text-2xl font-semibold mt-1">
              {stats.total_jobs > 0 ? ((stats.applied / stats.total_jobs) * 100).toFixed(1) : 0}%
            </p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-text-secondary uppercase">Bookmarked</p>
            <p className="text-2xl font-semibold mt-1">{stats.bookmarked}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs by Source */}
        {chartCard('Jobs by Source', bySource.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={bySource} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={(props: any) => `${props.source} (${props.count})`}>
                {bySource.map((entry, i) => (
                  <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        ) : noData)}

        {/* New Jobs Over Time */}
        {chartCard('New Jobs Over Time (30 days)', overTime.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={overTime}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : noData)}

        {/* Top Companies */}
        {chartCard('Top 15 Hiring Companies', companies.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(250, companies.length * 28)}>
            <BarChart data={companies} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: '#a1a1aa' }} />
              <YAxis dataKey="company" type="category" width={130} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : noData)}

        {/* Salary Distribution */}
        {chartCard('Salary Distribution', salaries.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={salaries}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#a1a1aa' }} />
              <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : noData)}

        {/* Application Funnel */}
        {chartCard('Application Funnel', funnel.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={funnel}>
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
              <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {funnel.map(entry => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : noData)}

        {/* Top Skills */}
        {chartCard('Most Common Skills', skills.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(250, skills.length * 24)}>
            <BarChart data={skills} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: '#a1a1aa' }} />
              <YAxis dataKey="skill" type="category" width={120} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : noData)}
      </div>
    </div>
  );
}
