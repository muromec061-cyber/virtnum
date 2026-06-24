'use client';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usersApi } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DollarSign, User, Shield, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const [topupAmount, setTopupAmount] = useState('');
  const [topping, setTopping] = useState(false);

  const handleTopup = async () => {
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setTopping(true);
    try {
      await usersApi.topup(amount);
      toast.success(`$${amount.toFixed(2)} added to balance`);
      setTopupAmount('');
      fetchMe();
    } finally {
      setTopping(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Profile</h2>
        <p className="text-sm text-slate-500">Your account details</p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-2xl font-bold shadow-glow">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{user.username}</h3>
            <p className="text-sm text-slate-500">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={user.role === 'ADMIN' ? 'purple' : 'success'} dot>
                {user.role}
              </Badge>
              {user.isVerified && <Badge variant="info">Verified</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <DollarSign size={20} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-100">${user.balance.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Balance</p>
        </Card>
        <Card className="p-4 text-center">
          <User size={20} className="text-brand-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-100">{user.role}</p>
          <p className="text-xs text-slate-500 mt-0.5">Account Type</p>
        </Card>
        <Card className="p-4 text-center">
          <Calendar size={20} className="text-blue-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-100">
            {format(new Date(user.createdAt), 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Member Since</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-100">Top Up Balance</h3>
          <p className="text-sm text-slate-500 mt-0.5">Add funds to your account</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex gap-2 mb-4">
            {[5, 10, 20, 50].map((v) => (
              <button
                key={v}
                onClick={() => setTopupAmount(String(v))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  topupAmount === String(v)
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/40'
                    : 'bg-surface-700/40 text-slate-400 border border-surface-700/30 hover:text-slate-200'
                }`}
              >
                ${v}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Input
              type="number"
              placeholder="Custom amount"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              leftIcon={<DollarSign size={15} />}
            />
            <Button onClick={handleTopup} loading={topping} className="shrink-0">
              Add Funds
            </Button>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            * Demo mode: balance added instantly without real payment
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
