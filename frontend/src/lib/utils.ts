import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return '—';
  const fmt = (n: number) => {
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
    return `$${n}`;
  };
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-400/20 text-blue-400',
  reviewing: 'bg-purple-400/20 text-purple-400',
  applied: 'bg-yellow-400/20 text-yellow-400',
  interview: 'bg-orange-400/20 text-orange-400',
  offer: 'bg-green-500/20 text-green-500',
  rejected: 'bg-red-500/20 text-red-500',
};

export const SOURCE_COLORS: Record<string, string> = {
  indeed: '#2164f3',
  linkedin: '#0a66c2',
  glassdoor: '#0caa41',
  google: '#4285f4',
  zip_recruiter: '#00a43b',
};

export const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
