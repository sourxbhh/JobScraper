import { cn, STATUS_COLORS } from '@/lib/utils';

interface Props {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
        STATUS_COLORS[status] || 'bg-zinc-700/50 text-zinc-400',
        className
      )}
    >
      {status}
    </span>
  );
}
