import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Settings, BarChart3,
  Star, CheckCircle, ChevronLeft, ChevronRight, Crosshair,
  FileText, MessagesSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/resumes', icon: FileText, label: 'Resumes' },
  { to: '/interview', icon: MessagesSquare, label: 'Interview Prep' },
  { to: '/scrapes', icon: Settings, label: 'Scrape Tasks' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
];

const filterItems = [
  { to: '/jobs?is_bookmarked=true', icon: Star, label: 'Bookmarked' },
  { to: '/jobs?status=applied', icon: CheckCircle, label: 'Applied' },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: Props) {
  return (
    <aside
      className={cn(
        'h-screen bg-surface border-r border-border flex flex-col shrink-0 sticky top-0 transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      <div className={cn(
        "flex items-center gap-2 py-5 border-b border-border min-h-[65px]",
        collapsed ? "px-3 justify-center" : "px-4"
      )}>
        <Crosshair className="w-6 h-6 text-accent shrink-0" />
        {!collapsed && <span className="font-semibold text-lg text-text-primary whitespace-nowrap">JobHunt Pro</span>}
      </div>

      <nav className="flex-1 py-2 flex flex-col gap-0.5 overflow-hidden">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 py-2.5 text-sm transition-colors whitespace-nowrap',
                collapsed ? 'px-3 justify-center' : 'px-4',
                isActive
                  ? 'text-text-primary bg-white/5'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        <div className="mx-3 my-2 border-t border-border" />

        {filterItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={cn(
              "flex items-center gap-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors whitespace-nowrap",
              collapsed ? "px-3 justify-center" : "px-4"
            )}
            title={collapsed ? label : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={onToggle}
        className="flex items-center justify-center py-4 border-t border-border text-text-secondary hover:text-text-primary transition-colors"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
