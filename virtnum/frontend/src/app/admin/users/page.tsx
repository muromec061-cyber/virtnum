'use client';
import { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api';
import { User } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Search, RefreshCw, UserX, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ search, limit: 50 });
      setUsers(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const handleToggle = async (userId: string) => {
    setToggling(userId);
    try {
      const res = await usersApi.toggleUser(userId);
      toast.success(`User ${res.data.isActive ? 'activated' : 'deactivated'}`);
      load();
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Users</h2>
          <p className="text-sm text-slate-500">{users.length} users</p>
        </div>
        <Button variant="secondary" size="sm" onClick={load}>
          <RefreshCw size={14} />
        </Button>
      </div>

      <Input
        placeholder="Search by email or username..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        leftIcon={<Search size={15} />}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700/50">
                  {['Username', 'Email', 'Role', 'Balance', 'Joined', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-surface-700/20">
                        {[...Array(7)].map((__, j) => (
                          <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  : users.map((u) => (
                      <tr key={u.id} className="border-b border-surface-700/20 hover:bg-surface-700/20">
                        <td className="px-5 py-4 font-medium text-slate-200">{u.username}</td>
                        <td className="px-5 py-4 text-slate-400">{u.email}</td>
                        <td className="px-5 py-4">
                          <Badge variant={u.role === 'ADMIN' ? 'purple' : 'default'}>{u.role}</Badge>
                        </td>
                        <td className="px-5 py-4 text-emerald-400 font-medium">${u.balance.toFixed(2)}</td>
                        <td className="px-5 py-4 text-slate-500">
                          {format(new Date(u.createdAt), 'MMM d, yyyy')}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={(u as any).isActive ? 'success' : 'danger'} dot>
                            {(u as any).isActive ? 'Active' : 'Banned'}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Button
                            variant={(u as any).isActive ? 'danger' : 'success'}
                            size="sm"
                            loading={toggling === u.id}
                            onClick={() => handleToggle(u.id)}
                          >
                            {(u as any).isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                          </Button>
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
