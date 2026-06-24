'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { smsApi, ordersApi } from '@/lib/api';
import { SmsMessage, Order } from '@/types';
import { SmsCard } from '@/components/dashboard/SmsCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useWsEvent } from '@/hooks/useWebSocket';
import { MessageSquare, RefreshCw, Loader2 } from 'lucide-react';

export default function SmsPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string>(orderId || '');
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ordersApi.list().then((r) => {
      const active = r.data.filter((o: Order) => ['ACTIVE', 'COMPLETED'].includes(o.status));
      setOrders(active);
      if (!selectedOrder && active.length > 0) {
        setSelectedOrder(active[0].id);
      }
    });
  }, []);

  const loadMessages = useCallback(async (quiet = false) => {
    if (!selectedOrder) { setLoading(false); return; }
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await smsApi.byOrder(selectedOrder);
      setMessages(res.data);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedOrder]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useWsEvent('sms_received', useCallback((data: any) => {
    setMessages((prev) => {
      if (prev.find((m) => m.id === data.sms.id)) return prev;
      setNewIds((ids) => new Set([...ids, data.sms.id]));
      setTimeout(() => {
        setNewIds((ids) => { const n = new Set(ids); n.delete(data.sms.id); return n; });
      }, 5000);
      return [data.sms, ...prev];
    });
  }, []));

  useEffect(() => {
    const interval = setInterval(() => loadMessages(true), 15000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const currentOrder = orders.find((o) => o.id === selectedOrder);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">SMS Messages</h2>
          <p className="text-sm text-slate-500">Auto-updates every 15 seconds</p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && <Loader2 size={16} className="animate-spin text-slate-500" />}
          <Button variant="secondary" size="sm" onClick={() => loadMessages(true)}>
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => setSelectedOrder(order.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedOrder === order.id
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-500/40'
                  : 'bg-surface-800 text-slate-400 border border-surface-700/50 hover:text-slate-200'
              }`}
            >
              <span>{order.number.country.flag}</span>
              <span className="font-mono">{order.number.number}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-2xl bg-surface-800/60 mb-4">
            <MessageSquare size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">No messages yet</p>
          <p className="text-slate-600 text-sm mt-1">
            {currentOrder
              ? `Waiting for SMS on ${currentOrder.number.number}`
              : 'Select an active order to watch for SMS'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <SmsCard key={msg.id} message={msg} highlight={newIds.has(msg.id)} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
