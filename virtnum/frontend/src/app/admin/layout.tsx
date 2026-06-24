'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Topbar } from '@/components/dashboard/Topbar';
import { useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, accessToken, fetchMe } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!accessToken) { router.replace('/auth/login'); return; }
    fetchMe();
  }, [accessToken]);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [user]);

  if (!user || user.role !== 'ADMIN') return null;

  return (
    <div className="flex min-h-screen bg-surface-950">
      <div className="hidden lg:flex"><Sidebar /></div>
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10"><Sidebar /></div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Admin Panel" onMenuToggle={() => setSidebarOpen(!sidebarOpen)} showMenu={sidebarOpen} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
