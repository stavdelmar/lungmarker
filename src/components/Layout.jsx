import { NavLink, Outlet } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useMe } from '@/hooks/useMe';
import { LogOut, Settings } from 'lucide-react';

const links = [
  { to: '/', label: 'Worklist' },
  { to: '/results', label: 'Dashboard' },
];

export default function Layout() {
  const { user, isAdmin, isReviewer, initials } = useMe();
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <div className="sticky top-0 z-50 h-6 flex items-center justify-center bg-amber-50 border-b border-amber-200 text-[11px] tracking-wide text-amber-900">
        For research use only. Not for clinical use.
      </div>
      <header className="h-12 flex items-center gap-8 px-6 bg-white border-b border-slate-200">
        <div className="font-semibold tracking-tight text-[15px]">Lung<span className="text-teal-700">Marker</span></div>
        <nav className="flex gap-1 text-sm">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              className={({ isActive }) => `px-3 py-1.5 rounded-md transition-colors ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          {user && <span className="px-2 py-0.5 rounded bg-slate-100 font-mono">{initials} · {isReviewer ? 'reviewer' : 'viewer'}</span>}
          {isAdmin && (
            <NavLink to="/settings" title="Settings" aria-label="Settings"
              className={({ isActive }) => `w-7 h-7 grid place-items-center rounded-md ${isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}>
              <Settings className="w-4 h-4" />
            </NavLink>
          )}
          <button onClick={() => base44.auth.logout()} className="hover:text-slate-900" title="Log out"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>
      <main className="flex-1 flex flex-col min-h-0"><Outlet /></main>
    </div>
  );
}