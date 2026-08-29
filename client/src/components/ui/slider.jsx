import React from 'react';

export function Slider({ value, min = 0, max = 100, step = 1, onChange, label, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      {label && (
        <div className="flex justify-between text-xs font-semibold text-gray-400">
          <span>{label}</span>
          <span>{value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}
