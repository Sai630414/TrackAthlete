import React from 'react';

export function AspectRatio({ ratio = 16 / 9, children, className = '' }) {
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: `${(1 / ratio) * 100}%` }} className={className}>
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
        {children}
      </div>
    </div>
  );
}
