"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseTaskCsv, sampleTaskCsv } from "../admin/csv";
import { adminApi, ApiError, errorMessage } from "../api/client";
import type { AdminPack, AdminPackSummary, PackStatus } from "../api/types";
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  SkeletonList,
  TextArea,
  Toast,
} from "./ui";
import type { MapRole, TaskDifficulty } from "../api/types";

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <form className="admin-login card" onSubmit={(event) => void submit(event)}>
      <p className="eyebrow">Restricted access</p>
      <h1>Map administration</h1>
      <p className="muted">Sign in with a pre-provisioned administrator account.</p>
      {error && <Banner tone="danger">{error}</Banner>}
      <Field
        label="Email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Field
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" loading={busy}>
        Sign in
      </Button>
    </form>
  );
}

export function AdminList() {
  const router = useRouter();
  const [packs, setPacks] = useState<AdminPackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PackStatus | "">("");
  const [sort, setSort] = useState("updated_desc");
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ limit: "50", sort });
      if (search) query.set("search", search);
      if (status) query.set("status", status);
      setLoading(true);
      adminApi
        .list(query.toString())
        .then((r) => {
          setPacks(r.data);
          setError("");
        })
        .catch((e: unknown) => {
          if (e instanceof ApiError && e.status === 401) router.replace("/admin/login");
          else setError(errorMessage(e));
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [router, search, status, sort]);
  const logout = async () => {
    await adminApi.logout();
    router.replace("/admin/login");
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
          <Button variant="secondary" onClick={() => void logout()}>
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
        <label className="field">
          <span className="field-label">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as PackStatus | "")}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="updated_desc">Recently updated</option>
            <option value="name_asc">Name A–Z</option>
          </select>
        </label>
      </section>
      {error && <Banner tone="danger">{error}</Banner>}
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
                  <td>
                    <strong>{pack.name}</strong>
                    <small>{pack.description || "No description"}</small>
                  </td>
                  <td>
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
                  <td>
                    {pack.activeItemCount}/{pack.itemCount}
                  </td>
                  <td>{pack.revision}</td>
                  <td>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                      new Date(pack.updatedAt),
                    )}
                  </td>
                  <td>
                    <Link href={`/admin/task-packs/${pack.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  const [saved, setSaved] = useState("");
  const [confirm, setConfirm] = useState<"publish" | "archive" | null>(null);
  const [baseline, setBaseline] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [importNotice, setImportNotice] = useState("");
  const [toast, setToast] = useState("");
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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);
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
  const save = async () => {
    if (validation) {
      setError(validation);
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
      setSaved("Changes saved.");
      setToast("Map changes saved.");
      if (!pack) router.replace(`/admin/task-packs/${next.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? "This pack changed elsewhere. Reload to review the latest revision before saving again."
          : errorMessage(e),
      );
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
      setToast(confirm === "publish" ? "Map published." : "Map archived.");
    } catch (e) {
      setError(errorMessage(e));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };
  const updateItem = (index: number, change: Partial<DraftItem>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...change } : item)));
    setSaved("");
    setToast("Task updated.");
  };
  const move = (index: number, delta: -1 | 1) => {
    setItems((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved("");
    setToast("Task order updated.");
  };
  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setImportNotice("");
    try {
      const parsed = parseTaskCsv(await file.text());
      if (parsed.tasks.length === 0) {
        setError("No task descriptions were found in that CSV file.");
        return;
      }
      setItems((current) => {
        const existing = current.filter((item) => item.description.trim());
        const imported = parsed.tasks.map((item) => ({ ...item, difficulty: "medium" as const }));
        return (importMode === "append" ? [...existing, ...imported] : imported).slice(0, 15);
      });
      setSaved("");
      const notes = [
        `${parsed.tasks.length} task${parsed.tasks.length === 1 ? "" : "s"} imported automatically.`,
        parsed.ignoredRows ? `${parsed.ignoredRows} empty row(s) ignored.` : "",
        parsed.truncatedRows ||
        (importMode === "append" &&
          items.filter((item) => item.description.trim()).length + parsed.tasks.length > 15)
          ? "Only the first 15 tasks were kept."
          : "",
      ].filter(Boolean);
      setImportNotice(notes.join(" "));
      setToast("CSV tasks imported.");
    } catch {
      setError("The CSV file could not be read. Check its format and try again.");
    }
  };
  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([sampleTaskCsv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "map-tasks-template.csv";
    link.click();
    URL.revokeObjectURL(url);
    setToast("Sample CSV downloaded.");
  };
  if (loading) return <SkeletonList count={6} />;
  return (
    <>
      <div className="editor-heading">
        <div>
          <Link href="/admin/task-packs">← All maps</Link>
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
      {error && (
        <Banner
          tone="danger"
          action={
            error.includes("elsewhere") ? (
              <Button variant="secondary" onClick={() => location.reload()}>
                Reload
              </Button>
            ) : undefined
          }
        >
          {error}
        </Banner>
      )}
      {saved && <Banner tone="success">{saved}</Banner>}
      {toast && (
        <div className="toast-stack">
          <Toast>{toast}</Toast>
        </div>
      )}
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <section className="card">
          <h2>Map details</h2>
          <Field
            label="Map name"
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved("");
            }}
            hint={`${name.length}/80 characters`}
            disabled={pack?.status === "archived"}
          />
          <TextArea
            label="Description"
            maxLength={1000}
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setSaved("");
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
              Choose a CSV and its rows are added to the table immediately. Headers such as
              <code> task</code>, <code>description</code>, <code>active</code>, and
              <code> status</code> are detected automatically.
            </p>
          </div>
          <div className="csv-import-actions">
            <label className="field compact-field">
              <span className="field-label">Import behavior</span>
              <select
                value={importMode}
                onChange={(event) => setImportMode(event.target.value as "replace" | "append")}
                disabled={pack?.status === "archived"}
              >
                <option value="replace">Replace current rows</option>
                <option value="append">Append to current rows</option>
              </select>
            </label>
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
              Download sample
            </Button>
          </div>
          {importNotice && <Banner tone="success">{importNotice}</Banner>}
        </section>
        <section className="card item-editor">
          <div className="section-heading">
            <div>
              <h2>Map task table</h2>
              <p className="muted">
                Up to 15 descriptions. Published packs require enough active items for supported
                games.
              </p>
            </div>
            <Badge>
              {items.filter((item) => item.isActive && item.description.trim()).length} active
            </Badge>
          </div>
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
                    <td className="drag-index">{index + 1}</td>
                    <td>
                      <label className="sr-only" htmlFor={`task-${index}`}>
                        Task {index + 1}
                      </label>
                      <input
                        id={`task-${index}`}
                        value={item.description}
                        maxLength={280}
                        placeholder="Enter a task players can prove with a photo"
                        onChange={(event) => {
                          updateItem(index, { description: event.target.value });
                        }}
                        disabled={pack?.status === "archived"}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`Task ${index + 1} difficulty`}
                        value={item.difficulty}
                        onChange={(event) =>
                          updateItem(index, { difficulty: event.target.value as TaskDifficulty })
                        }
                        disabled={pack?.status === "archived"}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </td>
                    <td>
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
                    <td>
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
                            setSaved("");
                            setItems((current) => current.filter((_, i) => i !== index));
                            setToast("Task removed.");
                          }}
                          disabled={items.length === 1 || pack?.status === "archived"}
                          aria-label={`Remove task ${index + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length < 15 && pack?.status !== "archived" && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSaved("");
                setItems((current) => [
                  ...current,
                  { description: "", isActive: true, difficulty: "medium" },
                ]);
                setToast("Task row added.");
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
                  label={`Role ${index + 1} name`}
                  maxLength={50}
                  value={role.name}
                  disabled={pack?.status === "archived"}
                  onChange={(event) => {
                    setRoles((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, name: event.target.value } : entry,
                      ),
                    );
                    setToast("Role updated.");
                  }}
                />
                <Field
                  label="Specialization"
                  maxLength={160}
                  value={role.specialization}
                  disabled={pack?.status === "archived"}
                  onChange={(event) => {
                    setRoles((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, specialization: event.target.value } : entry,
                      ),
                    );
                    setToast("Role updated.");
                  }}
                />
                <Field
                  label="Ability"
                  maxLength={200}
                  value={role.ability}
                  disabled={pack?.status === "archived"}
                  onChange={(event) => {
                    setRoles((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, ability: event.target.value } : entry,
                      ),
                    );
                    setToast("Role updated.");
                  }}
                />
                <Button
                  type="button"
                  variant="danger"
                  disabled={pack?.status === "archived"}
                  onClick={() => {
                    setRoles((current) => current.filter((_, i) => i !== index));
                    setToast("Role removed.");
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
                setToast("Role added.");
              }}
            >
              + Add crew role
            </Button>
          )}
        </section>
        <div className="save-bar">
          <span>{dirty ? "Unsaved changes" : "All changes saved"}</span>
          {pack?.status !== "archived" && (
            <Button type="submit" loading={busy} disabled={!dirty || Boolean(validation)}>
              Save changes
            </Button>
          )}
          {pack?.status === "draft" && (
            <Button
              type="button"
              variant="secondary"
              disabled={dirty}
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
            ? "The server will validate its active item count before making it available to rooms."
            : "Archiving is terminal. The pack will no longer be available for new rooms."
        }
        confirmLabel={confirm === "publish" ? "Publish map" : "Archive map"}
        dangerous={confirm === "archive"}
        loading={busy}
      />
    </>
  );
}
