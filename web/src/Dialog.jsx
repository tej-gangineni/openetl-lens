import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./dialogs.css";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Body scroll lock, counted so stacked dialogs release it only once.
let locks = 0, savedOverflow = "", savedPad = "";
function lockScroll() {
  if (locks++ > 0) return;
  const b = document.body, gap = window.innerWidth - document.documentElement.clientWidth;
  savedOverflow = b.style.overflow; savedPad = b.style.paddingRight;
  b.style.overflow = "hidden";
  if (gap > 0) b.style.paddingRight = `${gap}px`;
}
function unlockScroll() {
  if (--locks > 0) return;
  document.body.style.overflow = savedOverflow; document.body.style.paddingRight = savedPad;
}

// A small modal. Mount it to open it, unmount it to close it (the opener gets focus back on unmount).
// `type` (a connection type id) gives the dialog that connection's accent; leave it out for a neutral dialog.
export default function Dialog({ onClose, labelledBy, describedBy, type, children }) {
  const panel = useRef(null);
  const [opener] = useState(() => document.activeElement);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  useEffect(() => {
    lockScroll();
    const p = panel.current;
    if (!p.contains(document.activeElement)) (p.querySelector("[data-autofocus]") || p.querySelector(FOCUSABLE) || p).focus();
    return () => {
      unlockScroll();
      if (opener && opener !== document.body && opener.isConnected && typeof opener.focus === "function") opener.focus({ preventScroll: true });
    };
  }, [opener]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close.current && close.current(); return; }
      if (e.key !== "Tab") return;
      const p = panel.current, list = p.querySelectorAll(FOCUSABLE), a = document.activeElement;
      if (!list.length) { e.preventDefault(); p.focus(); return; }
      const first = list[0], last = list[list.length - 1];
      if (!p.contains(a) || a === p) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div className="dlg-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && close.current) close.current(); }}>
      <div ref={panel} className="dlg" role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} tabIndex={-1}
        style={type ? { "--accent": `var(--c-${type})` } : { "--accent": "var(--ink-muted)" }}>
        {children}
      </div>
    </div>,
    document.body
  );
}
