/* eslint-disable @typescript-eslint/no-explicit-any */
// app/campaigns/page.tsx
"use client";
import { useEffect, useState } from "react";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns));
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Campaigns</h1>
      <table
        style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Name</th>
            <th>Status</th>
            <th>Leads</th>
            <th>Sends</th>
            <th>Follow-up Days</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{c.name}</td>
              <td>{c.status}</td>
              <td>{c._count.leads}</td>
              <td>{c._count.sendJobs}</td>
              <td>{c.followUpDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
