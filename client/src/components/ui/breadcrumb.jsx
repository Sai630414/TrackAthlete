import React from 'react';
import { ChevronRight } from 'lucide-react';

export function Breadcrumb({ children, className = '' }) {
  const childrenArray = React.Children.toArray(children);
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-2 text-xs text-gray-400 mb-4 ${className}`.trim()}>
      {childrenArray.map((child, idx) => (
        <React.Fragment key={idx}>
          {child}
          {idx < childrenArray.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function BreadcrumbItem({ children, isCurrent = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${isCurrent ? 'text-white font-semibold' : ''} ${className}`.trim()}>
      {children}
    </span>
  );
}

export function BreadcrumbLink({ href, onClick, children, className = '' }) {
  return (
    <a
      href={href || '#'}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick(e);
        }
      }}
      className={`hover:text-white transition-colors ${className}`.trim()}
    >
      {children}
    </a>
  );
}
