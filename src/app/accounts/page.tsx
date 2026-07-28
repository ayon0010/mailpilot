// app/accounts/page.tsx
"use client";
import { useEffect, useState } from "react";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);

  function load() {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts));
  }
  useEffect(() => {
    load();
  }, []);

  async function updateDailyLimit(id: string, value: number) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyLimit: value }),
    });
    load();
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const next = currentStatus === "paused" ? "active" : "paused";
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  async function updateDisplayName(id: string, value: string) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: value }),
    });
    load();
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Accounts</h1>
      <a href="/api/auth/gmail/connect">+ Connect Gmail Account</a>
      <table
        style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Email</th>
            <th>Display Name</th>
            <th>Status</th>
            <th>Warmup</th>
            <th>Daily Limit</th>
            <th>Sent Today</th>
            <th>7d Replies</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{a.email}</td>
              <td>
                <input
                  defaultValue={a.displayName}
                  placeholder="e.g. Ethan"
                  style={{ width: 100 }}
                  onBlur={(e) => updateDisplayName(a.id, e.target.value)}
                />
              </td>
              <td>{a.status}</td>
              <td>{a.warmupEnabled ? `day ${a.warmupDay}` : "graduated"}</td>
              <td>
                <input
                  type="number"
                  defaultValue={a.dailyLimit}
                  style={{ width: 60 }}
                  onBlur={(e) => updateDailyLimit(a.id, Number(e.target.value))}
                />
              </td>
              <td>{a.sentToday}</td>
              <td>{a.replyCount7d}</td>
              <td>
                {(a.status === "active" || a.status === "paused") && (
                  <button onClick={() => toggleStatus(a.id, a.status)}>
                    {a.status === "paused" ? "Reactivate" : "Pause"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
