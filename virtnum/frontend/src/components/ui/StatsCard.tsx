import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Card, CardContent } from './Card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: ReactNode;
  color?: 'brand' | 'emerald' | 'amber' | 'red' | 'blue';
  loading?: boolean;
}

const colorMap = {
  brand: 'bg-brand-500/15 text-brand-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-400',
  red: 'bg-red-500/15 text-red-400',
  blue: 'bg-blue-500/15 text-blue-400',
};

export const StatsCard = ({ title, value, change, icon, color = 'brand', loading }: StatsCardProps) => {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 rounded-lg bg-surface-700/40 animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
          )}
          {change !== undefined && (
            <div className={clsx('flex items-center gap-1 mt-1.5 text-xs font-medium', change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{Math.abs(change)}% vs last week</span>
            </div>
          )}
        </div>
        <div className={clsx('p-3 rounded-xl', colorMap[color])}>
          {icon}
        </div>
      </div>
    </Card>
  );
};
