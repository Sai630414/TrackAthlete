import React from 'react';

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full min-h-[100px] rounded-lg border border-gray-800 bg-[#0E1217] p-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors resize-y ${className}`.trim()}
      {...props}
    />
  );
}
