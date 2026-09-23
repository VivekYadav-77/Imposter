"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_TASKS_PER_MAP, MIN_ACTIVE_TASKS_PER_PUBLISHED_MAP } from "../../shared/task-packs";
import { downloadableTaskCsv, parseTaskCsv, type CsvImportResult } from "../admin/csv";
import { adminApi, ApiError, errorMessage } from "../api/client";
import type { AdminPack, AdminPackSummary, PackStatus } from "../api/types";
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  GameSelect,
  Icon,
  SkeletonList,
  TextArea,
} from "./ui";
import type { MapRole, TaskDifficulty } from "../api/types";
import { useAdminFeedback } from "./admin-feedback";

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminApi.login(email, password);
      router.replace("/admin/task-packs");
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429 ? e.message : "Email or password is incorrect.",
      );
      setBusy(false);
    }
  };
  return (
    <div className="admin-login-shell">
      <section className="admin-login-art" aria-hidden="true">
        <svg viewBox="0 0 620 520" role="img">
          <defs>
            <linearGradient id="login-card" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a63f2b" />
              <stop offset="1" stopColor="#61251d" />
            </linearGradient>
            <linearGradient id="login-paper" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fffaf0" />
              <stop offset="1" stopColor="#d8d2c4" />
            </linearGradient>
          </defs>
          <circle className="login-art-orbit" cx="490" cy="116" r="112" />
          <circle className="login-art-orbit login-art-orbit-small" cx="112" cy="418" r="92" />
          <g transform="rotate(3 310 270)">
            <rect x="62" y="70" width="504" height="380" rx="38" fill="url(#login-card)" />
            <rect x="170" y="136" width="312" height="230" rx="26" fill="url(#login-paper)" />
            <rect x="204" y="178" width="142" height="16" rx="8" className="login-art-ink" />
            <rect x="204" y="208" width="94" height="12" rx="6" className="login-art-line" />
            <rect x="204" y="250" width="244" height="80" rx="18" className="login-art-panel" />
          </g>
          <g className="login-art-crew" transform="translate(86 192)">
            <circle cx="52" cy="34" r="29" />
            <path d="M12 118c4-48 18-72 40-72s36 24 40 72Z" />
          </g>
          <g className="login-art-crew" transform="translate(458 232) scale(.78)">
            <circle cx="52" cy="34" r="29" />
            <path d="M12 118c4-48 18-72 40-72s36 24 40 72Z" />
          </g>
          <g className="login-art-seal" transform="translate(415 345)">
            <circle cx="50" cy="50" r="50" />
            <path d="M28 50c0-12 10-22 22-22s22 10 22 22-10 22-22 22a25 25 0 0 1-12-3l-12 4 4-11a22 22 0 0 1-2-12Z" />
            <path d="M41 50h.01M50 50h.01M59 50h.01" />
          </g>
          <g className="login-art-tag" transform="translate(34 98) rotate(-5)">
            <rect width="164" height="48" rx="24" />
            <path d="M22 28V17l8-6 8 6v11H22Zm5 0v-7h6v7" />
            <text x="50" y="29">
              MAP CONTROL
            </text>
          </g>
        </svg>
        <div className="admin-login-art-copy">
          <span className="eyebrow">Mission control</span>
          <h2>Build the rooms they’ll talk about.</h2>
          <p>Manage maps, tasks, and live-ready content from one secure console.</p>
        </div>
      </section>
      <form className="admin-login card" onSubmit={(event) => void submit(event)}>
        <Link className="back-link admin-login-back" href="/">
          <Icon name="arrow" size={17} />
          <span>Back to site</span>
        </Link>
        <div className="admin-login-heading">
          <p className="eyebrow">Restricted access</p>
          <h1>Map administration</h1>
          <p className="muted">Sign in with a pre-provisioned administrator account.</p>
        </div>
        {error && <Banner tone="danger">{error}</Banner>}
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="field password-field">
          <label className="field-label" htmlFor="admin-password">
            Password
          </label>
          <span className="password-input-wrap">
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              <Icon name={showPassword ? "eyeOff" : "eye"} size={20} />
            </button>
          </span>
        </div>
        <Button type="submit" loading={busy}>
          Sign in
        </Button>
        <p className="admin-login-help">
          <Icon name="lock" size={15} /> Credentials are issued by your server administrator.
        </p>
      </form>
    </div>
  );
}

export function AdminList() {
  const router = useRouter();
  const { notify } = useAdminFeedback();
  const [packs, setPacks] = useState<AdminPackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PackStatus | "">("");
  const [sort, setSort] = useState("updated_desc");
  const [deleteTarget, setDeleteTarget] = useState<AdminPackSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ limit: "50", sort });
      if (search) query.set("search", search);
      if (status) query.set("status", status);
      setLoading(true);
      adminApi
        .list(query.toString(), controller.signal)
        .then((r) => {
          setPacks(r.data);
        })
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === "AbortError") return;
          if (e instanceof ApiError && e.status === 401) router.replace("/admin/login");
          else {
            const message = errorMessage(e);
            notify({ title: "Could not load maps", message, tone: "danger" });
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [notify, router, search, status, sort]);
  const logout = async () => {
    setLoggingOut(true);
    try {
      await adminApi.logout();
      router.replace("/admin/login");
    } catch (cause) {
      notify({ title: "Could not sign out", message: errorMessage(cause), tone: "danger" });
      setLoggingOut(false);
    }
  };
  const deleteMap = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.delete(deleteTarget.id, deleteTarget.revision);
      setPacks((current) => current.filter((pack) => pack.id !== deleteTarget.id));
      notify({
        title: "Map deleted",
        message: `“${deleteTarget.name}” was permanently deleted.`,
        tone: "success",
      });
      setDeleteTarget(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) router.replace("/admin/login");
      else notify({ title: "Could not delete map", message: errorMessage(cause), tone: "danger" });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };
  const totals = useMemo(
    () => ({
      all: packs.length,
      published: packs.filter((pack) => pack.status === "published").length,
      drafts: packs.filter((pack) => pack.status === "draft").length,
      activeTasks: packs.reduce((total, pack) => total + pack.activeItemCount, 0),
    }),
    [packs],
  );
  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Admin dashboard</p>
          <h1>Game maps</h1>
          <p className="muted">Manage locations, task lists, and what players can select.</p>
        </div>
        <div>
          <Button variant="secondary" loading={loggingOut} onClick={() => void logout()}>
            Log out
          </Button>
          <Link className="button button-primary" href="/admin/task-packs/new">
            + New map
          </Link>
        </div>
      </div>
      <section className="admin-stats" aria-label="Map overview">
        <article>
          <span>All maps</span>
          <strong>{loading ? "—" : totals.all}</strong>
          <small>in this view</small>
        </article>
        <article>
          <span>Live maps</span>
          <strong>{loading ? "—" : totals.published}</strong>
          <small>available to rooms</small>
        </article>
        <article>
          <span>Draft maps</span>
          <strong>{loading ? "—" : totals.drafts}</strong>
          <small>awaiting review</small>
        </article>
        <article>
          <span>Active tasks</span>
          <strong>{loading ? "—" : totals.activeTasks}</strong>
          <small>across listed maps</small>
        </article>
      </section>
      <section className="filter-bar" aria-label="Task pack filters">
        <Field
          label="Search"
          placeholder="Search map name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <GameSelect
          label="Status"
          value={status}
          options={[
            { value: "", label: "All statuses" },
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published" },
            { value: "archived", label: "Archived" },
          ]}
          onChange={(value) => setStatus(value as PackStatus | "")}
        />
        <GameSelect
          label="Sort"
          value={sort}
          options={[
            { value: "updated_desc", label: "Recently updated" },
            { value: "name_asc", label: "Name A–Z" },
          ]}
          onChange={setSort}
        />
        <div className="filter-summary">
          <span aria-live="polite">
            {loading
              ? "Updating results…"
              : `${packs.length} map${packs.length === 1 ? "" : "s"} shown`}
          </span>
          {(search || status || sort !== "updated_desc") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("");
                setSort("updated_desc");
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      </section>
      {loading ? (
        <SkeletonList />
      ) : packs.length === 0 ? (
        <EmptyState
          title="No maps found"
          description="Change the filters or create a new map draft."
          action={
            <Link className="button button-primary" href="/admin/task-packs/new">
              Create map
            </Link>
          }
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Map</th>
                <th>Status</th>
                <th>Tasks</th>
                <th>Revision</th>
                <th>Updated</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                <tr key={pack.id}>
                  <td data-label="Map">
                    <strong>{pack.name}</strong>
                    <small>{pack.description || "No description"}</small>
                  </td>
                  <td data-label="Status">
                    <Badge
                      tone={
                        pack.status === "published"
                          ? "success"
                          : pack.status === "archived"
                            ? "neutral"
                            : "warning"
                      }
                    >
                      {pack.status}
                    </Badge>
                  </td>
                  <td data-label="Tasks">
                    {pack.activeItemCount}/{pack.itemCount}
                  </td>
                  <td data-label="Revision">{pack.revision}</td>
                  <td data-label="Updated">
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                      new Date(pack.updatedAt),
                    )}
                  </td>
                  <td data-label="Actions">
                    <div className="admin-row-actions">
                      <Link href={`/admin/task-packs/${pack.id}`}>Open</Link>
                      <button
                        type="button"
                        className="trash-button"
                        aria-label={`Delete ${pack.name}`}
                        title={`Delete ${pack.name}`}
                        onClick={() => setDeleteTarget(pack)}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void deleteMap()}
        title="Delete this map?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” and all of its tasks and roles will be permanently deleted. Maps used by a room or completed game are protected and must be archived instead.`
            : ""
        }
        confirmLabel="Delete map"
        dangerous
        loading={deleting}
      />
    </>
  );
}

interface DraftItem {
  description: string;
  isActive: boolean;
  difficulty: TaskDifficulty;
}
export function AdminEditor({ packId }: { packId?: string }) {
  const router = useRouter();
  const { notify } = useAdminFeedback();
  const [pack, setPack] = useState<AdminPack | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<DraftItem[]>([
    { description: "", isActive: true, difficulty: "medium" },
  ]);
  const [roles, setRoles] = useState<MapRole[]>([]);
  const [loading, setLoading] = useState(Boolean(packId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [confirm, setConfirm] = useState<"publish" | "archive" | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<CsvImportResult | null>(null);
  const [baseline, setBaseline] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [reorderMessage, setReorderMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const serialized = useMemo(
    () => JSON.stringify({ name, description, items, roles }),
    [name, description, items, roles],
  );
  const dirty = Boolean(baseline && serialized !== baseline);
  useEffect(() => {
    if (!packId) {
      const initial = JSON.stringify({
        name: "",
        description: "",
        items: [{ description: "", isActive: true, difficulty: "medium" }],
        roles: [],
      });
      setBaseline(initial);
      return;
    }
    adminApi
      .get(packId)
      .then((r) => {
        const next = r.data;
        const nextItems = next.items
          .sort((a, b) => a.position - b.position)
          .map((item) => ({
            description: item.description,
            isActive: item.isActive,
            difficulty: item.difficulty,
          }));
        setPack(next);
        setName(next.name);
        setDescription(next.description ?? "");
        setItems(nextItems);
        setRoles(next.roles);
        setBaseline(
          JSON.stringify({
            name: next.name,
            description: next.description ?? "",
            items: nextItems,
            roles: next.roles,
          }),
        );
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/admin/login");
        else setError(errorMessage(e));
      })
      .finally(() => setLoading(false));
  }, [packId, router]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const protectInternalNavigation = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.download || event.defaultPrevented) return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname === window.location.pathname
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(`${destination.pathname}${destination.search}${destination.hash}`);
    };
    document.addEventListener("click", protectInternalNavigation, true);
    return () => document.removeEventListener("click", protectInternalNavigation, true);
  }, [dirty]);
  const rolesValid = roles.every(
    (role) => role.name.trim() && role.specialization.trim() && role.ability.trim(),
  );
  const validation = name.trim()
    ? items.some((item) => item.description.trim())
      ? rolesValid
        ? ""
        : "Complete every role name, specialization, and ability."
      : "Add at least one described item."
    : "Pack name is required.";
  const nameError = !name.trim() ? "Enter a map name." : "";
  const tasksError = !items.some((item) => item.description.trim())
    ? "Add at least one task description."
    : "";
  const activeTaskCount = items.filter((item) => item.isActive && item.description.trim()).length;
  const publishReady =
    activeTaskCount >= MIN_ACTIVE_TASKS_PER_PUBLISHED_MAP &&
    activeTaskCount <= MAX_TASKS_PER_MAP &&
    !validation;
  const save = async () => {
    if (validation) {
      setError(validation);
      setValidationAttempted(true);
      window.setTimeout(() => {
        formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        items: items
          .filter((item) => item.description.trim())
          .map((item) => ({ ...item, description: item.description.trim() })),
        roles: roles.map((role) => ({
          name: role.name.trim(),
          specialization: role.specialization.trim(),
          ability: role.ability.trim(),
        })),
      };
      const next = pack
        ? (await adminApi.update(pack.id, { ...body, expectedRevision: pack.revision })).data
        : (await adminApi.create(body)).data;
      setPack(next);
      const nextItems = next.items
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          description: item.description,
          isActive: item.isActive,
          difficulty: item.difficulty,
        }));
      setItems(nextItems);
      setName(next.name);
      setDescription(next.description ?? "");
      setRoles(next.roles);
      setBaseline(
        JSON.stringify({
          name: next.name,
          description: next.description ?? "",
          items: nextItems,
          roles: next.roles,
        }),
      );
      setValidationAttempted(false);
      notify({ title: "Changes saved", message: `“${next.name}” is up to date.`, tone: "success" });
      if (!pack) router.replace(`/admin/task-packs/${next.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace("/admin/login");
      else if (e instanceof ApiError && e.status === 409) {
        const message = "This map changed elsewhere. Reload to review the latest revision.";
        setError(message);
        notify({
          title: "Newer revision available",
          message,
          tone: "warning",
          persistent: true,
          action: { label: "Reload", onClick: () => window.location.reload() },
        });
      } else {
        const message = errorMessage(e);
        setError(message);
        notify({ title: "Could not save changes", message, tone: "danger" });
      }
    } finally {
      setBusy(false);
    }
  };
  const mutateStatus = async () => {
    if (!pack || !confirm) return;
    setBusy(true);
    try {
      const next =
        confirm === "publish"
          ? (await adminApi.publish(pack.id, pack.revision)).data
          : (await adminApi.archive(pack.id, pack.revision)).data;
      setPack(next);
      setConfirm(null);
      setBaseline(serialized);
      notify({
        title: confirm === "publish" ? "Map published" : "Map archived",
        message:
          confirm === "publish"
            ? "Players can now select this map in new rooms."
            : "This map is no longer available to new rooms.",
        tone: "success",
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace("/admin/login");
      else {
        const message = errorMessage(e);
        setError(message);
        notify({ title: "Status change failed", message, tone: "danger" });
      }
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };
  const updateItem = (index: number, change: Partial<DraftItem>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...change } : item)));
  };
  const move = (index: number, delta: -1 | 1) => {
    setItems((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setReorderMessage(`Task ${index + 1} moved ${delta < 0 ? "up" : "down"}.`);
  };
  const applyImport = (parsed: CsvImportResult) => {
    const existing = items.filter((item) => item.description.trim());
    const combined = importMode === "append" ? [...existing, ...parsed.tasks] : parsed.tasks;
    const kept = combined.slice(0, MAX_TASKS_PER_MAP);
    const omitted = parsed.truncatedRows + Math.max(0, combined.length - MAX_TASKS_PER_MAP);
    setItems(kept);
    setPendingImport(null);
    notify({
      title: "Tasks imported",
      message: `${kept.length} task${kept.length === 1 ? "" : "s"} now in the editor.${
        parsed.ignoredRows ? ` ${parsed.ignoredRows} empty row(s) ignored.` : ""
      }${omitted ? ` ${omitted} row(s) omitted because maps support ${MAX_TASKS_PER_MAP} tasks.` : ""}`,
      tone: omitted ? "warning" : "success",
    });
  };
  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const parsed = parseTaskCsv(await file.text());
      if (parsed.tasks.length === 0) {
        setError("No task descriptions were found in that CSV file.");
        return;
      }
      if (importMode === "replace" && items.some((item) => item.description.trim()))
        setPendingImport(parsed);
      else applyImport(parsed);
    } catch {
      const message = "The CSV file could not be read. Check its format and try again.";
      setError(message);
      notify({ title: "CSV import failed", message, tone: "danger" });
    }
  };
  const downloadSample = () => {
    const url = URL.createObjectURL(
      new Blob([downloadableTaskCsv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "map-tasks-template.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify({
      title: "Template downloaded",
      message: "Replace the examples, save the CSV, and import it here.",
      tone: "info",
    });
  };
  if (loading) return <SkeletonList count={6} />;
  return (
    <>
      <div className="editor-heading">
        <div>
          <Link className="back-link" href="/admin/task-packs">
            <Icon name="arrow" size={17} />
            <span>All maps</span>
          </Link>
          <p className="eyebrow">
            {pack ? `${pack.status} · revision ${pack.revision}` : "New draft"}
          </p>
          <h1>{pack ? pack.name : "Create a map"}</h1>
        </div>
        {pack && (
          <Badge
            tone={
              pack.status === "published"
                ? "success"
                : pack.status === "archived"
                  ? "neutral"
                  : "warning"
            }
          >
            {pack.status}
          </Badge>
        )}
      </div>
      {pack?.status === "archived" && (
        <Banner tone="warning">This map is archived and available for review only.</Banner>
      )}
      <form
        ref={formRef}
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {error && (
          <Banner tone="danger">
            <span>
              <strong>Review required.</strong> {error}
            </span>
          </Banner>
        )}
        <section className="card">
          <h2>Map details</h2>
          <Field
            id="map-name"
            label="Map name"
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            error={validationAttempted ? nameError : undefined}
            hint={!validationAttempted || !nameError ? `${name.length}/80 characters` : undefined}
            disabled={pack?.status === "archived"}
          />
          <TextArea
            label="Description"
            maxLength={1000}
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setError("");
            }}
            hint={`${description.length}/1000 characters`}
            disabled={pack?.status === "archived"}
          />
        </section>
        <section className="card csv-import-panel">
          <div>
            <p className="eyebrow">Bulk entry</p>
            <h2>Import tasks from CSV</h2>
            <p className="muted">
              Fill the template and import it to populate the task table automatically. Use
              <code> task_description</code>, <code>difficulty</code> (easy, medium, or hard), and
              <code> active</code> (true or false).
            </p>
          </div>
          <div className="csv-import-actions">
            <GameSelect
              className="compact-field"
              label="Import behavior"
              value={importMode}
              options={[
                { value: "replace", label: "Replace current rows" },
                { value: "append", label: "Append to current rows" },
              ]}
              onChange={(value) => setImportMode(value as "replace" | "append")}
              disabled={pack?.status === "archived"}
            />
            <label
              className={`button button-primary file-button${pack?.status === "archived" ? " disabled" : ""}`}
            >
              Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void importCsv(event)}
                disabled={pack?.status === "archived"}
              />
            </label>
            <Button type="button" variant="secondary" onClick={downloadSample}>
              Download CSV template
            </Button>
          </div>
        </section>
        <section className="card item-editor">
          <div className="section-heading">
            <div>
              <h2>Map task table</h2>
              <p className="muted">
                Add up to {MAX_TASKS_PER_MAP} descriptions. A map can be published with at least{" "}
                {MIN_ACTIVE_TASKS_PER_PUBLISHED_MAP} active tasks.
              </p>
            </div>
            <Badge>
              {items.filter((item) => item.isActive && item.description.trim()).length} active
            </Badge>
          </div>
          {validationAttempted && tasksError && <Banner tone="danger">{tasksError}</Banner>}
          <p className="sr-only" aria-live="polite">
            {reorderMessage}
          </p>
          <div className="task-table-wrap">
            <table className="task-entry-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Task description</th>
                  <th scope="col">Difficulty</th>
                  <th scope="col">Active</th>
                  <th scope="col">Order / remove</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="drag-index" data-label="Task">
                      {index + 1}
                    </td>
                    <td data-label="Description">
                      <label className="sr-only" htmlFor={`task-${index}`}>
                        Task {index + 1}
                      </label>
                      <input
                        id={`task-${index}`}
                        value={item.description}
                        maxLength={280}
                        placeholder="Enter a task players can prove with a photo"
                        aria-invalid={Boolean(validationAttempted && tasksError && index === 0)}
                        onChange={(event) => {
                          updateItem(index, { description: event.target.value });
                        }}
                        disabled={pack?.status === "archived"}
                      />
                    </td>
                    <td data-label="Difficulty">
                      <GameSelect
                        className="table-select"
                        label={`Task ${index + 1} difficulty`}
                        labelHidden
                        value={item.difficulty}
                        options={[
                          { value: "easy", label: "Easy" },
                          { value: "medium", label: "Medium" },
                          { value: "hard", label: "Hard" },
                        ]}
                        onChange={(value) =>
                          updateItem(index, { difficulty: value as TaskDifficulty })
                        }
                        disabled={pack?.status === "archived"}
                      />
                    </td>
                    <td data-label="Active">
                      <label className="table-toggle">
                        <input
                          type="checkbox"
                          checked={item.isActive}
                          onChange={(event) =>
                            updateItem(index, { isActive: event.target.checked })
                          }
                          disabled={pack?.status === "archived"}
                        />
                        <span>{item.isActive ? "Yes" : "No"}</span>
                      </label>
                    </td>
                    <td data-label="Actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0 || pack?.status === "archived"}
                          aria-label={`Move task ${index + 1} up`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === items.length - 1 || pack?.status === "archived"}
                          aria-label={`Move task ${index + 1} down`}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="remove-row"
                          onClick={() => {
                            setItems((current) => current.filter((_, i) => i !== index));
                            notify({
                              title: "Task removed",
                              message: `Task ${index + 1} was removed from this draft.`,
                              tone: "info",
                              action: {
                                label: "Undo",
                                onClick: () =>
                                  setItems((current) => [
                                    ...current.slice(0, index),
                                    item,
                                    ...current.slice(index),
                                  ]),
                              },
                            });
                          }}
                          disabled={items.length === 1 || pack?.status === "archived"}
                          aria-label={`Remove task ${index + 1}`}
                        >
                          <Icon name="close" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length < MAX_TASKS_PER_MAP && pack?.status !== "archived" && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setItems((current) => [
                  ...current,
                  { description: "", isActive: true, difficulty: "medium" },
                ]);
              }}
            >
              + Add table row
            </Button>
          )}
        </section>
        <section className="card role-editor">
          <div className="section-heading">
            <div>
              <h2>Crew roles</h2>
              <p className="muted">
                Define the specialization and in-game ability available on this map.
              </p>
            </div>
            <Badge>{roles.length} roles</Badge>
          </div>
          <div className="role-list">
            {roles.map((role, index) => (
              <div className="role-row" key={index}>
                <Field
                  id={`role-${index}-name`}
                  label={`Role ${index + 1} name`}
                  maxLength={50}
                  value={role.name}
                  disabled={pack?.status === "archived"}
                  error={
                    validationAttempted && !role.name.trim() ? "Enter a role name." : undefined
                  }
                  onChange={(event) => {
                    setRoles((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, name: event.target.value } : entry,
                      ),
                    );
                  }}
                />
                <Field
                  id={`role-${index}-specialization`}
                  label="Specialization"
                  maxLength={160}
                  value={role.specialization}
                  disabled={pack?.status === "archived"}
                  error={
                    validationAttempted && !role.specialization.trim()
                      ? "Enter a specialization."
                      : undefined
                  }
                  onChange={(event) => {
                    setRoles((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, specialization: event.target.value } : entry,
                      ),
                    );
                  }}
                />
                <Field
                  id={`role-${index}-ability`}
                  label="Ability"
                  maxLength={200}
                  value={role.ability}
                  disabled={pack?.status === "archived"}
                  error={
                    validationAttempted && !role.ability.trim() ? "Enter an ability." : undefined
                  }
                  onChange={(event) => {
                    setRoles((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, ability: event.target.value } : entry,
                      ),
                    );
                  }}
                />
                <Button
                  type="button"
                  variant="danger"
                  disabled={pack?.status === "archived"}
                  onClick={() => {
                    setRoles((current) => current.filter((_, i) => i !== index));
                    notify({
                      title: "Role removed",
                      message: `${role.name || `Role ${index + 1}`} was removed from this draft.`,
                      tone: "info",
                      action: {
                        label: "Undo",
                        onClick: () =>
                          setRoles((current) => [
                            ...current.slice(0, index),
                            role,
                            ...current.slice(index),
                          ]),
                      },
                    });
                  }}
                >
                  Remove role
                </Button>
              </div>
            ))}
          </div>
          {roles.length < 12 && pack?.status !== "archived" && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setRoles((current) => [...current, { name: "", specialization: "", ability: "" }]);
              }}
            >
              + Add crew role
            </Button>
          )}
        </section>
        <div className="save-bar">
          <span>
            <strong>{dirty ? "Unsaved changes" : "All changes saved"}</strong>
            {pack?.status === "draft" && !publishReady && (
              <small>{activeTaskCount}/3 active tasks required to publish</small>
            )}
          </span>
          {pack?.status !== "archived" && (
            <Button type="submit" loading={busy} disabled={!dirty}>
              Save changes
            </Button>
          )}
          {pack?.status === "draft" && (
            <Button
              type="button"
              variant="secondary"
              disabled={dirty || !publishReady}
              onClick={() => setConfirm("publish")}
            >
              Publish map
            </Button>
          )}
          {pack && pack.status !== "archived" && (
            <Button
              type="button"
              variant="danger"
              disabled={dirty}
              onClick={() => setConfirm("archive")}
            >
              Archive
            </Button>
          )}
        </div>
      </form>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => void mutateStatus()}
        title={confirm === "publish" ? "Publish this map?" : "Archive this map?"}
        description={
          confirm === "publish"
            ? `The map needs ${MIN_ACTIVE_TASKS_PER_PUBLISHED_MAP} to ${MAX_TASKS_PER_MAP} active tasks. Room task options will match the available difficulties.`
            : "Archiving is terminal. The pack will no longer be available for new rooms."
        }
        confirmLabel={confirm === "publish" ? "Publish map" : "Archive map"}
        dangerous={confirm === "archive"}
        loading={busy}
      />
      <ConfirmDialog
        open={Boolean(pendingImport)}
        onClose={() => setPendingImport(null)}
        onConfirm={() => pendingImport && applyImport(pendingImport)}
        title="Replace current task rows?"
        description="The tasks currently in this editor will be replaced by the imported CSV rows. You can still leave without saving afterward."
        confirmLabel="Replace and import"
        dangerous
      />
      <ConfirmDialog
        open={Boolean(pendingNavigation)}
        onClose={() => setPendingNavigation(null)}
        onConfirm={() => {
          const destination = pendingNavigation;
          setPendingNavigation(null);
          if (destination) router.push(destination);
        }}
        title="Discard unsaved changes?"
        description="Changes made on this page have not been saved and will be lost."
        confirmLabel="Discard changes"
        dangerous
      />
    </>
  );
}
