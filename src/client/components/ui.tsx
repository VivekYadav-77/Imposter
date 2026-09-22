"use client";

import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { BrandMark, Icon, type IconName } from "./icons";

export { Icon, type IconName } from "./icons";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <BrandMark />
      <span>
        {compact ? (
          "IMPOSTER"
        ) : (
          <>
            IMPOSTER <small>GAME</small>
          </>
        )}
      </span>
    </span>
  );
}

export function IconButton({
  icon,
  label,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

export function Button({
  variant = "primary",
  loading,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      className={`button button-${variant} ${className}`}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="spinner" aria-hidden="true" />
          Working…
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Field({
  label,
  error,
  hint,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? helpId : undefined}
        {...props}
      />
      <span id={helpId} className={error ? "field-error" : "field-hint"}>
        {error ?? hint}
      </span>
    </label>
  );
}

export function TextArea({
  label,
  error,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? helpId : undefined}
        {...props}
      />
      <span id={helpId} className={error ? "field-error" : "field-hint"}>
        {error ?? hint}
      </span>
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Banner({
  children,
  tone = "info",
  action,
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "danger" | "success";
  action?: ReactNode;
}) {
  return (
    <div className={`banner banner-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <span>{children}</span>
      {action}
    </div>
  );
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress-block">
      <div className="progress-label">
        <span>{label}</span>
        <strong>{percent}%</strong>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemax={max}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="empty-state">
      <span className="empty-seal" aria-hidden="true">
        <Icon name="warning" size={28} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-list" aria-label="Loading" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <IconButton icon="close" onClick={onClose} label="Close dialog" />
      </div>
      {children}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  dangerous = false,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  dangerous?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <p className="muted">{description}</p>
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={dangerous ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export function Timer({
  deadline,
  label = "Time remaining",
}: {
  deadline: string | null;
  label?: string;
}) {
  const value = useCountdown(deadline);
  if (!deadline) return null;
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (value % 60).toString().padStart(2, "0");
  return (
    <div
      className={`timer ${value < 30 ? "timer-warning" : ""}`}
      aria-label={`${label}: ${minutes} minutes ${seconds} seconds`}
    >
      <span>
        {minutes}:{seconds}
      </span>
      <small>{label}</small>
    </div>
  );
}

function useCountdown(deadline: string | null) {
  const calculate = () =>
    deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000)) : 0;
  const [value, setValue] = ReactUseState(calculate);
  useEffect(() => {
    setValue(calculate());
    const timer = setInterval(() => setValue(calculate()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  return value;
}

// Aliased to keep React imported APIs explicit in the public component signatures.
import { useState as ReactUseState } from "react";

export function IdentityToken({ name, status }: { name: string; status?: "connected" | "away" }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span className="identity-token" aria-hidden="true" data-status={status}>
      {initials || "?"}
    </span>
  );
}

export function PhaseBar({
  phase,
  identity,
  children,
}: {
  phase: PhaseVisual;
  identity?: string;
  children?: ReactNode;
}) {
  return (
    <header className={`phase-bar phase-${phase}`}>
      <div>
        <span className="phase-label">
          <Icon name={phaseIcon[phase]} size={20} />
          {phase === "tasks" ? "TASKS" : phase.toUpperCase()}
        </span>
        {children}
      </div>
      {identity && (
        <span className="phase-identity" title={identity}>
          {identity}
        </span>
      )}
    </header>
  );
}

export type PhaseVisual = "lobby" | "tasks" | "meeting" | "results";

const phaseIcon: Record<PhaseVisual, IconName> = {
  lobby: "lobby",
  tasks: "tasks",
  meeting: "meeting",
  results: "verdict",
};

export function Tabs({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className={open ? "drawer-wrap open" : "drawer-wrap"} aria-hidden={!open}>
      <button className="drawer-scrim" aria-label="Close drawer" onClick={onClose} />
      <aside className="drawer" aria-label={title}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <IconButton icon="close" onClick={onClose} label="Close drawer" />
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Toast({
  children,
  tone = "success",
}: {
  children: ReactNode;
  tone?: "success" | "danger" | "info";
}) {
  return (
    <div
      className={`toast toast-${tone}`}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
