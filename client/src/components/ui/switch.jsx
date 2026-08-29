import React from 'react';

export function Switch({ checked, onChange, label, className = '' }) {
  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer ${className}`.trim()}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-800'}`} />
        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </div>
      {label && <span className="text-sm font-medium text-gray-300 select-none">{label}</span>}
    </label>
  );
}
