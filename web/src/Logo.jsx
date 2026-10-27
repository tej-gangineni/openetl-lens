import React from "react";

// The OpenETL Lens mark: a lens over three rows of data, the top row picked out. Uses --brand for the highlight, the text colour for the rest.
export default function Logo({ size = 28 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="14" cy="14" r="10.2" fill="var(--surface)" stroke="currentColor" strokeWidth="2.4" />
      <rect x="8.6" y="9.1" width="10.8" height="2.7" rx="1.35" fill="var(--brand)" />
      <rect x="8.6" y="13.2" width="7.4" height="2.7" rx="1.35" fill="currentColor" opacity="0.5" />
      <rect x="8.6" y="17.3" width="9.2" height="2.7" rx="1.35" fill="currentColor" opacity="0.5" />
      <path d="M21.7 21.7 28 28" stroke="var(--brand)" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}
