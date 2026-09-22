"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Toast } from "./ui";

export type AdminNoticeTone = "success" | "danger" | "warning" | "info";

interface AdminNotice {
  id: number;
  title?: string;
  message: string;
  tone: AdminNoticeTone;
  action?: { label: string; onClick: () => void };
  persistent?: boolean;
}

interface AdminFeedbackValue {
  notify: (notice: Omit<AdminNotice, "id">) => number;
  dismiss: (id: number) => void;
}

const AdminFeedbackContext = createContext<AdminFeedbackValue | null>(null);

export function AdminFeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (notice: AdminNotice) => {
      if (notice.persistent) return;
      const duration = notice.tone === "danger" ? 8_000 : 4_800;
      timers.current.set(
        notice.id,
        window.setTimeout(() => dismiss(notice.id), duration),
      );
    },
    [dismiss],
  );

  const notify = useCallback(
    (input: Omit<AdminNotice, "id">) => {
      const notice = { ...input, id: nextId.current++ };
      setNotices((current) => [...current.slice(-2), notice]);
      scheduleDismiss(notice);
      return notice.id;
    },
    [scheduleDismiss],
  );

  const pause = (id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  };

  const resume = (notice: AdminNotice) => {
    if (!timers.current.has(notice.id)) scheduleDismiss(notice);
  };

  const value = useMemo(() => ({ notify, dismiss }), [dismiss, notify]);

  return (
    <AdminFeedbackContext.Provider value={value}>
      {children}
      <div className="admin-toast-region" aria-label="Notifications">
        {notices.map((notice) => (
          <div
            key={notice.id}
            onMouseEnter={() => pause(notice.id)}
            onMouseLeave={() => resume(notice)}
            onFocusCapture={() => pause(notice.id)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) resume(notice);
            }}
          >
            <Toast
              tone={notice.tone}
              title={notice.title}
              onDismiss={() => dismiss(notice.id)}
              action={
                notice.action
                  ? {
                      label: notice.action.label,
                      onClick: () => {
                        notice.action?.onClick();
                        dismiss(notice.id);
                      },
                    }
                  : undefined
              }
            >
              {notice.message}
            </Toast>
          </div>
        ))}
      </div>
    </AdminFeedbackContext.Provider>
  );
}

export function useAdminFeedback() {
  const value = useContext(AdminFeedbackContext);
  if (!value) throw new Error("useAdminFeedback must be used inside AdminFeedbackProvider.");
  return value;
}
