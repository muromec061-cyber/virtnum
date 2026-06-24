'use client';
import { useEffect, useState } from 'react';
import { numbersApi, smsApi } from '@/lib/api';
import { VirtualNumber } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import { Zap } from 'lucide-react';

export default function AdminSmsPage() {
  const [numbers, setNumbers] = useState<VirtualNumber[]>([]);
  const [showSimulate, setShowSimulate] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [form, setForm] = useState({ numberId: '', sender: 'Telegram', text: '' });

  useEffect(() => {
    numbersApi.list({ status: 'BUSY', limit: 100 }).then((r) => {
      setNumbers(r.data.data);
    });
  }, []);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numberId || !form.text) { toast.error('Fill required fields'); return; }
    setSimulating(true);
    try {
      await smsApi.simulate(form);
      toast.success('SMS simulated and sent via WebSocket');
      setShowSimulate(false);
      setForm({ numberId: '', sender: 'Telegram', text: '' });
    } finally {
      setSimulating(false);
    }
  };

  const quickCodes = [
    'Your Telegram code is 12345',
    'Your verification code: 98765',
    'Telegram login code: 55432',
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">SMS Simulator</h2>
          <p className="text-sm text-slate-500">Simulate incoming SMS for testing</p>
        </div>
        <Button size="sm" onClick={() => setShowSimulate(true)}>
          <Zap size={14} /> Simulate SMS
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-100">Active Numbers ({numbers.length})</h3>
        </CardHeader>
        <CardContent className="pt-4">
          {numbers.length === 0 ? (
            <p className="text-slate-500 text-sm">No numbers with active orders currently</p>
          ) : (
            <div className="space-y-2">
              {numbers.map((n) => (
                <div key={n.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-700/30">
                  <div className="flex items-center gap-3">
                    <span>{n.country.flag}</span>
                    <span className="font-mono text-slate-200">{n.number}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setForm({ ...form, numberId: n.id });
                      setShowSimulate(true);
                    }}
                  >
                    Send SMS
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={showSimulate} onClose={() => setShowSimulate(false)} title="Simulate Incoming SMS">
        <form onSubmit={handleSimulate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Target Number</label>
            <select
              value={form.numberId}
              onChange={(e) => setForm({ ...form, numberId: e.target.value })}
              className="w-full px-4 py-2.5 text-sm bg-surface-900/60 border border-surface-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="">Select number</option>
              {numbers.map((n) => (
                <option key={n.id} value={n.id}>{n.number}</option>
              ))}
            </select>
          </div>
          <Input
            label="Sender"
            value={form.sender}
            onChange={(e) => setForm({ ...form, sender: e.target.value })}
            placeholder="Telegram"
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">SMS Text</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              rows={3}
              placeholder="Your Telegram code is 12345"
              className="w-full px-4 py-2.5 text-sm bg-surface-900/60 border border-surface-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {quickCodes.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, text: c })}
                className="text-xs px-2.5 py-1 rounded-lg bg-surface-700/40 text-slate-400 hover:text-slate-200 border border-surface-600/30 transition-colors"
              >
                {c.slice(0, 30)}…
              </button>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowSimulate(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={simulating}>
              <Zap size={14} /> Send
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
