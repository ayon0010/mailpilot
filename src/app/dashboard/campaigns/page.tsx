/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { CampaignCard } from "@/components/CampaignCard";
import { useEffect, useState } from "react";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns));
  }, []);

  return (
    <div className="p-6">
      <div className="grid grid-cols-2 gap-6">
        {campaigns?.map((c, i) => {
          return <CampaignCard data={c} key={i} />;
        })}
      </div>
    </div>
  );
}
