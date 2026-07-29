"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { RiMore2Line } from "@remixicon/react";

interface CampaignCardProps {
  id: string;
  name?: string;
  status?: string;
}

interface StateDataType {
  recipientCount: number;
  sent: number;
  queued: number;
  failed: number;
}

export function CampaignCard({ data }: { data: CampaignCardProps }) {
  const [stateData, setStateData] = useState<StateDataType>();

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch(`/api/campaigns/${data?.id}/states`);
      const stateData = await response.json();
      setStateData(stateData);
    };
    fetchData();
  }, [data?.id]);

  console.log(stateData);

  return (
    <Card className="w-full hover:shadow-md hover:-translate-y-1 transition-all duration-400 max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <CardContent className="p-0 space-y-4">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold tracking-tight text-slate-900">
            {data.name}
          </h3>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className="rounded-full capitalize border-emerald-300 bg-emerald-50 px-3 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              {data?.status}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <RiMore2Line className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Progress Bar Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm font-medium text-slate-600">
            <span>Complete</span>
            <span className="font-semibold text-slate-900">{40}%</span>
          </div>

          {/* Custom Styled Progress Bar with Gold/Amber Accent */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-[#DDA333] to-[#C88E22] transition-all duration-300 rounded-full"
              style={{ width: `${40}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2 pt-2 text-center">
          <div className="space-y-1">
            <div className="text-xl font-bold text-slate-900">
              {stateData?.recipientCount}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Recipients
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xl font-bold text-slate-900">
              {stateData?.sent}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Sent
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xl font-bold text-slate-900">
              {stateData?.queued}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Queued
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xl font-bold text-slate-900">
              {stateData?.failed}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Failed
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
