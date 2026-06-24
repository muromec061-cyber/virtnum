'use client';
import { useEffect, useState, useCallback } from 'react';
import { ordersApi } from '@/lib/api';
import { Order } from '@/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useWsEvent } from '@/hooks/useWebSocket';
import { Copy, Check, Clock, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';

const statusVariant = {
  PENDING: 'warning',
  ACTIVE: 'success',
  COMPLETED: 'info',
  CANCELLED: 'danger',
  EXPIRED: 'default',
} as const;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await ordersApi.list();
      setOrders(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useWsEvent('order_update', useCallback((data: any) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === data.order.id ? { ...o, ...data.order } : o))
    );
  }, []));

  const handleCopy = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopied(number);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Number copied!');
  };

  const handleCancel = async (orderId: string) => {
    setCancelling(orderId);
    try {
      await ordersApi.cancel(orderId);
      toast.success('Order cancelled. 50% refund applied.');
      load();
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">My Orders</h2>
          <p className="text-sm text-slate-500">{orders.length} total orders</p>
        </div>
        <Button variant="secondary" size="sm" onClick={load}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-slate-500 mb-3">No orders yet</p>
          <Link href="/dashboard/numbers">
            <Button size="sm">Browse Numbers</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">{order.number.country.flag}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-100 text-lg">
                        {order.number.number}
                      </span>
                      <button
                        onClick={() => handleCopy(order.number.number)}
                        className="p-1 rounded-md text-slate-500 hover:text-brand-400 transition-colors"
                      >
                        {copied === order.number.number
                          ? <Check size={14} className="text-emerald-400" />
                          : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{order.number.country.name}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                      </span>
                      {order.status === 'ACTIVE' && (
                        <>
                          <span>·</span>
                          <span className="text-amber-400">
                            Expires {formatDistanceToNow(new Date(order.expiresAt), { addSuffix: true })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant[order.status]} dot>
                    {order.status}
                  </Badge>
                  {['PENDING', 'ACTIVE'].includes(order.status) && (
                    <Button
                      variant="danger"
                      size="sm"
                      loading={cancelling === order.id}
                      onClick={() => handleCancel(order.id)}
                    >
                      Cancel
                    </Button>
                  )}
                  <Link href={`/dashboard/sms?order=${order.id}`}>
                    <Button variant="secondary" size="sm">
                      View SMS
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
