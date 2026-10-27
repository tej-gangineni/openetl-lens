import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Dialog from "./Dialog.jsx";
import TypeBadge from "./Badge.jsx";
import { TYPES, TYPE_IDS, typeOf } from "./typeMeta.js";
import { api, postJson, fmt, isAbort } from "./api.js";
import "./dialogs.css";

const HINTS = { types: "Comma-separated type names. Leave empty for DocumentChunk." };
const plainLabel = (l) => l.replace(/\s*\(optional\)/i, "");
const finePointer = () => typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;

// Turn whatever went wrong into one plain sentence, never raw JSON.
function plainError(e) {
  let m = (e && e.message) || "";
  if (/^\s*[{[]/.test(m)) { try { const j = JSON.parse(m); m = j.error || j.message || ""; } catch { m = ""; } }
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(m)) return "Could not reach the Lens server. Check that it is running, then try again.";
  return m || "Something went wrong. Check the values and try again.";
}

const Icon = ({ children, size = 16 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const Spinner = () => <span className="dlg-spinner" aria-hidden="true" />;

function Field({ id, label, hint, error, children }) {
  return (
    <div className="dlg-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="dlg-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="dlg-error" id={`${id}-err`}>{error}</p>}
    </div>
  );
}

function TypeTiles({ value, onPick, tileRefs, labelledBy }) {
  const move = (e, i) => {
    const k = e.key, n = TYPE_IDS.length;
    let j = null;
    if (k === "ArrowRight" || k === "ArrowDown") j = (i + 1) % n;
    else if (k === "ArrowLeft" || k === "ArrowUp") j = (i - 1 + n) % n;
    else if (k === "Home") j = 0; else if (k === "End") j = n - 1;
    if (j === null) return;
    e.preventDefault();
    onPick(TYPE_IDS[j], false);
    tileRefs.current[j] && tileRefs.current[j].focus();
  };
  const stop = value ? TYPE_IDS.indexOf(value) : 0;
  return (
    <div className="dlg-tiles" role="radiogroup" aria-labelledby={labelledBy}>
      {TYPE_IDS.map((t, i) => {
        const m = TYPES[t], on = t === value;
        return (
          <button key={t} type="button" role="radio" aria-checked={on} tabIndex={i === stop ? 0 : -1} className="dlg-tile" data-on={on || undefined}
            ref={(el) => { tileRefs.current[i] = el; }} style={{ "--accent": `var(--c-${t})` }} onClick={() => onPick(t, true)} onKeyDown={(e) => move(e, i)}>
            <TypeBadge type={t} />
            <span className="dlg-tile-text"><span className="dlg-tile-name">{m.label}</span><span className="dlg-tile-blurb">{m.blurb}</span></span>
          </button>
        );
      })}
    </div>
  );
}

export function AddConnectionDialog({ open, onClose, onSaved }) {
  return open ? <AddDialog onClose={onClose} onSaved={onSaved} /> : null;
}

function AddDialog({ onClose, onSaved }) {
  const uid = useId(), titleId = `${uid}-title`, tilesId = `${uid}-lead`;
  const [step, setStep] = useState(1), [type, setType] = useState(null);
  const [drafts, setDrafts] = useState({});              // typed values survive Back, per type
  const [shown, setShown] = useState({});                // secret fields currently revealed
  const [errors, setErrors] = useState({});
  const [testing, setTesting] = useState(false), [saving, setSaving] = useState(false);
  const [passedKey, setPassedKey] = useState(null);      // the exact values a test passed for
  const [notice, setNotice] = useState(null);            // { key, ok, text }
  const tileRefs = useRef([]), nameRef = useRef(null), titleRef = useRef(null), alive = useRef(true), testAbort = useRef(null);

  useEffect(() => () => { alive.current = false; testAbort.current && testAbort.current.abort(); }, []);

  const meta = type ? typeOf(type) : null;
  const draft = (type && drafts[type]) || {};
  const name = draft.name ?? (meta ? `My ${meta.label}` : "");
  const cfg = draft.cfg || {};
  const payload = useMemo(() => {
    if (!type) return null;
    const config = {};
    for (const f of TYPES[type].fields) { const v = (cfg[f.key] ?? "").trim(); if (v) config[f.key] = v; }
    return { name: name.trim(), type, config };
  }, [type, name, cfg]);
  const key = payload ? JSON.stringify(payload) : "";
  const passed = passedKey !== null && passedKey === key;
  const shownNotice = notice && notice.key === key ? notice : null;

  // Focus follows the step: the chosen tile on step 1, the name field (or the title on touch screens) on step 2.
  useEffect(() => {
    if (step === 1) { const i = type ? TYPE_IDS.indexOf(type) : 0; tileRefs.current[i] && tileRefs.current[i].focus(); }
    else if (finePointer() && nameRef.current) { nameRef.current.focus(); nameRef.current.select(); }
    else titleRef.current && titleRef.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const patch = (p) => setDrafts((d) => ({ ...d, [type]: { ...d[type], ...p } }));
  const setName = (v) => { patch({ name: v }); setErrors((e) => (e.name ? { ...e, name: undefined } : e)); };
  const setField = (k, v) => { patch({ cfg: { ...cfg, [k]: v } }); setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e)); };

  const pick = (t, advance) => { setType(t); setErrors({}); if (advance) setStep(2); };
  const back = () => { testAbort.current && testAbort.current.abort(); setTesting(false); setErrors({}); setStep(1); };

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = "Give the connection a name.";
    for (const f of meta.fields) if (f.required && !(cfg[f.key] ?? "").trim()) errs[f.key] = `${plainLabel(f.label)} is required.`;
    setErrors(errs);
    const first = ["name", ...meta.fields.map((f) => f.key)].find((k) => errs[k]);
    if (first) { const el = document.getElementById(`${uid}-f-${first}`); el && el.focus(); return false; }
    return true;
  };

  const test = async () => {
    if (testing || !validate()) return;
    const k = key, body = payload;
    testAbort.current && testAbort.current.abort();
    const ac = (testAbort.current = new AbortController());
    setTesting(true);
    try {
      const r = await postJson("/connections/test", body, ac.signal);
      if (!alive.current) return;
      if (r && r.ok === false) throw new Error(r.error);
      const n = r.containers ?? 0, noun = n === 1 ? meta.noun : meta.nouns;
      setPassedKey(k); setNotice({ key: k, ok: true, text: `Connected. Found ${fmt(n)} ${noun}.` });
    } catch (e) {
      if (isAbort(e) || !alive.current) return;
      setPassedKey((p) => (p === k ? null : p)); setNotice({ key: k, ok: false, text: plainError(e) });
    } finally { if (alive.current && testAbort.current === ac) setTesting(false); }
  };

  const save = async () => {
    if (saving || !passed || !validate()) return;
    const k = key, body = payload;
    setSaving(true);
    try {
      const r = await postJson("/connections", body);
      if (!alive.current) return;
      onSaved && onSaved(r.connection);
      onClose();
    } catch (e) {
      if (!alive.current) return;
      setNotice({ key: k, ok: false, text: plainError(e) });
    } finally { if (alive.current) setSaving(false); }
  };

  const onFormKey = (e) => {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (passed) save(); else test();
  };

  const safeClose = () => { if (!saving) onClose(); };

  if (step === 1) {
    return (
      <Dialog onClose={safeClose} labelledBy={titleId} describedBy={tilesId} type={type}>
        <div className="dlg-head">
          <h2 id={titleId} className="dlg-title">Add data</h2>
          <p id={tilesId} className="dlg-lead">Choose where your data lives. Lens only reads, it never writes.</p>
        </div>
        <div className="dlg-body">
          <TypeTiles value={type} onPick={pick} tileRefs={tileRefs} labelledBy={titleId} />
        </div>
        <div className="dlg-foot"><span className="dlg-spacer" /><button type="button" className="dlg-btn" onClick={onClose}>Cancel</button></div>
      </Dialog>
    );
  }

  const hintId = `${uid}-gate`;
  const fieldProps = (id, k) => ({ id, name: k, autoComplete: "off", spellCheck: false, autoCapitalize: "off", "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": [HINTS[k] && `${id}-hint`, errors[k] && `${id}-err`].filter(Boolean).join(" ") || undefined });
  return (
    <Dialog onClose={safeClose} labelledBy={titleId} type={type}>
      <div className="dlg-head dlg-head-row">
        <TypeBadge type={type} size="lg" />
        <div className="dlg-head-text">
          <h2 id={titleId} className="dlg-title" ref={titleRef} tabIndex={-1}>Add {meta.label}</h2>
          <p className="dlg-lead">{meta.blurb}.</p>
        </div>
      </div>
      <form className="dlg-body" noValidate onSubmit={(e) => e.preventDefault()} onKeyDown={onFormKey}>
        <Field id={`${uid}-f-name`} label="Name" error={errors.name}>
          <input ref={nameRef} type="text" className="dlg-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My database…"
            {...{ ...fieldProps(`${uid}-f-name`, "name"), spellCheck: true }} />
        </Field>
        {meta.fields.map((f) => {
          const id = `${uid}-f-${f.key}`, reveal = !!shown[`${type}:${f.key}`];
          const kind = f.secret ? (reveal ? "text" : "password") : f.key === "url" ? "url" : "text";
          const input = (
            <input type={kind} inputMode={f.key === "url" ? "url" : undefined} className="dlg-input" value={cfg[f.key] ?? ""} placeholder={f.placeholder}
              onChange={(e) => setField(f.key, e.target.value)} required={f.required} aria-required={f.required || undefined} {...fieldProps(id, f.key)} />
          );
          return (
            <Field key={`${type}:${f.key}`} id={id} label={f.label} hint={HINTS[f.key]} error={errors[f.key]}>
              {f.secret ? (
                <div className="dlg-secret">
                  {input}
                  <button type="button" className="dlg-eye" aria-pressed={reveal} aria-label={`Show ${plainLabel(f.label).toLowerCase()}`}
                    onClick={() => setShown((s) => ({ ...s, [`${type}:${f.key}`]: !reveal }))}>
                    <Icon>{reveal
                      ? <><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" /><circle cx="10" cy="10" r="2.2" /></>
                      : <><path d="M3.5 3.5l13 13M8.2 5a8 8 0 0 1 1.8-.2c5 0 8 5.2 8 5.2a14 14 0 0 1-2.6 3.2M5.6 6.2A14 14 0 0 0 2 10s3 5.5 8 5.5c1.1 0 2.1-.3 3-.7" /></>}</Icon>
                  </button>
                </div>
              ) : input}
            </Field>
          );
        })}
        <div className="dlg-test">
          <button type="button" className="dlg-btn" disabled={testing} onClick={test}>{testing ? <><Spinner />Testing…</> : "Test connection"}</button>
          <div className="dlg-live" aria-live="polite">
            {shownNotice && (
              <p className={`dlg-result ${shownNotice.ok ? "is-ok" : "is-bad"}`}>
                <Icon>{shownNotice.ok ? <path d="M4.5 10.5l3.4 3.4 7.6-7.8" /> : <path d="M6 6l8 8M14 6l-8 8" />}</Icon>
                <span>{shownNotice.text}</span>
              </p>
            )}
          </div>
          {!passed && !shownNotice && <p className="dlg-hint" id={hintId}>Run a test to enable Save.</p>}
        </div>
      </form>
      <div className="dlg-foot">
        <button type="button" className="dlg-btn dlg-btn-quiet" onClick={back}>Back</button>
        <span className="dlg-spacer" />
        <button type="button" className="dlg-btn" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="dlg-btn dlg-btn-primary" disabled={!passed || saving} onClick={save} aria-describedby={!passed ? hintId : undefined}>
          {saving ? <><Spinner />Saving…</> : "Save"}
        </button>
      </div>
    </Dialog>
  );
}

export function DeleteConnectionDialog({ connection, onClose, onDeleted }) {
  return connection ? <DeleteDialog connection={connection} onClose={onClose} onDeleted={onDeleted} /> : null;
}

function DeleteDialog({ connection, onClose, onDeleted }) {
  const uid = useId(), titleId = `${uid}-title`, bodyId = `${uid}-body`;
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const sample = !!connection.builtin; // a sample connection is hidden, not erased, and can be restored from Home

  const remove = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api(`/connections/${encodeURIComponent(connection.id)}`, { method: "DELETE" });
      if (!alive.current) return;
      onDeleted && onDeleted(connection.id);
      onClose();
    } catch (e) {
      if (!alive.current) return;
      setError(plainError(e)); setBusy(false);
    }
  };

  return (
    <Dialog onClose={() => { if (!busy) onClose(); }} labelledBy={titleId} describedBy={bodyId} type={connection.type}>
      <div className="dlg-head dlg-head-row">
        <TypeBadge type={connection.type} size="lg" />
        <div className="dlg-head-text">
          <h2 id={titleId} className="dlg-title">Delete {connection.name}?</h2>
        </div>
      </div>
      <div className="dlg-body">
        <p id={bodyId} className="dlg-copy">{"This removes the connection from Lens. Your data is not touched."}{sample ? " You can bring it back with Restore sample connections on the home page." : ""}</p>
        <div className="dlg-live" aria-live="polite">
          {error && <p className="dlg-result is-bad"><Icon><path d="M6 6l8 8M14 6l-8 8" /></Icon><span>{error}</span></p>}
        </div>
      </div>
      <div className="dlg-foot">
        <span className="dlg-spacer" />
        <button type="button" className="dlg-btn" data-autofocus disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="dlg-btn dlg-btn-danger" disabled={busy} onClick={remove}>{busy ? <><Spinner />Deleting…</> : "Delete"}</button>
      </div>
    </Dialog>
  );
}
