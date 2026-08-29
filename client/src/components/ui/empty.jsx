import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './button';

export function Empty({
  title = 'No Data Available',
  description = 'There are no records matching your current filter criteria.',
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-gray-800 rounded-xl bg-[#12161B]/50 ${className}`.trim()}>
      <Icon className="w-10 h-10 text-gray-500 mb-3" />
      <h3 className="text-base font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-400 max-w-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button variant="default" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
