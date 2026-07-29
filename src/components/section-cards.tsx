"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RiMailAiLine,
  RiSendInsFill,
  RiSendPlane2Fill,
  RiUser2Line,
} from "@remixicon/react";
import { Button } from "./ui/button";
import Link from "next/link";

export function MailboxCard() {
  return (
    <Card className="flex flex-1 flex-col justify-between">
      <CardHeader>
        <div className="flex items-center gap-2">
          <RiMailAiLine className="h-5 w-5 text-amber-700" />
          <CardTitle className="text-lg font-bold">Mailboxes</CardTitle>
        </div>
        <CardDescription>The accounts you send campaigns from.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">1</span>
          <span className="text-sm text-muted-foreground">of 1 connected</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Connected</span>
            <span className="font-semibold">1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Need attention</span>
            <span className="font-semibold">0</span>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Link className="w-full" href={"/dashboard/mailboxes"}>
          <Button variant="outline" className="w-full">
            Manage mailboxes
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

export function SendsThisMonthCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sends This Month
        </CardTitle>
        <div className="rounded-md bg-amber-100/60 p-2 text-amber-800">
          <RiSendInsFill className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">0</div>
        <p className="mt-2 text-xs text-muted-foreground">
          No campaigns launched yet
        </p>
      </CardContent>
    </Card>
  );
}

export function ContactsCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contacts
        </CardTitle>
        <div className="rounded-md bg-amber-100/60 p-2">
          <RiUser2Line className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">1</div>
        <p className="mt-2 text-xs text-muted-foreground">
          1 sendable · 0 suppressed
        </p>
      </CardContent>
    </Card>
  );
}

export function CampaignsCard() {
  return (
    <Card className="flex flex-1 flex-col justify-between">
      <CardHeader>
        <div className="flex items-center gap-2">
          <RiSendPlane2Fill className="h-5 w-5 rotate-45 text-amber-800" />
          <CardTitle className="text-lg font-bold">Campaigns</CardTitle>
        </div>
        <CardDescription>What's live and what's in the works.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">1</span>
          <span className="text-sm text-muted-foreground">active now</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Drafts</span>
            <span className="font-semibold">0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">1</span>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button variant="outline" className="w-full">
          View campaigns
        </Button>
      </CardFooter>
    </Card>
  );
}

export function SectionCards() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      <div className="grid grid-cols-4 gap-6">
        <ContactsCard />
        <SendsThisMonthCard />
      </div>
      <div className="flex items-center gap-6 w-full">
        <MailboxCard />
        <CampaignsCard />
      </div>
    </div>
  );
}
