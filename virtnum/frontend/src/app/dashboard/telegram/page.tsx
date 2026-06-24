'use client';
import { useEffect, useState } from 'react';
import { numbersApi } from '@/lib/api';
import { VirtualNumber } from '@/types';
import { NumberCard } from '@/components/dashboard/NumberCard';
import { NumberCardSkeleton } from '@/components/ui/Skeleton';
import { Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function TelegramPage() {
  const [numbers, setNumbers] = useState<VirtualNumber[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await numbersApi.telegram();
      setNumbers(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-500/15 border border-brand-500/30">
            <Zap size={20} className="text-brand-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Telegram Numbers</h2>
            <p className="text-sm text-slate-500">Numbers verified for Telegram registration</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={load}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      <div className="p-4 rounded-2xl bg-brand-500/5 border border-brand-500/20">
        <p className="text-sm text-brand-300">
          <span className="font-semibold">How it works:</span> Select a number, copy it, enter it in Telegram,
          wait for the SMS code, copy it from your orders page and paste into Telegram.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <NumberCardSkeleton key={i} />)}
        </div>
      ) : numbers.length === 0 ? (
        <div className="text-center py-16">
          <Zap size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">No Telegram numbers available right now</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {numbers.map((n) => (
            <NumberCard key={n.id} number={n} onPurchase={load} />
          ))}
        </div>
      )}
    </div>
  );
}
