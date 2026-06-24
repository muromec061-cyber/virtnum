'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usersApi, ordersApi } from '@/lib/api';
import { Order, Transaction } from '@/types';
import { StatsCard } from '@/components/ui/StatsCard';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Phone, ShoppingCart, DollarSign, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ordersRes, txRes] = await Promise.all([
          ordersApi.list(),
          usersApi.transactions({ limit: 5 }),
        ]);
        setOrders(ordersRes.data.slice(0, 5));
        setTransactions(txRes.data.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeOrders = orders.filter((o) => o.status === 'ACTIVE');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">
          Hey, {user?.username} 👋
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">Here's what's happening with your account</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Balance"
          value={`$${user?.balance?.toFixed(2) || '0.00'}`}
          icon={<DollarSign size={20} />}
          color="emerald"
          loading={loading}
        />
        <StatsCard
          title="Active Orders"
          value={activeOrders.length}
          icon={<ShoppingCart size={20} />}
          color="brand"
          loading={loading}
        />
        <StatsCard
          title="Total Orders"
          value={orders.length}
          icon={<Phone size={20} />}
          color="blue"
          loading={loading}
        />
        <StatsCard
          title="Transactions"
          value={transactions.length}
          icon={<MessageSquare size={20} />}
          color="amber"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-100">Recent Orders</h3>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No orders yet</p>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-700/30">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{order.number.country.flag}</span>
                      <div>
                        <p className="text-sm font-mono font-medium text-slate-200">{order.number.number}</p>
                        <p className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-100">Recent Transactions</h3>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No transactions yet</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-700/30">
                    <div>
                      <p className="text-sm text-slate-200">{tx.description}</p>
                      <p className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}${tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
