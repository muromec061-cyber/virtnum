'use client';
import { useEffect, useState } from 'react';
import { numbersApi, countriesApi } from '@/lib/api';
import { VirtualNumber, Country } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Plus, Trash2, Edit, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminNumbersPage() {
  const [numbers, setNumbers] = useState<VirtualNumber[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ number: '', countryId: '', price: '', isTelegram: false });

  const load = async () => {
    setLoading(true);
    try {
      const [numRes, ctryRes] = await Promise.all([
        numbersApi.list({ limit: 100 }),
        countriesApi.list(),
      ]);
      setNumbers(numRes.data.data);
      setCountries(ctryRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.number || !form.countryId || !form.price) {
      toast.error('Fill all fields');
      return;
    }
    setCreating(true);
    try {
      await numbersApi.create({
        number: form.number,
        countryId: form.countryId,
        price: parseFloat(form.price),
        isTelegram: form.isTelegram,
      });
      toast.success('Number created');
      setShowCreate(false);
      setForm({ number: '', countryId: '', price: '', isTelegram: false });
      load();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this number?')) return;
    setDeleting(id);
    try {
      await numbersApi.delete(id);
      toast.success('Number deleted');
      load();
    } finally {
      setDeleting(null);
    }
  };

  const handleStatusToggle = async (n: VirtualNumber) => {
    const newStatus = n.status === 'AVAILABLE' ? 'BLOCKED' : 'AVAILABLE';
    await numbersApi.update(n.id, { status: newStatus });
    toast.success(`Number ${newStatus.toLowerCase()}`);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Manage Numbers</h2>
          <p className="text-sm text-slate-500">{numbers.length} numbers total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw size={14} />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Add Number
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700/50">
                  {['Number', 'Country', 'Price', 'Status', 'Telegram', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-surface-700/20">
                        {[...Array(6)].map((__, j) => (
                          <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  : numbers.map((n) => (
                      <tr key={n.id} className="border-b border-surface-700/20 hover:bg-surface-700/20 transition-colors">
                        <td className="px-5 py-4 font-mono text-slate-200">{n.number}</td>
                        <td className="px-5 py-4 text-slate-300">
                          {n.country.flag} {n.country.name}
                        </td>
                        <td className="px-5 py-4 text-emerald-400 font-medium">${n.price.toFixed(2)}</td>
                        <td className="px-5 py-4">
                          <button onClick={() => handleStatusToggle(n)}>
                            <Badge
                              variant={n.status === 'AVAILABLE' ? 'success' : n.status === 'BUSY' ? 'warning' : 'danger'}
                              dot
                            >
                              {n.status}
                            </Badge>
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          {n.isTelegram ? <Badge variant="purple">Yes</Badge> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          <Button
                            variant="danger"
                            size="sm"
                            loading={deleting === n.id}
                            onClick={() => handleDelete(n.id)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Virtual Number">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Phone Number"
            placeholder="+79161234567"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Country</label>
            <select
              value={form.countryId}
              onChange={(e) => setForm({ ...form, countryId: e.target.value })}
              className="w-full px-4 py-2.5 text-sm bg-surface-900/60 border border-surface-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="">Select country</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Price ($)"
            type="number"
            step="0.01"
            placeholder="0.50"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isTelegram}
              onChange={(e) => setForm({ ...form, isTelegram: e.target.checked })}
              className="w-4 h-4 accent-brand-500"
            />
            <span className="text-sm text-slate-300">Telegram-verified number</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={creating}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
