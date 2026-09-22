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
import { isSoundEnabled, playGameSound, setSoundEnabled } from "../audio/game-sounds";
import { ThemeToggle } from "./theme-toggle";
import type { GameShellProps, GamePhaseVisual } from "./game-ui-types";

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

export function GameSelect({
  label,
  value,
  placeholder,
  options,
  disabled,
  className = "",
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = ReactUseState(false);
  const selected = options.find((option) => option.value === value);
  const menuOptions = [{ value: "", label: placeholder }, ...options];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  return (
    <div className={`field game-select ${className}`} ref={rootRef}>
      <span className="field-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className="game-select-trigger"
        role="combobox"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span id={`${id}-value`}>{selected?.label ?? placeholder}</span>
        <Icon name="chevron" size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="game-select-menu"
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
        >
          {menuOptions.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? "selected" : ""}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Icon name="check" size={17} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
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
      <div className="phase-bar-inner">
        <div className="phase-primary">
          <span className="phase-label">
            <span className="phase-icon" aria-hidden="true">
              <Icon name={phaseIcon[phase]} size={20} />
            </span>
            {phase === "tasks" ? "TASKS" : phase.toUpperCase()}
          </span>
          {children}
        </div>
        <div className="phase-utilities">
          {identity && (
            <span className="phase-identity" title={identity}>
              <IdentityToken name={identity} status="connected" />
              <span>{identity}</span>
            </span>
          )}
          <GameSoundToggle />
          <ThemeToggle placement="game" />
        </div>
      </div>
    </header>
  );
}

export type PhaseVisual = GamePhaseVisual;

const phaseIcon: Record<PhaseVisual, IconName> = {
  lobby: "lobby",
  role: "lock",
  tasks: "tasks",
  meeting: "meeting",
  voting: "voteLock",
  results: "verdict",
};

export function GameSoundToggle() {
  const [enabled, setEnabled] = ReactUseState(true);
  useEffect(() => setEnabled(isSoundEnabled()), []);
  const label = enabled ? "Mute game sounds" : "Enable game sounds";
  return (
    <button
      className="game-utility-button game-sound-toggle"
      type="button"
      aria-pressed={enabled}
      aria-label={label}
      title={label}
      onClick={() => {
        const next = !enabled;
        setEnabled(next);
        setSoundEnabled(next);
        if (next) playGameSound("ui");
      }}
    >
      <Icon name={enabled ? "sound" : "soundOff"} size={20} />
      <span className="utility-label">{enabled ? "Sound" : "Muted"}</span>
    </button>
  );
}

export function GameShell({ phase, identity, status, aside, children }: GameShellProps) {
  return (
    <>
      <PhaseBar phase={phase} identity={identity}>
        {status}
      </PhaseBar>
      <div className={`game-shell-body game-shell-${phase}`}>
        {children}
        {aside}
      </div>
    </>
  );
}

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
  const icon: IconName = tone === "success" ? "check" : tone === "danger" ? "warning" : "spark";
  return (
    <div
      className={`toast toast-${tone}`}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
    >
      <span className="toast-icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span className="toast-body">{children}</span>
    </div>
  );
}
