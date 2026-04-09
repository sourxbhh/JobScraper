import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';
import { Play, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import StatsCards from '@/components/StatsCards';
import RunHistory from '@/components/RunHistory';
import { CHART_COLORS, SOURCE_COLORS } from '@/lib/utils';
import type { ScrapeRun, SourceData, TimeData, CompanyData } from '@/types';

export default function Dashboard() {
  const [recentRuns, setRecentRuns] = useState<ScrapeRun[]>([]);
  const [bySource, setBySource] = useState<SourceData[]>([]);
  const [overTime, setOverTime] = useState<TimeData[]>([]);
  const [companies, setCompanies] = useState<CompanyData[]>([]);

  useEffect(() => {
    api.get('/scrapes/runs/recent', { params: { limit: 5 } }).then(r => setRecentRuns(r.data)).catch(() => {});
    api.get('/analytics/by-source').then(r => setBySource(r.data)).catch(() => {});
    api.get('/analytics/over-time', { params: { days: 14 } }).then(r => setOverTime(r.data)).catch(() => {});
    api.get('/analytics/companies', { params: { limit: 10 } }).then(r => setCompanies(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex gap-3">
          <Link
            to="/scrapes"
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-md text-sm hover:bg-accent/80 transition-colors"
          >
            <Play className="w-4 h-4" />
            Run New Scrape
          </Link>
          <Link
            to="/jobs"
            className="flex items-center gap-2 bg-surface border border-border text-text-secondary px-4 py-2 rounded-md text-sm hover:text-text-primary transition-colors"
          >
            View All Jobs
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-lg font-medium mb-4">Recent Scrape Runs</h2>
          <RunHistory runs={recentRuns} />
        </div>

        {/* Jobs by Source */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-lg font-medium mb-4">Jobs by Source</h2>
          {bySource.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={bySource}
                  dataKey="count"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(props: any) => `${props.source} (${props.count})`}
                >
                  {bySource.map((entry, i) => (
                    <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fafafa' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-secondary text-center py-8">No data yet. Run a scrape to get started.</p>
          )}
        </div>

        {/* Jobs Over Time */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-lg font-medium mb-4">Jobs Over Time (14 days)</h2>
          {overTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={overTime}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fafafa' }} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-secondary text-center py-8">No data yet.</p>
          )}
        </div>

        {/* Top Companies */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h2 className="text-lg font-medium mb-4">Top Hiring Companies</h2>
          {companies.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={companies} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                <YAxis dataKey="company" type="category" width={120} tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fafafa' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-secondary text-center py-8">No data yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
