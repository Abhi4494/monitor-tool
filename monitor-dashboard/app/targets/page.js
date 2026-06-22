"use client";

import { useEffect, useState } from "react";
import { fetchJSON, apiPost, apiPut, apiDelete } from "../../lib/api";
import Protected from "../../components/Protected";

const EMPTY = { name: "", type: "WEBSITE", url: "", emails: "", active: true };

// emails may arrive as an array or a JSON/CSV string (MariaDB JSON quirk).
function emailList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.length) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return value
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter(Boolean);
  }
  return [];
}

export default function TargetsPage() {
  const [targets, setTargets] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setTargets(await fetchJSON("/api/targets"));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function edit(t) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      type: t.type,
      url: t.url,
      emails: emailList(t.emails).join(", "),
      active: t.active,
    });
    setError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const payload = {
      name: form.name,
      type: form.type,
      url: form.url,
      emails: form.emails, // server splits on , ; or newline
      active: form.active,
    };
    try {
      if (editingId) {
        await apiPut(`/api/targets/${editingId}`, payload);
      } else {
        await apiPost("/api/targets", payload);
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(t) {
    if (!confirm(`Delete "${t.name}"? This stops monitoring it.`)) return;
    try {
      await apiDelete(`/api/targets/${t.id}`);
      if (editingId === t.id) resetForm();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleActive(t) {
    try {
      await apiPut(`/api/targets/${t.id}`, { active: !t.active });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Protected>
      <h1>Targets</h1>
      <p className="muted">
        Add websites and APIs to monitor. Each can notify its own list of emails
        (comma-separated). If left empty, the server&apos;s default ALERT_TO is used.
      </p>

      {error && <p className="form-error">{error}</p>}

      <form className="card target-form" onSubmit={save}>
        <h3 style={{ marginTop: 0 }}>{editingId ? "Edit target" : "Add target"}</h3>

        <div className="form-grid">
          <div>
            <label>Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Main Website"
              required
            />
          </div>

          <div>
            <label>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="WEBSITE">WEBSITE (HTTP + latency)</option>
              <option value="API">API (HTTP status)</option>
              <option value="BROWSER">BROWSER (Playwright)</option>
            </select>
          </div>
        </div>

        <label>URL</label>
        <input
          type="url"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="https://example.com"
          required
        />

        <label>Notification emails (comma-separated)</label>
        <input
          value={form.emails}
          onChange={(e) => setForm({ ...form, emails: e.target.value })}
          placeholder="alice@example.com, bob@example.com"
        />

        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Active (uncheck to pause monitoring)
        </label>

        <div className="form-actions">
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : editingId ? "Update target" : "Add target"}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>URL</th>
            <th>Emails</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {targets.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                No targets yet. Add one above.
              </td>
            </tr>
          ) : (
            targets.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.type}</td>
                <td className="muted">
                  <a className="url" href={t.url} target="_blank" rel="noreferrer">
                    {t.url}
                  </a>
                </td>
                <td className="muted">
                  {emailList(t.emails).length
                    ? emailList(t.emails).join(", ")
                    : "— (default)"}
                </td>
                <td>
                  <button
                    className={t.active ? "pill pill-on" : "pill pill-off"}
                    onClick={() => toggleActive(t)}
                    title="Toggle monitoring"
                  >
                    {t.active ? "Active" : "Paused"}
                  </button>
                </td>
                <td>
                  <button className="btn-link" onClick={() => edit(t)}>
                    Edit
                  </button>
                  <button className="btn-link danger" onClick={() => remove(t)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Protected>
  );
}
