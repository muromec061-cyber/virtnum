'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Topbar } from '@/components/dashboard/Topbar';
import { usePathname } from 'next/navigation';
import { wsClient } from '@/lib/websocket';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/numbers': 'Numbers',
  '/dashboard/telegram': 'Telegram Numbers',
  '/dashboard/orders': 'My Orders',
  '/dashboard/sms': 'SMS',
  '/dashboard/favorites': 'Favorites',
  '/dashboard/notifications': 'Notifications',
  '/dashboard/profile': 'Profile',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { accessToken, fetchMe } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!accessToken) {
      router.replace('/auth/login');
      return;
    }
    fetchMe();
    wsClient.connect(accessToken);
  }, [accessToken]);

  if (!accessToken) return null;

  const title = pageTitles[pathname] || 'Dashboard';

  return (
    <div className="flex min-h-screen bg-surface-950">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={title}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          showMenu={sidebarOpen}
        />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
