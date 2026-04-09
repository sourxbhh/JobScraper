import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className="flex-1 min-w-0 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
