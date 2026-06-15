import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Cpu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useLlmStatus } from '@/hooks/useCareer';
import { cn } from '@/lib/utils';

function LlmIndicator() {
  const { status } = useLlmStatus();
  const ok = status?.reachable && status?.model_present;
  const label = !status ? 'LLM: checking…'
    : !status.reachable ? 'LLM: offline'
    : !status.model_present ? `LLM: pull ${status.model}`
    : `LLM: ${status.model}`;
  return (
    <div
      className="flex items-center gap-1.5 text-xs text-text-secondary border border-border rounded-full px-2.5 py-1"
      title={status?.error || status?.host}
    >
      <Cpu className="w-3 h-3" />
      <span className={cn('w-1.5 h-1.5 rounded-full', ok ? 'bg-green-500' : 'bg-yellow-500')} />
      {label}
    </div>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className="flex-1 min-w-0 p-6 overflow-auto">
        <div className="flex justify-end mb-4">
          <LlmIndicator />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
