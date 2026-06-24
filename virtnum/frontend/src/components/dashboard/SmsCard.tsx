'use client';
import { useState } from 'react';
import { MessageSquare, Copy, Check, Key } from 'lucide-react';
import { SmsMessage } from '@/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface SmsCardProps {
  message: SmsMessage;
  highlight?: boolean;
}

export const SmsCard = ({ message, highlight }: SmsCardProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied!');
  };

  return (
    <Card
      className={`p-4 transition-all duration-500 ${highlight ? 'border-brand-500/50 shadow-glow' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10">
            <MessageSquare size={14} className="text-blue-400" />
          </div>
          <span className="text-sm font-medium text-slate-300">{message.sender}</span>
        </div>
        <span className="text-xs text-slate-600">
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
        </span>
      </div>

      <p className="text-sm text-slate-300 mb-3 leading-relaxed">{message.text}</p>

      {message.code && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2">
            <Key size={14} className="text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Verification Code</span>
            <span className="text-lg font-mono font-bold text-emerald-300 tracking-widest">
              {message.code}
            </span>
          </div>
          <button
            onClick={() => handleCopy(message.code!)}
            className="p-1.5 rounded-lg text-emerald-500 hover:text-emerald-300 hover:bg-emerald-500/20 transition-all"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </Card>
  );
};
