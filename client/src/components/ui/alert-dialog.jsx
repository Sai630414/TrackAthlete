import React from 'react';
import { Button } from './button';

export function AlertDialog({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-xl border border-gray-800 bg-[#12161B] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  );
}

export function AlertDialogContent({ children }) {
  return <div className="space-y-4">{children}</div>;
}

export function AlertDialogHeader({ children }) {
  return <div className="space-y-1">{children}</div>;
}

export function AlertDialogTitle({ children }) {
  return <h3 className="text-xl font-bold text-white">{children}</h3>;
}

export function AlertDialogDescription({ children }) {
  return <p className="text-sm text-gray-400">{children}</p>;
}

export function AlertDialogFooter({ children }) {
  return <div className="mt-6 flex justify-end gap-3">{children}</div>;
}

export function AlertDialogAction({ children, onClick, variant = 'destructive' }) {
  return <Button variant={variant} onClick={onClick}>{children}</Button>;
}

export function AlertDialogCancel({ children, onClick }) {
  return <Button variant="outline" onClick={onClick}>{children}</Button>;
}
