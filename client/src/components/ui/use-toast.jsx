import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ title, description, variant = 'info', duration = 4000 }) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, variant }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4">
        {toasts.map((t) => {
          let IconComponent = Info;
          let variantStyle = 'bg-gray-900 border-gray-700 text-white';
          if (t.variant === 'success') {
            IconComponent = CheckCircle;
            variantStyle = 'bg-emerald-950/90 border-emerald-800 text-emerald-100';
          } else if (t.variant === 'danger' || t.variant === 'destructive') {
            IconComponent = AlertCircle;
            variantStyle = 'bg-red-950/90 border-red-800 text-red-100';
          } else if (t.variant === 'warning') {
            IconComponent = AlertTriangle;
            variantStyle = 'bg-amber-950/90 border-amber-800 text-amber-100';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200 ${variantStyle}`}
            >
              <IconComponent className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                {t.title && <div className="text-sm font-bold">{t.title}</div>}
                {t.description && <div className="text-xs opacity-80 mt-0.5">{t.description}</div>}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="opacity-60 hover:opacity-100 transition-opacity p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast: (msg) => console.log('Toast:', msg),
      removeToast: () => {},
    };
  }
  return context;
}
