// app/alerts/page.tsx
"use client";
import { useEffect, useState } from "react";

export default function AlertsPage() {
  const [data, setData] = useState<{
    pausedAccounts: any[];
    orphanedJobs: any[];
  }>({ pausedAccounts: [], orphanedJobs: [] });

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Alerts</h1>
      <h3>Paused Accounts</h3>
      {data.pausedAccounts.length === 0 && <p>None — good.</p>}
      {data.pausedAccounts.map((a) => (
        <div key={a.id} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
          {a.email} — {a.status} ({a.pausedReason})
        </div>
      ))}
      <h3 style={{ marginTop: 24 }}>Orphaned Queued Jobs</h3>
      {data.orphanedJobs.length === 0 && <p>None.</p>}
      {data.orphanedJobs.map((j: any) => (
        <div key={j.id} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
          {j.lead.email} — stuck on {j.account.email} ({j.account.status})
        </div>
      ))}
    </div>
  );
}
