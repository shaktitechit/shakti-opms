"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Loader2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  CheckSquare,
  Briefcase,
  TrendingUp,
  ShieldCheck,
  Award,
  Layers,
  Calendar,
  User,
  Compass,
} from "lucide-react";
import {
  useGetSinglePlanAiAnalysisQuery,
  useRegenerateCaliberAnalyticsMutation,
} from "@/store/api/workPlannerApiSlice";
import { formatPlanDate } from "./workPlanUtils";
import { toast } from "sonner";
import { AiAnalysisLoader } from "./AiAnalysisLoader";

export interface PlanAiAnalysisModalProps {
  open: boolean;
  planId: string;
  planDate?: string;
  executiveName?: string;
  onClose: () => void;
}

export function PlanAiAnalysisModal({
  open,
  planId,
  planDate,
  executiveName,
  onClose,
}: PlanAiAnalysisModalProps) {
  const [activeTab, setActiveTab] = useState<"holistic" | "visits" | "tasks" | "coaching">("holistic");
  const { data: analysisData, isLoading, isFetching, refetch } = useGetSinglePlanAiAnalysisQuery(
    { planId },
    { skip: !open || !planId }
  );
  const [regenerateMut, { isLoading: regenerating }] = useRegenerateCaliberAnalyticsMutation();

  if (!open) return null;

  const assessment = analysisData?.assessment;
  const overall = assessment?.overallCaliberReport;
  const visits = assessment?.visitsReport;
  const tasks = assessment?.tasksReport;
  const synergy = assessment?.crossTrackSynergy;
  const coaching = assessment?.managerCoachingPlaybook;
  const actionPlan = assessment?.executiveActionPlan;

  const handleRegenerate = async () => {
    try {
      await regenerateMut({ plan_id: planId }).unwrap();
      toast.success("AI 360° Analysis regenerated successfully!");
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to regenerate AI analysis");
    }
  };

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case "Exceptional":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "High Performer":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "Consistent":
        return "bg-primary/15 text-primary border-primary/30";
      case "Needs Coaching":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      default:
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs font-sans animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">360° AI Work Plan &amp; Caliber Analysis</h2>
                {overall?.tier && (
                  <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${getTierBadge(overall.tier)}`}>
                    {overall.tier}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">
                {executiveName ? `${executiveName} • ` : ""}{planDate ? `Work Plan (${formatPlanDate(planDate)})` : "Performance Evaluation"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating || isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-surface-muted text-xs font-semibold text-foreground transition shadow-2xs cursor-pointer"
              title="Force AI re-evaluation"
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 text-muted" />
              )}
              <span>{regenerating ? "Analyzing…" : "Regenerate"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-border px-6 bg-surface-muted/20 overflow-x-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("holistic")}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === "holistic"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Compass className="h-4 w-4" />
            Complete Plan Assessment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("visits")}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === "visits"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <MapPin className="h-4 w-4" />
            Field Visits Report
            {visits?.score !== undefined && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/10 border border-blue-500/20 font-bold">
                {visits.score}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === "tasks"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            Tasks Execution Report
            {tasks?.score !== undefined && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 border border-primary/20 font-bold">
                {tasks.score}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("coaching")}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === "coaching"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Coaching &amp; Action Plan
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading || regenerating ? (
            <AiAnalysisLoader
              title="Evaluating Work Plan with OpenAI…"
              subtitle="Scrutinizing daily plan intent, client meeting outcomes, task heads, and senior manager remarks."
            />
          ) : !assessment ? (
            <div className="text-center py-12 text-muted text-xs">
              No analysis data available for this work plan. Click Regenerate to run evaluation.
            </div>
          ) : (
            <>
              {/* TAB 1: Complete Work Plan Holistic Evaluation */}
              {activeTab === "holistic" && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Hero Score Banner */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 shadow-xs">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-card border border-border shadow-xs text-xl font-extrabold text-foreground">
                        {overall?.score ?? 0}
                        <span className="text-[10px] text-muted font-normal">/100</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">Overall 360° Caliber Rating</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getTierBadge(overall?.tier)}`}>
                            {overall?.tier}
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-1 leading-relaxed max-w-lg">
                          {overall?.executiveSummary}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 6 Dimensions Grid */}
                  {overall?.dimensionRatings && (
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Core Competency Matrix (Scale 1–10)
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="rounded-lg bg-surface-muted/60 p-2.5 border border-border">
                          <span className="text-[11px] text-muted block">Planning Rigor</span>
                          <span className="text-sm font-bold text-foreground">{overall.dimensionRatings.planningRigor} / 10</span>
                        </div>
                        <div className="rounded-lg bg-surface-muted/60 p-2.5 border border-border">
                          <span className="text-[11px] text-muted block">Execution Discipline</span>
                          <span className="text-sm font-bold text-foreground">{overall.dimensionRatings.executionDiscipline} / 10</span>
                        </div>
                        <div className="rounded-lg bg-surface-muted/60 p-2.5 border border-border">
                          <span className="text-[11px] text-muted block">Client Engagement</span>
                          <span className="text-sm font-bold text-foreground">{overall.dimensionRatings.clientEngagement} / 10</span>
                        </div>
                        <div className="rounded-lg bg-surface-muted/60 p-2.5 border border-border">
                          <span className="text-[11px] text-muted block">Task Velocity</span>
                          <span className="text-sm font-bold text-foreground">{overall.dimensionRatings.taskVelocity} / 10</span>
                        </div>
                        <div className="rounded-lg bg-surface-muted/60 p-2.5 border border-border">
                          <span className="text-[11px] text-muted block">Reporting Integrity</span>
                          <span className="text-sm font-bold text-foreground">{overall.dimensionRatings.reportingTransparency} / 10</span>
                        </div>
                        <div className="rounded-lg bg-surface-muted/60 p-2.5 border border-border">
                          <span className="text-[11px] text-muted block">Coachability</span>
                          <span className="text-sm font-bold text-foreground">{overall.dimensionRatings.seniorCoachability} / 10</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Strengths & Blind Spots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Demonstrated Strengths</span>
                      </div>
                      <ul className="space-y-1 text-xs text-muted">
                        {overall?.coreStrengths?.map((s: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-500 shrink-0">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Critical Blind Spots</span>
                      </div>
                      <ul className="space-y-1 text-xs text-muted">
                        {overall?.criticalBlindSpots?.map((b: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-500 shrink-0">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Dedicated Field Visits Report */}
              {activeTab === "visits" && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Field Visits &amp; Commercial Acumen Score</span>
                      <p className="text-xs text-muted mt-0.5">{visits?.commercialAcumenSummary}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-2xl font-black text-foreground">{visits?.score ?? 0}</span>
                      <span className="text-xs text-muted">/100</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <h5 className="text-xs font-bold text-foreground">Pipeline Dynamics (Hunting vs Farming)</h5>
                      <p className="text-xs text-muted leading-relaxed">{visits?.pipelineDynamicsAnalysis}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <h5 className="text-xs font-bold text-foreground">Geo-Discipline &amp; Punctuality</h5>
                      <p className="text-xs text-muted leading-relaxed">{visits?.geoDisciplineCritique}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <h5 className="text-xs font-bold text-foreground">Client Meeting Outcomes &amp; Follow-up Quality</h5>
                    <p className="text-xs text-muted leading-relaxed">{visits?.meetingOutcomesCritique}</p>
                  </div>
                </div>
              )}

              {/* TAB 3: Dedicated Tasks Execution Report */}
              {activeTab === "tasks" && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 p-4">
                    <div>
                      <span className="text-xs font-bold text-primary">Task Velocity &amp; Operational Throughput Score</span>
                      <p className="text-xs text-muted mt-0.5">{tasks?.operationalVelocitySummary}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-2xl font-black text-foreground">{tasks?.score ?? 0}</span>
                      <span className="text-xs text-muted">/100</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <h5 className="text-xs font-bold text-foreground">Throughput &amp; Velocity Critique</h5>
                      <p className="text-xs text-muted leading-relaxed">{tasks?.throughputCritique}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <h5 className="text-xs font-bold text-foreground">Task Rollover &amp; Delay Diagnosis</h5>
                      <p className="text-xs text-muted leading-relaxed">{tasks?.rolloverDiagnosis}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <h5 className="text-xs font-bold text-foreground">Proactive Initiative vs. Routine Duties</h5>
                    <p className="text-xs text-muted leading-relaxed">{tasks?.initiativeVsRoutineCritique}</p>
                  </div>
                </div>
              )}

              {/* TAB 4: Manager Coaching & Action Plan */}
              {activeTab === "coaching" && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Cross-Track Archetype */}
                  {synergy && (
                    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          Cross-Track Synergy Archetype
                        </span>
                        <span className="text-xs font-extrabold text-foreground">{synergy.archetype}</span>
                      </div>
                      <p className="text-xs text-muted leading-relaxed">{synergy.synergyVerdict}</p>
                    </div>
                  )}

                  {/* Manager Directives */}
                  <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Manager's Confidential Coaching Directives
                    </h5>
                    <ul className="space-y-1.5 text-xs text-muted">
                      {coaching?.confidentialDirectives?.map((d: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="font-bold text-primary">{idx + 1}.</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Executive Action Plan */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                    <h5 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Award className="h-4 w-4" />
                      Executive 30-Day Action Targets
                    </h5>
                    <ul className="space-y-1.5 text-xs text-muted">
                      {actionPlan?.primaryGoals?.map((g: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3 bg-surface-muted/30 text-[11px] text-muted">
          <span>
            {analysisData?.isCached
              ? `Cached assessment (Refreshed ${analysisData?.cachedAt ? new Date(analysisData.cachedAt).toLocaleTimeString() : ""})`
              : "Live AI-Evaluated Assessment"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-border bg-card hover:bg-surface-muted text-xs font-semibold text-foreground transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
