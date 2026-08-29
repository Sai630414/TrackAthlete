import React from 'react';

export function Input({ className = '', type = 'text', ...props }) {
  return (
    <input
      type={type}
      className={`w-full rounded-lg border border-[#d2dad2] bg-[#fffefa] px-3 py-2 text-sm text-[#1d2c31] placeholder-[#80908e] focus:border-[#4a8a70] focus:ring-2 focus:ring-[#64a27b1c] outline-none transition-all ${className}`.trim()}
      {...props}
    />
  );
}

export function InputGroup({ children, className = '' }) {
  return <div className={`relative flex w-full items-center ${className}`.trim()}>{children}</div>;
}
