'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Phone, ShoppingCart, MessageSquare,
  User, Settings, LogOut, Shield, Zap, Star, Bell
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/numbers', icon: Phone, label: 'Numbers' },
  { href: '/dashboard/telegram', icon: Zap, label: 'Telegram', accent: true },
  { href: '/dashboard/orders', icon: ShoppingCart, label: 'My Orders' },
  { href: '/dashboard/sms', icon: MessageSquare, label: 'SMS' },
  { href: '/dashboard/favorites', icon: Star, label: 'Favorites' },
  { href: '/dashboard/notifications', icon: Bell, label: 'Notifications' },
  { href: '/dashboard/profile', icon: User, label: 'Profile' },
];

const adminItems = [
  { href: '/admin', icon: Shield, label: 'Admin Panel' },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <aside className="w-64 min-h-screen bg-surface-900/80 backdrop-blur-xl border-r border-surface-700/40 flex flex-col">
      <div className="p-6 border-b border-surface-700/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow">
            <Phone size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100">VirtNum</h1>
            <p className="text-xs text-slate-500">Virtual Numbers</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label, accent }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-800',
                accent && !active && 'text-amber-400 hover:text-amber-300'
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}

        {user?.role === 'ADMIN' && (
          <div className="pt-3 mt-3 border-t border-surface-700/50">
            {adminItems.map(({ href, icon: Icon, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-amber-300 hover:bg-amber-500/10'
                  )}
                >
                  <Icon size={17} />
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-surface-700/40">
        {user && (
          <div className="mb-3 px-3.5 py-3 rounded-xl bg-surface-800/60">
            <p className="text-sm font-medium text-slate-200">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs font-semibold text-emerald-400">
                ${user.balance.toFixed(2)}
              </span>
              <span className="text-xs text-slate-600">balance</span>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
