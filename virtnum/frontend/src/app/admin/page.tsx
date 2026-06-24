'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { AdminStats } from '@/types';
import { StatsCard } from '@/components/ui/StatsCard';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Users, Phone, ShoppingCart, DollarSign, MessageSquare, TrendingUp,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats().then((r) => {
      setStats(r.data);
      setLoading(false);
    });
  }, []);

  const chartData = stats?.revenue.daily.map((d) => ({
    date: format(new Date(d.date), 'MMM d'),
    revenue: Number(d.revenue),
  })) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Overview</h2>
        <p className="text-sm text-slate-500">Platform statistics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatsCard title="Total Users" value={stats?.users.total || 0} icon={<Users size={20} />} color="brand" loading={loading} />
        <StatsCard title="Active Users" value={stats?.users.active || 0} icon={<Users size={20} />} color="emerald" loading={loading} />
        <StatsCard title="Numbers" value={stats?.numbers.total || 0} icon={<Phone size={20} />} color="blue" loading={loading} />
        <StatsCard title="Total Orders" value={stats?.orders.total || 0} icon={<ShoppingCart size={20} />} color="amber" loading={loading} />
        <StatsCard title="Revenue" value={`$${(stats?.revenue.total || 0).toFixed(2)}`} icon={<DollarSign size={20} />} color="emerald" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-400" />
              <h3 className="font-semibold text-slate-100">Revenue (30 days)</h3>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#a5b9fc' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-100">Quick Stats</h3>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Available Numbers</span>
              <Badge variant="success">{stats?.numbers.available || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Active Orders</span>
              <Badge variant="warning">{stats?.orders.active || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">SMS Today</span>
              <Badge variant="info">{stats?.smsToday || 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-100">Recent Orders</h3>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700/50">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">User</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Number</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Country</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-surface-700/20">
                        {[...Array(4)].map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-24" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : stats?.recentOrders.map((order) => (
                      <tr key={order.id} className="border-b border-surface-700/20 hover:bg-surface-700/20">
                        <td className="px-4 py-3 text-slate-300">{order.user?.username}</td>
                        <td className="px-4 py-3 font-mono text-slate-200">{order.number.number}</td>
                        <td className="px-4 py-3">
                          <span>{order.number.country.flag} {order.number.country.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              order.status === 'ACTIVE' ? 'success'
                                : order.status === 'COMPLETED' ? 'info'
                                : order.status === 'CANCELLED' ? 'danger'
                                : 'warning'
                            }
                            dot
                          >
                            {order.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
