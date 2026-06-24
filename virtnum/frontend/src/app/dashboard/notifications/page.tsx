'use client';
import { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api';
import { Notification } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Bell, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await usersApi.notifications();
      setNotifications(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await usersApi.readNotification(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Notifications</h2>
          {unread > 0 && (
            <p className="text-sm text-brand-400 mt-0.5">{unread} unread</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell size={28} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">No notifications</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={`p-4 ${!n.isRead ? 'border-brand-500/30 bg-brand-500/5' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-200">{n.title}</p>
                    {!n.isRead && <Badge variant="purple" className="text-[10px]">New</Badge>}
                  </div>
                  <p className="text-sm text-slate-400">{n.message}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!n.isRead && (
                  <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                    <Check size={14} />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
