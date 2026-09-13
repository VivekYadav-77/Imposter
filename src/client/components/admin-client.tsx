"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "./ui";

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
      <h1>Task-pack administration</h1>
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
  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Task packs</h1>
        </div>
        <div>
          <Button variant="secondary" onClick={() => void logout()}>
            Log out
          </Button>
          <Link className="button button-primary" href="/admin/task-packs/new">
            New draft
          </Link>
        </div>
      </div>
      <section className="filter-bar" aria-label="Task pack filters">
        <Field
          label="Search"
          placeholder="Pack name"
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
          title="No task packs found"
          description="Change the filters or create a new draft."
          action={
            <Link className="button button-primary" href="/admin/task-packs/new">
              Create draft
            </Link>
          }
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Active items</th>
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
}
export function AdminEditor({ packId }: { packId?: string }) {
  const router = useRouter();
  const [pack, setPack] = useState<AdminPack | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ description: "", isActive: true }]);
  const [loading, setLoading] = useState(Boolean(packId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [confirm, setConfirm] = useState<"publish" | "archive" | null>(null);
  const [baseline, setBaseline] = useState("");
  const serialized = useMemo(
    () => JSON.stringify({ name, description, items }),
    [name, description, items],
  );
  const dirty = Boolean(baseline && serialized !== baseline);
  useEffect(() => {
    if (!packId) {
      const initial = JSON.stringify({
        name: "",
        description: "",
        items: [{ description: "", isActive: true }],
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
          .map((item) => ({ description: item.description, isActive: item.isActive }));
        setPack(next);
        setName(next.name);
        setDescription(next.description ?? "");
        setItems(nextItems);
        setBaseline(
          JSON.stringify({
            name: next.name,
            description: next.description ?? "",
            items: nextItems,
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
  const validation = name.trim()
    ? items.some((item) => item.description.trim())
      ? ""
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
      };
      const next = pack
        ? (await adminApi.update(pack.id, { ...body, expectedRevision: pack.revision })).data
        : (await adminApi.create(body)).data;
      setPack(next);
      const nextItems = next.items
        .sort((a, b) => a.position - b.position)
        .map((item) => ({ description: item.description, isActive: item.isActive }));
      setItems(nextItems);
      setName(next.name);
      setDescription(next.description ?? "");
      setBaseline(
        JSON.stringify({ name: next.name, description: next.description ?? "", items: nextItems }),
      );
      setSaved("Changes saved.");
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
    } catch (e) {
      setError(errorMessage(e));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };
  const updateItem = (index: number, change: Partial<DraftItem>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...change } : item)));
  const move = (index: number, delta: -1 | 1) =>
    setItems((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  if (loading) return <SkeletonList count={6} />;
  return (
    <>
      <div className="editor-heading">
        <div>
          <Link href="/admin/task-packs">← All task packs</Link>
          <p className="eyebrow">
            {pack ? `${pack.status} · revision ${pack.revision}` : "New draft"}
          </p>
          <h1>{pack ? pack.name : "Create a task pack"}</h1>
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
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <section className="card">
          <h2>Pack details</h2>
          <Field
            label="Name"
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
        <section className="card item-editor">
          <div className="section-heading">
            <div>
              <h2>Ordered tasks</h2>
              <p className="muted">
                Up to 15 descriptions. Published packs require enough active items for supported
                games.
              </p>
            </div>
            <Badge>
              {items.filter((item) => item.isActive && item.description.trim()).length} active
            </Badge>
          </div>
          {items.map((item, index) => (
            <div className="item-row" key={index}>
              <span className="drag-index">{index + 1}</span>
              <Field
                label={`Task ${index + 1}`}
                value={item.description}
                maxLength={280}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                disabled={pack?.status === "archived"}
              />
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={item.isActive}
                  onChange={(e) => updateItem(index, { isActive: e.target.checked })}
                  disabled={pack?.status === "archived"}
                />
                <span>Active</span>
              </label>
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
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  disabled={items.length === 1 || pack?.status === "archived"}
                  aria-label={`Remove task ${index + 1}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          {items.length < 15 && pack?.status !== "archived" && (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setItems((current) => [...current, { description: "", isActive: true }])
              }
            >
              Add task
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
              Publish pack
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
        title={confirm === "publish" ? "Publish this pack?" : "Archive this pack?"}
        description={
          confirm === "publish"
            ? "The server will validate its active item count before making it available to rooms."
            : "Archiving is terminal. The pack will no longer be available for new rooms."
        }
        confirmLabel={confirm === "publish" ? "Publish pack" : "Archive pack"}
        dangerous={confirm === "archive"}
        loading={busy}
      />
    </>
  );
}
