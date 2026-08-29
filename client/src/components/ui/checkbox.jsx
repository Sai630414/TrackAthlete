import React from 'react';

export function Checkbox({ label, checked, onChange, disabled = false, className = '', id, ...props }) {
  const inputId = id || `cb-${Math.random().toString(36).substring(2, 7)}`;
  return (
    <div className={`flex items-center gap-2 cursor-pointer ${className}`.trim()}>
      <input
        type="checkbox"
        id={inputId}
        checked={checked}
        onChange={(e) => onChange && onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500 cursor-pointer"
        {...props}
      />
      {label && (
        <label htmlFor={inputId} className="cursor-pointer text-sm text-gray-300 select-none">
          {label}
        </label>
      )}
    </div>
  );
}
