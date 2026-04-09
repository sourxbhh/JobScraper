import { useEffect, useState } from 'react';
import { Briefcase, TrendingUp, Star, CheckCircle, DollarSign } from 'lucide-react';
import api from '@/lib/api';
import type { OverviewStats } from '@/types';
import { formatSalary } from '@/lib/utils';

export default function StatsCards() {
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    api.get('/analytics/overview').then(r => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-lg p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Jobs', value: stats.total_jobs, icon: Briefcase, color: 'text-accent' },
    { label: 'New Today', value: stats.new_today, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Bookmarked', value: stats.bookmarked, icon: Star, color: 'text-yellow-400' },
    { label: 'Applied', value: stats.applied, icon: CheckCircle, color: 'text-purple-400' },
    {
      label: 'Avg Salary',
      value: formatSalary(stats.avg_min_salary, stats.avg_max_salary),
      icon: DollarSign,
      color: 'text-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary uppercase tracking-wider">{label}</span>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <span className="text-2xl font-semibold text-text-primary">{value}</span>
        </div>
      ))}
    </div>
  );
}
