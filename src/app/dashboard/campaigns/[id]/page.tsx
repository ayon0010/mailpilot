// app/campaigns/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [launchResult, setLaunchResult] = useState<any>(null);

  function loadCampaign() {
    fetch(`/api/campaigns/${id}`)
      .then((r) => r.json())
      .then((d) => setCampaign(d.campaign));
  }
  useEffect(() => {
    loadCampaign();
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) =>
        setAccounts(d.accounts.filter((a: any) => a.status === "active")),
      );
  }, [id]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (
      e.currentTarget.elements.namedItem("file") as HTMLInputElement
    ).files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("campaignId", id);
    const res = await fetch("/api/leads/upload", {
      method: "POST",
      body: formData,
    });
    setUploadResult(await res.json());
    loadCampaign();
  }

  async function handleLaunch() {
    const accountAllocations = Object.entries(allocations)
      .filter(([, count]) => count > 0)
      .map(([accountId, allocated]) => ({ accountId, allocated }));
    const res = await fetch(`/api/campaigns/${id}/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountAllocations }),
    });
    setLaunchResult(await res.json());
    loadCampaign();
  }

  if (!campaign) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 700 }}>
      <h1>{campaign.name}</h1>
      <p>
        Status: <strong>{campaign.status}</strong> · Leads:{" "}
        {campaign._count.leads} · Sends: {campaign._count.sendJobs}
      </p>

      {campaign.status === "draft" && (
        <>
          <h3>1. Upload leads</h3>
          <form onSubmit={handleUpload}>
            <input type="file" name="file" accept=".csv,.xlsx" required />
            <button type="submit">Upload</button>
          </form>
          {uploadResult && (
            <pre style={{ background: "#f5f5f5", padding: 8 }}>
              {JSON.stringify(uploadResult, null, 2)}
            </pre>
          )}

          <h3>2. Allocate sends per account</h3>
          {accounts.length === 0 && <p>No active accounts available.</p>}
          {accounts.map((a) => (
            <div key={a.id} style={{ marginBottom: 8 }}>
              <label>
                {a.email} (cap: {a.dailyLimit - a.sentToday} remaining today){" "}
                <input
                  type="number"
                  min={0}
                  style={{ width: 60 }}
                  value={allocations[a.id] || 0}
                  onChange={(e) =>
                    setAllocations({
                      ...allocations,
                      [a.id]: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          ))}

          <h3>3. Launch</h3>
          <button onClick={handleLaunch} disabled={campaign._count.leads === 0}>
            Launch Campaign
          </button>
          {launchResult && (
            <pre style={{ background: "#f5f5f5", padding: 8 }}>
              {JSON.stringify(launchResult, null, 2)}
            </pre>
          )}
        </>
      )}

      {campaign.status === "active" && <p>This campaign is already running.</p>}
    </div>
  );
}
