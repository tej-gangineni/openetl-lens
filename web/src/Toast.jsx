import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import "./dialogs.css";

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

const MAX = 4;
const duration = (kind) => (kind === "error" ? 7000 : 4000);

const ICONS = {
  success: <path d="M5 10.5l3.2 3.2L15 6.8" />,
  error: <path d="M6.5 6.5l7 7M13.5 6.5l-7 7" />,
  info: <path d="M10 9v5M10 6.2v.1" />,
};

function ToastItem({ toast, onDismiss }) {
  const { id, message, kind } = toast;
  const [hover, setHover] = useState(false), [focus, setFocus] = useState(false);
  const paused = hover || focus;
  const left = useRef(duration(kind)), started = useRef(0);
  useEffect(() => {
    if (paused) return undefined;
    started.current = performance.now();
    const t = setTimeout(() => onDismiss(id), left.current);
    return () => { clearTimeout(t); left.current = Math.max(0, left.current - (performance.now() - started.current)); };
  }, [paused, id, onDismiss]);
  return (
    <div className={`toast toast-${kind}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}>
      <svg className="toast-icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8.2" strokeWidth="1.4" />{ICONS[kind]}
      </svg>
      <p className="toast-msg">{message}</p>
      <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => onDismiss(id)}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const next = useRef(0);
  const dismiss = useCallback((id) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const toast = useMemo(() => (message, kind = "info") => {
    const k = kind === "success" || kind === "error" ? kind : "info";
    setItems((l) => [...l, { id: ++next.current, message: String(message), kind: k }].slice(-MAX));
  }, []);
  const calm = items.filter((t) => t.kind !== "error"), urgent = items.filter((t) => t.kind === "error");
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts">
        {/* Both live regions stay mounted so screen readers announce what is added to them. */}
        <div className="toast-region" role="status" aria-live="polite">{calm.map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}</div>
        <div className="toast-region" role="status" aria-live="assertive">{urgent.map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}</div>
      </div>
    </ToastContext.Provider>
  );
}
