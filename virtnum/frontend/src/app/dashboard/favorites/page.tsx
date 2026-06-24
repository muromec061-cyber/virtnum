'use client';
import { useEffect, useState } from 'react';
import { usersApi, numbersApi } from '@/lib/api';
import { VirtualNumber } from '@/types';
import { NumberCard } from '@/components/dashboard/NumberCard';
import { NumberCardSkeleton } from '@/components/ui/Skeleton';
import { Star } from 'lucide-react';

export default function FavoritesPage() {
  const [numbers, setNumbers] = useState<VirtualNumber[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const favRes = await usersApi.favorites();
      const ids: string[] = favRes.data.map((f: any) => f.numberId);
      const numPromises = ids.map((id) => numbersApi.get(id));
      const results = await Promise.allSettled(numPromises);
      const nums = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value.data);
      setNumbers(nums);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Favorites</h2>
        <p className="text-sm text-slate-500">Your saved numbers</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <NumberCardSkeleton key={i} />)}
        </div>
      ) : numbers.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <Star size={32} className="text-slate-600 mb-3" />
          <p className="text-slate-500">No favorites yet</p>
          <p className="text-slate-600 text-sm mt-1">Click the star icon on any number to save it</p>
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
