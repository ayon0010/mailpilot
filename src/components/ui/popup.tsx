"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RiDeleteBin6Line,
  RiFlipVerticalFill,
} from "@remixicon/react";
import { Switch } from "./switch";

// Google G Logo SVG
function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function MailboxSettingsModal() {
  const [fromName, setFromName] = useState("Jane at Example");
  const [dailyCap, setDailyCap] = useState("10");

  return (
    <Dialog>
      <DialogTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-slate-600"
        >
          <RiFlipVerticalFill className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] p-0 rounded-2xl gap-0 overflow-hidden bg-[#F8F9FB] border-none shadow-2xl">
        {/* Custom Header */}
        <div className="p-6 pb-4 relative">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <GoogleIcon />
              <span>Mailbox settings</span>
            </DialogTitle>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-sm text-slate-500">
                oliver.finch112@gmail.com
              </span>
              <Badge
                variant="outline"
                className="rounded-full border-emerald-300 bg-emerald-50 text-[11px] font-medium text-emerald-700 px-2.5 py-0.5 hover:bg-emerald-50"
              >
                Connected
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* Form Body - Scrollable Area */}
        <div className="px-6 space-y-4 max-h-[60vh] overflow-y-auto pr-4">
          {/* From Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              From name
            </label>
            <Input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className="bg-white border-[#DDA333] border-2 focus-visible:ring-0 focus-visible:border-[#DDA333] text-slate-800 rounded-xl h-11"
            />
          </div>
          {/* Numerical Inputs Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                Daily cap
              </label>
              <Input
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
                className="bg-[#F1F3F7] border-none focus-visible:ring-1 focus-visible:ring-slate-300 text-slate-700 rounded-xl h-11 text-center font-medium"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F1F3F7]/80 border border-slate-200/50 flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-slate-800">
                Pause this mailbox
              </h4>
              <p className="text-xs text-slate-500">
                Excludes it from campaigns without disconnecting.
              </p>
            </div>
            <Switch
              // checked={isPaused}
              // onCheckedChange={setIsPaused}
              className="data-[state=checked]:bg-amber-600"
            />
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 pt-2 pb-1">
            <Button
              variant="ghost"
              className="rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs font-medium h-9 px-3.5 ml-auto flex items-center gap-1.5"
            >
              <RiDeleteBin6Line className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </Button>
          </div>

          {/* Warning / Help text */}
          <p className="text-xs text-slate-500 pt-1">
            Conservative caps protect your sending reputation. Emails are spaced
            by a
          </p>
        </div>

        {/* Modal Footer */}
        <div className="p-6 pt-4 flex items-center justify-end gap-3 bg-[#F8F9FB]">
          <DialogClose>
            <Button
              variant="ghost"
              className="text-slate-800 hover:bg-slate-200/50 rounded-xl font-medium px-4"
            >
              Cancel
            </Button>
          </DialogClose>
          <Button className="rounded-xl bg-gradient-to-b from-[#E6BA5D] to-[#D8A23B] hover:from-[#DFB253] hover:to-[#CF9932] text-slate-900 font-medium px-5 h-10 shadow-sm transition-all border border-white/20">
            Save settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
