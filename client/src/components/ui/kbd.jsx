import React from 'react';

export function Kbd({ children, className = '' }) {
  return (
    <kbd className={`inline-flex items-center px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-300 bg-gray-900 border border-gray-700 rounded shadow-sm ${className}`.trim()}>
      {children}
    </kbd>
  );
}
