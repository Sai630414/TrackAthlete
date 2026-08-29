import React from 'react';

export function BarChart({ data = [], title = 'Performance Analytics' }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-xl border border-gray-800 bg-[#12161B] p-4">
      <h4 className="text-sm font-bold text-white mb-3">{title}</h4>
      <div className="flex items-end gap-3 h-36 pb-2">
        {data.map((item, idx) => {
          const heightPercent = (item.value / maxValue) * 100;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end">
              <div
                className="w-full rounded-t-md transition-all duration-500"
                style={{
                  height: `${heightPercent}%`,
                  backgroundColor: item.color || '#3B82F6',
                  minHeight: '8px',
                }}
                title={`${item.label}: ${item.value}`}
              />
              <span className="text-[10px] text-gray-400 mt-2 truncate w-full text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProgressChart({ value = 0, max = 100, label = 'Completion' }) {
  const percent = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  return (
    <div className="my-2">
      <div className="flex justify-between text-xs font-semibold text-gray-300 mb-1">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
