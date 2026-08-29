import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckIcon, XIcon, InfoIcon } from '@/lib/icons';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; msg: string };

type ToastCtx = { toast: (msg: string, kind?: ToastKind) => void };
const Ctx = createContext<ToastCtx>({ toast: () => {} });

export const useToast = () => useContext(Ctx);

const ICONS: Record<ToastKind, ReactNode> = {
  success: <CheckIcon size={12} />,
  error: <XIcon size={12} />,
  info: <InfoIcon size={12} />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((msg: string, kind: ToastKind = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, kind, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-icon">{ICONS[t.kind]}</span>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}