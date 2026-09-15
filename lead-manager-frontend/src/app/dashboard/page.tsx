"use client";

import Link from "next/link";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import LeadManagerStatsWidgets from "@/components/leads/LeadManagerStatsWidgets";
import { Users, CalendarDays, Plus, BarChart3 } from "lucide-react";

export default function DashboardPage() {
  const { user, isManager, isExecutive, roleLabel } = useLeadManagerRole();

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-primary/90 via-primary to-primary-hover p-6 text-primary-foreground shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back, {user?.name || "User"}!
            </h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
              isManager ? "bg-amber-400 text-slate-900" : "bg-blue-400 text-slate-900"
            }`}>
              {roleLabel} Access
            </span>
          </div>
          <p className="mt-1 text-xs opacity-90 max-w-xl">
            {isManager
              ? "Lead Manager Control Center — Track team pipeline performance, manage lead sources, assign leads to executives, and analyze conversion metrics."
              : "Executive Lead Center — Manage your assigned leads, execute scheduled follow-ups, and track your personal pipeline performance."}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isManager ? (
            <>
              <Link
                href="/dashboard/leads"
                className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <Users className="h-4 w-4" />
                Team Pipeline
              </Link>
              <Link
                href="/dashboard/leads/reports"
                className="flex items-center gap-2 rounded-xl bg-white text-primary px-4 py-2 text-xs font-bold hover:bg-white/90 shadow-md transition"
              >
                <BarChart3 className="h-4 w-4" />
                Sales Analytics
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/dashboard/leads/new"
                className="flex items-center gap-2 rounded-xl bg-white text-primary px-4 py-2 text-xs font-bold hover:bg-white/90 shadow-md transition"
              >
                <Plus className="h-4 w-4" />
                Create Lead
              </Link>
              <Link
                href="/dashboard/leads/follow-ups"
                className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
              >
                <CalendarDays className="h-4 w-4" />
                My Follow-Ups
              </Link>
              {isExecutive && (
                <Link
                  href="/dashboard/leads/reports"
                  className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 border border-white/20 transition"
                >
                  <BarChart3 className="h-4 w-4" />
                  My Reports
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Stats Widgets */}
      <LeadManagerStatsWidgets
        portalHome="/dashboard"
        assigned_to={isManager ? undefined : user?._id}
      />
    </div>
  );
}
