'use client';
import { useEffect, useState, useCallback } from 'react';
import { numbersApi, countriesApi } from '@/lib/api';
import { VirtualNumber, Country } from '@/types';
import { NumberCard } from '@/components/dashboard/NumberCard';
import { NumberCardSkeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Search, SlidersHorizontal, RefreshCw } from 'lucide-react';

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<VirtualNumber[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [telegramOnly, setTelegramOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 12 };
      if (search) params.search = search;
      if (selectedCountry) params.country = selectedCountry;
      if (telegramOnly) params.telegram = 'true';

      const res = await numbersApi.list(params);
      setNumbers(res.data.data);
      setTotalPages(res.data.pagination.pages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCountry, telegramOnly]);

  useEffect(() => {
    countriesApi.list().then((r) => setCountries(r.data));
  }, []);

  useEffect(() => {
    fetchNumbers();
  }, [fetchNumbers]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Virtual Numbers</h2>
          <p className="text-sm text-slate-500">Browse and purchase available numbers</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchNumbers}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by number..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          leftIcon={<Search size={15} />}
          className="sm:max-w-xs"
        />
        <select
          value={selectedCountry}
          onChange={(e) => { setSelectedCountry(e.target.value); setPage(1); }}
          className="px-4 py-2.5 text-sm bg-surface-900/60 border border-surface-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        >
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => { setTelegramOnly(!telegramOnly); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
            telegramOnly
              ? 'bg-brand-600/20 text-brand-300 border-brand-500/40'
              : 'bg-surface-800 text-slate-400 border-surface-700/50 hover:text-slate-200'
          }`}
        >
          <SlidersHorizontal size={14} />
          Telegram Only
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <NumberCardSkeleton key={i} />)}
        </div>
      ) : numbers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500">No numbers found matching your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {numbers.map((n) => (
            <NumberCard key={n.id} number={n} onPurchase={fetchNumbers} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-400 px-3">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
