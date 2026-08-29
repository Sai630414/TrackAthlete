import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function Collapsible({ children, defaultOpen = false, className = '' }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child, {
          isOpen,
          onToggle: () => setIsOpen(!isOpen),
        });
      })}
    </div>
  );
}

export function CollapsibleTrigger({ children, isOpen, onToggle, className = '' }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-gray-800 bg-gray-900 ${className}`.trim()}
      onClick={onToggle}
    >
      {children}
      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );
}

export function CollapsibleContent({ children, isOpen, className = '' }) {
  if (!isOpen) return null;
  return (
    <div className={`mt-2 p-3 rounded-lg bg-[#0E1217] border border-gray-800/80 animate-in fade-in duration-200 ${className}`.trim()}>
      {children}
    </div>
  );
}
