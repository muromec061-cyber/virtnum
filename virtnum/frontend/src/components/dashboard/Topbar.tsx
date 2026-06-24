'use client';
import { useState } from 'react';
import { Bell, Menu, X, Search } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Badge } from '../ui/Badge';

interface TopbarProps {
  title: string;
  onMenuToggle: () => void;
  showMenu: boolean;
}

export const Topbar = ({ title, onMenuToggle, showMenu }: TopbarProps) => {
  const user = useAuthStore((s) => s.user);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="h-16 bg-surface-900/60 backdrop-blur-xl border-b border-surface-700/40 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-surface-800 transition-colors"
        >
          {showMenu ? <X size={20} /> : <Menu size={20} />}
        </button>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-800/60 border border-surface-700/40">
          <Search size={15} className="text-slate-500" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none w-40"
          />
        </div>

        <button className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-surface-800 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-surface-700/40">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold">
            {user?.username?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-slate-200">{user?.username}</p>
            <div className="flex items-center gap-1">
              <Badge variant={user?.role === 'ADMIN' ? 'purple' : 'success'} className="text-[10px] px-1.5 py-0">
                {user?.role}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
