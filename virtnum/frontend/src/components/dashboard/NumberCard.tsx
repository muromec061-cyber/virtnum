'use client';
import { useState } from 'react';
import { Copy, Check, Star, Zap, Clock } from 'lucide-react';
import { VirtualNumber } from '@/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ordersApi, usersApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface NumberCardProps {
  number: VirtualNumber;
  onPurchase?: () => void;
  showTimer?: boolean;
}

const statusVariant = {
  AVAILABLE: 'success',
  BUSY: 'warning',
  EXPIRED: 'danger',
  BLOCKED: 'danger',
} as const;

export const NumberCard = ({ number, onPurchase, showTimer }: NumberCardProps) => {
  const [copied, setCopied] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [favorited, setFavorited] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(number.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Number copied!');
  };

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      await ordersApi.create(number.id);
      toast.success('Number purchased! Check your orders.');
      onPurchase?.();
    } catch {
    } finally {
      setPurchasing(false);
    }
  };

  const handleFavorite = async () => {
    try {
      await usersApi.toggleFavorite(number.id);
      setFavorited(!favorited);
      toast.success(favorited ? 'Removed from favorites' : 'Added to favorites');
    } catch {}
  };

  return (
    <Card hover className="p-5 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{number.country.flag}</span>
          <div>
            <p className="text-xs text-slate-500">{number.country.dialCode}</p>
            <p className="text-xs font-medium text-slate-400">{number.country.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {number.isTelegram && (
            <Badge variant="purple" dot>
              <Zap size={10} /> TG
            </Badge>
          )}
          <Badge variant={statusVariant[number.status]} dot>
            {number.status}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <p className="text-lg font-mono font-semibold text-slate-100 tracking-wide">
          {number.number}
        </p>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg text-slate-600 hover:text-brand-400 hover:bg-brand-500/10 transition-all opacity-0 group-hover:opacity-100"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
      </div>

      {showTimer && number.expiresAt && (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-amber-400">
          <Clock size={12} />
          <span>Expires {formatDistanceToNow(new Date(number.expiresAt), { addSuffix: true })}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-bold text-slate-100">${number.price.toFixed(2)}</span>
          <span className="text-xs text-slate-500 ml-1">/20min</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFavorite}
            className="p-1.5 rounded-lg text-slate-600 hover:text-amber-400 transition-colors"
          >
            <Star size={15} className={favorited ? 'fill-amber-400 text-amber-400' : ''} />
          </button>
          {number.status === 'AVAILABLE' && (
            <Button size="sm" onClick={handlePurchase} loading={purchasing}>
              Buy
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
