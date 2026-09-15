"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLeadManagerRole } from "@/hooks/useLeadManagerRole";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutGrid,
  Users,
  X,
} from "lucide-react";

export function Sidebar({
  mobileNavOpen,
  setMobileNavOpen,
  desktopCollapsed,
  setDesktopCollapsed,
  companyInfo,
}: {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  desktopCollapsed: boolean;
  setDesktopCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  companyInfo?: any;
}) {
  const pathname = usePathname();
  const { isManager, isExecutive, roleLabel } = useLeadManagerRole();
  const lgW = desktopCollapsed ? "lg:w-[64px] lg:min-w-[64px]" : "lg:w-[14.5rem] lg:min-w-[14.5rem]";

  const companyLogoUrl = companyInfo?.logo_url || process.env.NEXT_PUBLIC_COMPANY_LOGO_URL || "";
  const companyTitle = companyInfo?.trade_name || companyInfo?.legal_name || process.env.NEXT_PUBLIC_COMPANY_NAME || "Portal";

  const isDashboardActive = pathname === "/dashboard";
  const isLeadsActive = pathname === "/dashboard/leads" || (pathname.startsWith("/dashboard/leads") && !pathname.includes("follow-ups") && !pathname.includes("reports"));
  const isFollowUpsActive = pathname.startsWith("/dashboard/leads/follow-ups");
  const isReportsActive = pathname.startsWith("/dashboard/leads/reports");
  const isQuotationsActive = pathname.startsWith("/dashboard/quotations");

  return (
    <>
      {/* Mobile Nav Overlay */}
      <div
        aria-hidden={!mobileNavOpen}
        className={[
          "fixed inset-0 z-[35] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside
        id="app-sidebar"
        className={[
          "fixed left-0 top-0 z-[40] flex h-[100vh] max-h-[100vh] min-h-0 w-[min(15rem,85vw)] flex-col overflow-hidden border-r border-border bg-card shadow-2xl transition-[transform,width,min-width] duration-300 ease-out",
          "lg:relative lg:z-0 lg:h-full lg:min-h-0 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none",
          lgW,
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* Company Header with Logo, Company Name & Portal Name */}
        <div className="relative flex shrink-0 flex-col gap-1 border-b border-border p-3.5">
          <div className="flex items-center justify-between gap-2">
            <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
              {companyLogoUrl ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-muted shadow-xs">
                  <img
                    src={companyLogoUrl}
                    alt={companyTitle}
                    className="h-full w-full object-contain p-1"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
                  <CheckSquare className="h-5 w-5" />
                </div>
              )}

              {!desktopCollapsed && (
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-xs font-black tracking-tight text-foreground uppercase truncate">
                    {companyTitle}
                  </span>
                  <span className="text-[10px] font-bold text-primary tracking-wider uppercase truncate mt-0.5">
                    Lead Manager Portal
                  </span>
                </div>
              )}
            </Link>

            <button
              type="button"
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted lg:hidden"
              onClick={() => setMobileNavOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className={`flex items-center justify-between px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted ${desktopCollapsed ? "hidden" : "flex"}`}>
            <span>Navigation</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${isManager ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20" : "bg-primary/15 text-primary border border-primary/20"}`}>
              {roleLabel}
            </span>
          </div>

          {/* Dashboard Overview */}
          <Link
            href="/dashboard"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isDashboardActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Dashboard Overview"
          >
            <LayoutGrid className={`h-4 w-4 shrink-0 ${isDashboardActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && <span>Dashboard</span>}
          </Link>

          {/* Leads */}
          <Link
            href="/dashboard/leads"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isLeadsActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Leads Pipeline"
          >
            <Users className={`h-4 w-4 shrink-0 ${isLeadsActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && <span>Leads</span>}
          </Link>

          {/* Follow-ups */}
          <Link
            href="/dashboard/leads/follow-ups"
            onClick={() => setMobileNavOpen(false)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              isFollowUpsActive
                ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
            }`}
            title="Follow-ups Calendar"
          >
            <CalendarDays className={`h-4 w-4 shrink-0 ${isFollowUpsActive ? "text-primary" : ""}`} />
            {!desktopCollapsed && <span>Follow-Ups</span>}
          </Link>

          {/* Sales Reports — managers (team) and executives (own data) */}
          {(isManager || isExecutive) && (
            <Link
              href="/dashboard/leads/reports"
              onClick={() => setMobileNavOpen(false)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                isReportsActive
                  ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                  : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
              }`}
              title={isExecutive && !isManager ? "My Reports" : "Sales Reports"}
            >
              <BarChart3 className={`h-4 w-4 shrink-0 ${isReportsActive ? "text-primary" : ""}`} />
              {!desktopCollapsed && <span>{isExecutive && !isManager ? "My Reports" : "Reports"}</span>}
            </Link>
          )}

          {/* Quotations (Manager only — not shown to executives) */}
          {!isExecutive && (
            <Link
              href="/dashboard/quotations"
              onClick={() => setMobileNavOpen(false)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                isQuotationsActive
                  ? "bg-primary/15 border border-primary/30 text-primary font-bold shadow-xs"
                  : "text-muted hover:bg-surface-muted hover:text-foreground border border-transparent"
              }`}
              title="Quotations"
            >
              <FileText className={`h-4 w-4 shrink-0 ${isQuotationsActive ? "text-primary" : ""}`} />
              {!desktopCollapsed && <span>Quotations</span>}
            </Link>
          )}
        </div>

        {/* Footer Collapse Toggle */}
        <div className="mt-auto hidden border-t border-border p-2 lg:flex">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
            onClick={() => setDesktopCollapsed((c) => !c)}
            title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {desktopCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 text-muted" />}
            {!desktopCollapsed && <span className="text-xs font-medium">Collapse Menu</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
