"use client";

import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { BrandMark, Icon, type IconName } from "./icons";
import {
  initializeGameAudio,
  isSoundEnabled,
  playGameSound,
  setSoundEnabled,
} from "../audio/game-sounds";
import { ThemeToggle } from "./theme-toggle";
import type { GameShellProps, GamePhaseVisual } from "./game-ui-types";
import { avatarById, type AvatarId } from "../../shared/avatars";
import { PlayerAvatar } from "./player-avatar";

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

export function WholeNumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  hint,
  labelAction,
  disabled,
  className = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: string;
  labelAction?: ReactNode;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = ReactUseState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const parsed = Number(draft);
  const valid = /^\d+$/.test(draft) && Number.isInteger(parsed) && parsed >= min && parsed <= max;
  const commit = () => {
    if (!draft) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, Math.trunc(parsed)));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  const nudge = (direction: -1 | 1) => {
    const current = valid ? parsed : value;
    const next = Math.min(max, Math.max(min, current + direction * step));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <label className={`field whole-number-field ${className}`}>
      <span className="game-select-label-row">
        <span className="field-label" id={`${id}-label`}>
          {label}
        </span>
        {labelAction}
      </span>
      <span className="whole-number-control">
        <button
          type="button"
          className="number-step-button"
          disabled={disabled || (valid ? parsed : value) <= min}
          aria-label={`Decrease ${label} by ${step}`}
          onClick={() => nudge(-1)}
        >
          <span aria-hidden="true">−</span>
        </button>
        <span className="whole-number-input-wrap">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={draft}
            disabled={disabled}
            role="spinbutton"
            aria-labelledby={`${id}-label`}
            aria-invalid={!valid}
            aria-valuemin={min}
            aria-valuemax={max}
            onChange={(event) => {
              if (/^\d*$/.test(event.target.value))
                setDraft(event.target.value.slice(0, String(max).length));
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
                event.currentTarget.blur();
              }
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                nudge(event.key === "ArrowUp" ? 1 : -1);
              }
            }}
          />
          {suffix && <span>{suffix}</span>}
        </span>
        <button
          type="button"
          className="number-step-button"
          disabled={disabled || (valid ? parsed : value) >= max}
          aria-label={`Increase ${label} by ${step}`}
          onClick={() => nudge(1)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </span>
      {hint && <span className="field-hint">{hint}</span>}
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
  hint,
  labelHidden = false,
  labelAction,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  className?: string;
  hint?: string;
  labelHidden?: boolean;
  labelAction?: ReactNode;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = ReactUseState(false);
  const [placement, setPlacement] = ReactUseState<"top" | "bottom">("bottom");
  const selected = options.find((option) => option.value === value);
  const menuOptions = placeholder ? [{ value: "", label: placeholder }, ...options] : options;

  const openMenu = (preferredIndex?: number) => {
    if (disabled || menuOptions.length === 0) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const roomBelow = window.innerHeight - rect.bottom;
      setPlacement(roomBelow < 230 && rect.top > roomBelow ? "top" : "bottom");
    }
    setOpen(true);
    const selectedIndex = menuOptions.findIndex((option) => option.value === value);
    const nextIndex = preferredIndex ?? (selectedIndex >= 0 ? selectedIndex : 0);
    window.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
  };

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

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

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const moveOptionFocus = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowDown") next = Math.min(menuOptions.length - 1, index + 1);
    else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = menuOptions.length - 1;
    else return;
    event.preventDefault();
    optionRefs.current[next]?.focus();
  };

  return (
    <div
      className={`field game-select ${className}`}
      ref={rootRef}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {labelHidden ? (
        <span className="sr-only" id={`${id}-label`}>
          {label}
        </span>
      ) : (
        <span className="game-select-label-row">
          <span className="field-label" id={`${id}-label`}>
            {label}
          </span>
          {labelAction}
        </span>
      )}
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
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openMenu();
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(menuOptions.length - 1);
          }
        }}
      >
        <span id={`${id}-value`}>{selected?.label ?? placeholder ?? "Select an option"}</span>
        <Icon name="chevron" size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="game-select-menu"
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          data-placement={placement}
        >
          {menuOptions.map((option, index) => (
            <button
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="option"
              id={`${id}-option-${index}`}
              aria-selected={option.value === value}
              className={option.value === value ? "selected" : ""}
              tabIndex={option.value === value || (!selected && index === 0) ? 0 : -1}
              key={option.value}
              onClick={() => selectOption(option.value)}
              onKeyDown={(event) => moveOptionFocus(event, index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Icon name="check" size={17} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
      {hint && <span className="field-hint">{hint}</span>}
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
  const titleId = useId();
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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <IconButton icon="close" onClick={onClose} label="Close dialog" />
      </div>
      <div className="dialog-body">{children}</div>
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

export function IdentityToken({
  name,
  avatarId,
  status,
  size = 42,
}: {
  name: string;
  avatarId?: AvatarId;
  status?: "connected" | "away";
  size?: number;
}) {
  if (avatarId) return <PlayerAvatar id={avatarId} status={status} size={size} />;
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
  avatarId,
  children,
}: {
  phase: PhaseVisual;
  identity?: string;
  avatarId?: AvatarId;
  children?: ReactNode;
}) {
  const avatar = avatarId ? avatarById(avatarId) : null;
  const avatarStyle = avatar
    ? ({ "--avatar-dark": avatar.dark, "--avatar-light": avatar.light } as CSSProperties)
    : undefined;
  return (
    <header
      className={`phase-bar phase-${phase}${avatar ? " avatar-phase-bar" : ""}`}
      style={avatarStyle}
    >
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
              <IdentityToken name={identity} avatarId={avatarId} status="connected" />
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
  useEffect(() => {
    setEnabled(isSoundEnabled());
    return initializeGameAudio();
  }, []);
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

export function GameShell({ phase, identity, avatarId, status, aside, children }: GameShellProps) {
  return (
    <>
      <PhaseBar phase={phase} identity={identity} avatarId={avatarId}>
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
  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dragStartRef = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  const titleId = useId();
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = drawerRef.current;
    window.requestAnimationFrame(() =>
      drawer
        ?.querySelector<HTMLElement>("button, [href], input, [tabindex]:not([tabindex='-1'])")
        ?.focus(),
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !drawer) return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open]);
  const finishDrag = () => {
    const drawer = drawerRef.current;
    if (!drawer || dragStartRef.current === null) return;
    const shouldClose = dragDistanceRef.current > 80;
    dragStartRef.current = null;
    dragDistanceRef.current = 0;
    drawer.style.removeProperty("transition");
    drawer.style.removeProperty("transform");
    if (shouldClose) onCloseRef.current();
  };
  const startDrag = (clientY: number) => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    dragStartRef.current = clientY;
    dragDistanceRef.current = 0;
    if (drawerRef.current) drawerRef.current.style.transition = "none";
  };
  const moveDrag = (clientY: number) => {
    if (dragStartRef.current === null || !drawerRef.current) return;
    dragDistanceRef.current = Math.max(0, clientY - dragStartRef.current);
    drawerRef.current.style.transform = `translateY(${dragDistanceRef.current}px)`;
  };
  return (
    <div className={open ? "drawer-wrap open" : "drawer-wrap"} aria-hidden={!open}>
      <button className="drawer-scrim" aria-label="Close drawer" onClick={onClose} />
      <aside
        ref={drawerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          className="drawer-grabber"
          aria-hidden="true"
          onPointerDown={(event) => {
            startDrag(event.clientY);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => moveDrag(event.clientY)}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={finishDrag}
          onTouchStart={(event) => startDrag(event.touches[0]?.clientY ?? 0)}
          onTouchMove={(event) => moveDrag(event.touches[0]?.clientY ?? 0)}
          onTouchEnd={finishDrag}
        >
          <span />
        </div>
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
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
  title,
  action,
  onDismiss,
}: {
  children: ReactNode;
  tone?: "success" | "danger" | "warning" | "info";
  title?: string;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}) {
  const icon: IconName =
    tone === "success" ? "check" : tone === "danger" || tone === "warning" ? "warning" : "spark";
  return (
    <div
      className={`toast toast-${tone}`}
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
    >
      <span className="toast-icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span className="toast-body">
        {title || action ? (
          <>
            <span className="toast-copy">
              {title && <strong>{title}</strong>}
              <span>{children}</span>
            </span>
            {action && (
              <button type="button" className="toast-action" onClick={action.onClick}>
                {action.label}
              </button>
            )}
          </>
        ) : (
          children
        )}
      </span>
      {onDismiss && (
        <IconButton
          className="toast-dismiss"
          icon="close"
          label="Dismiss notification"
          onClick={onDismiss}
        />
      )}
    </div>
  );
}
