import React from 'react';

export function H1({ children, className = '', ...props }) {
  return (
    <h1 className={`text-3xl font-extrabold tracking-tight text-white ${className}`.trim()} {...props}>
      {children}
    </h1>
  );
}

export function H2({ children, className = '', ...props }) {
  return (
    <h2 className={`text-2xl font-bold tracking-tight text-white ${className}`.trim()} {...props}>
      {children}
    </h2>
  );
}

export function H3({ children, className = '', ...props }) {
  return (
    <h3 className={`text-lg font-bold text-white ${className}`.trim()} {...props}>
      {children}
    </h3>
  );
}

export function H4({ children, className = '', ...props }) {
  return (
    <h4 className={`text-base font-semibold text-white ${className}`.trim()} {...props}>
      {children}
    </h4>
  );
}

export function Paragraph({ children, className = '', ...props }) {
  return (
    <p className={`text-sm text-gray-300 leading-relaxed ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export function Lead({ children, className = '', ...props }) {
  return (
    <p className={`text-base text-gray-400 leading-relaxed ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export function Muted({ children, className = '', ...props }) {
  return (
    <span className={`text-xs text-gray-500 ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

export function InlineCode({ children, className = '', ...props }) {
  return (
    <code className={`px-1.5 py-0.5 font-mono text-xs text-blue-400 bg-gray-900 border border-gray-800 rounded ${className}`.trim()} {...props}>
      {children}
    </code>
  );
}
