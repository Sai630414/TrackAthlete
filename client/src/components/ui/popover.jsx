import React, { useState, useRef, useEffect } from 'react';

export function Popover({ children, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={popoverRef} className={`relative inline-block ${className}`.trim()}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child, {
          isOpen,
          onToggle: () => setIsOpen(!isOpen),
          onClose: () => setIsOpen(false),
        });
      })}
    </div>
  );
}

export function PopoverTrigger({ children, onToggle }) {
  return (
    <div onClick={onToggle} className="cursor-pointer">
      {children}
    </div>
  );
}

export function PopoverContent({ children, isOpen, className = '' }) {
  if (!isOpen) return null;
  return (
    <div className={`absolute top-full left-0 mt-2 z-50 min-w-[220px] rounded-xl border border-gray-800 bg-[#12161B] p-4 shadow-xl animate-in fade-in duration-150 ${className}`.trim()}>
      {children}
    </div>
  );
}
