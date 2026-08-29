import React from 'react';

export function Label({ children, htmlFor, required = false, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={`block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 ${className}`.trim()}>
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}
