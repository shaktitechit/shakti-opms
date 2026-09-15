"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  FileText,
  CreditCard,
  Palette,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Globe,
  Mail,
  Phone,
  ShieldCheck,
  Plus,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Copy,
  Check,
  Users,
  Package,
  ShoppingCart,
  Truck,
  ClipboardList,
  DollarSign,
  BarChart3,
  Sparkles,
  Pipette,
  Landmark,
  MapPin,
} from "lucide-react";
import { API_BASE, getAuthHeaders } from "@/utils/apiHelpers";

export const THEME_PALETTES = [
  { id: "default", name: "Default (Indigo Violet)", primary: "#636ccb", secondary: "#6e8cfb", description: "Standard brand palette" },
  { id: "indigo", name: "Royal Indigo", primary: "#4f46e5", secondary: "#818cf8", description: "Deep indigo with vibrant accents" },
  { id: "blue", name: "Ocean Blue", primary: "#2563eb", secondary: "#60a5fa", description: "Corporate ocean blue tone" },
  { id: "emerald", name: "Emerald Teal", primary: "#059669", secondary: "#34d399", description: "Fresh emerald green & mint" },
  { id: "rose", name: "Crimson Rose", primary: "#e11d48", secondary: "#fb7185", description: "Modern crimson red accent" },
  { id: "amber", name: "Warm Amber", primary: "#d97706", secondary: "#fbbf24", description: "Golden amber & warm orange" },
];

export function CompanyInfoView({
  token,
  onCompanyInfoUpdated,
}: {
  token: string;
  onCompanyInfoUpdated?: (info: any) => void;
}) {
  const [formData, setFormData] = useState<any>({
    legal_name: "",
    trade_name: "",
    gstin: "",
    cin: "",
    pan: "",
    drug_license: "",
    fssai_license: "",
    email: "",
    billing_email: "",
    phone: "",
    website: "",
    logo_url: "",
    favicon_url: "",
    primary_color: "#636ccb",
    secondary_color: "#6e8cfb",
    theme_palette: "default",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "",
    currency: "",
    timezone: "",
    financial_year: "",
    invoice_footer_note: "",
    bank_name: "",
    account_name: "",
    account_number: "",
    ifsc_code: "",
    branch_name: "",
    account_type: "Current Account",
    upi_id: "",
    swift_code: "",
    quotation_terms: [],
  });

  const [parentCompanyData, setParentCompanyData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newTerm, setNewTerm] = useState("");

  const fetchCompanyInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/company-info`, {
        headers: getAuthHeaders(token),
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch company information (Status ${res.status})`);
      }

      const data = await res.json();
      if (data?.data) {
        setFormData({
          legal_name: data.data.legal_name || "",
          trade_name: data.data.trade_name || "",
          gstin: data.data.gstin || "",
          cin: data.data.cin || "",
          pan: data.data.pan || "",
          drug_license: data.data.drug_license || "",
          fssai_license: data.data.fssai_license || "",
          email: data.data.email || "",
          billing_email: data.data.billing_email || "",
          phone: data.data.phone || "",
          website: data.data.website || "",
          logo_url: data.data.logo_url || "",
          favicon_url: data.data.favicon_url || "",
          primary_color: data.data.primary_color || "#636ccb",
          secondary_color: data.data.secondary_color || "#6e8cfb",
          theme_palette: data.data.theme_palette || "default",
          address: data.data.address || "",
          city: data.data.city || "",
          state: data.data.state || "",
          pincode: data.data.pincode || "",
          country: data.data.country || "",
          currency: data.data.currency || "",
          timezone: data.data.timezone || "",
          financial_year: data.data.financial_year || "",
          invoice_footer_note: data.data.invoice_footer_note || "",
          bank_name: data.data.bank_name || "",
          account_name: data.data.account_name || "",
          account_number: data.data.account_number || "",
          ifsc_code: data.data.ifsc_code || "",
          branch_name: data.data.branch_name || "",
          account_type: data.data.account_type || "Current Account",
          upi_id: data.data.upi_id || "",
          swift_code: data.data.swift_code || "",
          quotation_terms: Array.isArray(data.data.quotation_terms) ? data.data.quotation_terms : [],
        });
        if (onCompanyInfoUpdated) {
          onCompanyInfoUpdated(data.data);
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Error fetching company info.");
    } finally {
      setIsLoading(false);
    }
  }, [token, onCompanyInfoUpdated]);

  const fetchCompanyData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const res = await fetch(`${API_BASE}/api/company-info/data`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.data) {
          setParentCompanyData(data.data);
        }
      }
    } catch (e) {
      console.warn("Could not fetch company aggregated data:", e);
    } finally {
      setIsLoadingData(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCompanyInfo();
    fetchCompanyData();
  }, [fetchCompanyInfo, fetchCompanyData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handleSelectPalette = (preset: typeof THEME_PALETTES[0]) => {
    const next = {
      ...formData,
      theme_palette: preset.id,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
    };
    setFormData(next);
    if (onCompanyInfoUpdated) {
      onCompanyInfoUpdated(next);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: "logo_url" | "favicon_url") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image file size should be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setFormData((prev: any) => ({ ...prev, [field]: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddTerm = () => {
    if (!newTerm.trim()) return;
    setFormData((prev: any) => ({
      ...prev,
      quotation_terms: [...(prev.quotation_terms || []), newTerm.trim()],
    }));
    setNewTerm("");
  };

  const handleRemoveTerm = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      quotation_terms: prev.quotation_terms.filter((_: any, i: number) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/company-info`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || `Failed to update company info (Status ${res.status})`);
      }

      setSuccessMsg("Company Information & Theme Settings saved successfully!");
      if (data?.data) {
        setFormData((prev: any) => ({ ...prev, ...data.data }));
        if (onCompanyInfoUpdated) {
          onCompanyInfoUpdated(data.data);
        }
      }
      fetchCompanyData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save company information.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted">Loading Company Information & System Metrics...</p>
        </div>
      </div>
    );
  }

  const metrics = parentCompanyData?.metrics;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Action Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Building2 className="h-5 w-5 text-primary" />
            Super Admin Organization & Company Profile
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Central management for parent organization identity, branding, taxation, bank credentials, and live metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              fetchCompanyInfo();
              fetchCompanyData();
            }}
            disabled={isLoading || isSaving}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading || isLoadingData ? "animate-spin" : ""}`} />
            Sync & Refresh
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-primary transition active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All Settings
          </button>
        </div>
      </div>

      {/* Hero Organization Banner */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20 border border-primary/30 text-primary shadow-md">
              {formData.logo_url ? (
                <img src={formData.logo_url} alt="Logo" className="h-full w-full object-contain p-1 rounded-xl" />
              ) : (
                <Building2 className="h-7 w-7" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-foreground">
                  {formData.legal_name || "Parent Company & Organization Root"}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 border border-primary/30 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                  <ShieldCheck className="h-3 w-3" /> Parent Entity
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Trade Brand: <strong className="font-semibold text-foreground">{formData.trade_name || "Not configured"}</strong> | Central parent entity for all system domains
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy(JSON.stringify({ company_info: formData, metrics }, null, 2), "Full Company JSON")}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
            >
              <Copy className="h-3.5 w-3.5 text-muted" />
              {copiedKey === "Full Company JSON" ? "Copied JSON!" : "Export JSON"}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Live System Metrics Suite */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Parent Company Data & System Metrics
            </h4>
          </div>
          <span className="text-3xs text-muted">Live aggregation across system domains</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Users Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-bold uppercase tracking-wider text-muted">Users & Team</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-foreground">{metrics?.users?.total ?? 0}</span>
              <span className="text-3xs font-semibold text-emerald-400">{metrics?.users?.active ?? 0} active</span>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-3xs font-medium text-primary">
                Sales: {metrics?.users?.departments?.sales ?? 0}
              </span>
              <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-3xs font-medium text-blue-400">
                Admin: {metrics?.users?.departments?.admin ?? 0}
              </span>
            </div>
          </div>

          {/* Parties Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-bold uppercase tracking-wider text-muted">Parties / Clients</span>
              <Building2 className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-foreground">{metrics?.parties?.total ?? 0}</span>
              <span className="text-3xs font-medium text-muted">Accounts</span>
            </div>
            <div className="text-3xs text-muted pt-1">
              {metrics?.parties?.by_type?.customer ?? 0} Clients • {metrics?.parties?.by_type?.supplier ?? 0} Suppliers
            </div>
          </div>

          {/* Product Catalog Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-bold uppercase tracking-wider text-muted">Product Catalog</span>
              <Package className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-foreground">{metrics?.catalog?.total_products ?? 0}</span>
              <span className="text-3xs font-medium text-muted">SKUs</span>
            </div>
            <div className="text-3xs text-muted pt-1">
              {metrics?.catalog?.total_groups ?? 0} Groups • {metrics?.catalog?.total_brands ?? 0} Brands
            </div>
          </div>

          {/* Orders Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-bold uppercase tracking-wider text-muted">Orders & Volume</span>
              <ShoppingCart className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-foreground">{metrics?.orders?.total ?? 0}</span>
              <span className="text-3xs font-medium text-muted">Orders</span>
            </div>
            <div className="text-3xs font-bold text-foreground truncate pt-1">
              Vol: ₹{(metrics?.orders?.total_revenue || 0).toLocaleString("en-IN")}
            </div>
          </div>

          {/* Fleet & Transport Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-bold uppercase tracking-wider text-muted">Fleet & Transport</span>
              <Truck className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-foreground">{metrics?.fleet?.vehicles ?? 0}</span>
              <span className="text-3xs font-medium text-muted">Vehicles</span>
            </div>
            <div className="text-3xs text-muted pt-1">
              {metrics?.fleet?.drivers ?? 0} Drivers • {metrics?.fleet?.transport_agents ?? 0} Agents
            </div>
          </div>

          {/* Field Operations Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-bold uppercase tracking-wider text-muted">Field Operations</span>
              <ClipboardList className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-foreground">{metrics?.field_operations?.work_plans ?? 0}</span>
              <span className="text-3xs font-medium text-muted">Work Plans</span>
            </div>
            <div className="text-3xs text-muted pt-1">
              {metrics?.field_operations?.visits ?? 0} Client Visits
            </div>
          </div>

          {/* Financials Card */}
          <div className="col-span-2 rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-bold uppercase tracking-wider text-muted">Financial & Billing Tracking</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="block text-3xs text-muted">Open Unbilled Orders</span>
                <span className="text-base font-bold text-foreground">{metrics?.financials?.unbilled_orders ?? 0}</span>
              </div>
              <div>
                <span className="block text-3xs text-muted">Active Due Sheets</span>
                <span className="text-base font-bold text-foreground">{metrics?.financials?.total_due_sheets ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Visuals & Icons Suite (Dashboard Logo & Favicon) */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Brand Visuals & Icons (Dashboard Logo & Browser Favicon)</h3>
          </div>
          <span className="text-3xs text-muted">Updates sidebar logo & browser tab icon</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Dashboard Logo */}
          <div className="space-y-3 rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Dashboard Company Logo</label>
              {formData.logo_url ? (
                <button
                  type="button"
                  onClick={() => setFormData((p: any) => ({ ...p, logo_url: "" }))}
                  className="text-3xs text-rose-400 hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="flex h-16 w-full items-center justify-center rounded-xl border border-dashed border-border bg-card p-2">
              {formData.logo_url ? (
                <img src={formData.logo_url} alt="Company Logo Preview" className="max-h-12 max-w-full object-contain" />
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Building2 className="h-4 w-4 text-muted" />
                  <span>Default Logo Active</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <input
                type="text"
                name="logo_url"
                value={formData.logo_url}
                onChange={handleChange}
                placeholder="Paste Logo Image URL (e.g. https://...)"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />

              <label className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2 px-3 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer">
                <ImageIcon className="h-3.5 w-3.5 text-muted" />
                <span>Choose Image File...</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "logo_url")} />
              </label>
            </div>
          </div>

          {/* Browser Tab Favicon */}
          <div className="space-y-3 rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Browser Tab Favicon</label>
              {formData.favicon_url ? (
                <button
                  type="button"
                  onClick={() => setFormData((p: any) => ({ ...p, favicon_url: "" }))}
                  className="text-3xs text-rose-400 hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="flex h-16 w-full items-center justify-center rounded-xl border border-dashed border-border bg-card p-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 shadow-sm">
                {formData.favicon_url || formData.logo_url ? (
                  <img src={formData.favicon_url || formData.logo_url} alt="Favicon" className="h-4 w-4 rounded object-contain" />
                ) : (
                  <Building2 className="h-4 w-4 text-primary" />
                )}
                <span className="text-xs font-semibold text-foreground truncate max-w-[130px]">
                  {formData.trade_name || formData.legal_name || "Company"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                name="favicon_url"
                value={formData.favicon_url}
                onChange={handleChange}
                placeholder="Paste Favicon URL (.ico, .svg, .png)"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />

              <label className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2 px-3 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer">
                <ImageIcon className="h-3.5 w-3.5 text-muted" />
                <span>Choose Favicon File...</span>
                <input type="file" accept="image/*,.ico" className="hidden" onChange={(e) => handleFileUpload(e, "favicon_url")} />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* App-Wide Theme Color Palette Presets & Custom Pickers */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">App-Wide Theme Color Palette</h3>
          </div>
          <span className="text-3xs text-muted">Updates theme accent, buttons, tabs, & brand highlights</span>
        </div>

        {/* Preset Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {THEME_PALETTES.map((preset) => {
            const isSelected =
              formData.theme_palette === preset.id ||
              (!formData.theme_palette && preset.id === "default") ||
              (formData.primary_color?.toLowerCase() === preset.primary.toLowerCase() && formData.theme_palette !== "custom");

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPalette(preset)}
                className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/30"
                    : "border-border bg-background hover:border-primary/40 hover:bg-surface-muted"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="h-4 w-4 rounded-full shadow-inner ring-2 ring-card" style={{ backgroundColor: preset.primary }} />
                    <span className="h-3.5 w-3.5 -ml-1.5 rounded-full shadow-inner ring-2 ring-card opacity-80" style={{ backgroundColor: preset.secondary }} />
                  </div>
                  {isSelected && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white text-3xs font-bold">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div className="w-full">
                  <p className="truncate text-xs font-bold text-foreground">{preset.name}</p>
                  <p className="text-3xs text-muted line-clamp-1 mt-0.5">{preset.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Color Pickers & Live Preview */}
        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          <div className="space-y-3 rounded-xl border border-border bg-background p-4">
            <div className="flex items-center gap-2">
              <Pipette className="h-4 w-4 text-primary" />
              <label className="text-xs font-semibold text-foreground">Custom Brand Color Hex</label>
            </div>

            <div className="space-y-3">
              <div>
                <span className="block text-3xs text-muted mb-1 font-semibold">Primary Brand Color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    name="primary_color"
                    value={formData.primary_color || "#636ccb"}
                    onChange={handleChange}
                    className="h-8 w-11 rounded-lg border border-border bg-transparent p-0.5 cursor-pointer"
                  />
                  <input
                    type="text"
                    name="primary_color"
                    value={formData.primary_color || ""}
                    onChange={handleChange}
                    className="flex-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground font-mono uppercase focus:border-primary focus:outline-none"
                    placeholder="#636CCB"
                  />
                </div>
              </div>

              <div>
                <span className="block text-3xs text-muted mb-1 font-semibold">Secondary / Accent Color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    name="secondary_color"
                    value={formData.secondary_color || "#6e8cfb"}
                    onChange={handleChange}
                    className="h-8 w-11 rounded-lg border border-border bg-transparent p-0.5 cursor-pointer"
                  />
                  <input
                    type="text"
                    name="secondary_color"
                    value={formData.secondary_color || ""}
                    onChange={handleChange}
                    className="flex-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground font-mono uppercase focus:border-primary focus:outline-none"
                    placeholder="#6E8CFB"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-background p-4">
            <label className="text-xs font-semibold text-foreground block">Live UI Component Preview</label>
            <p className="text-3xs text-muted">Buttons, badges, and active highlights adapt in real-time:</p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button type="button" className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-md">
                Primary Action
              </button>
              <button type="button" className="rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
                Muted Accent
              </button>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-3xs font-bold text-emerald-400">
                <Sparkles className="h-3 w-3" /> Live Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Sections: Legal, Taxation, Address, Banking, Quotation Terms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: General & Legal Identification */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Landmark className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">General & Legal Entity Details</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Legal Entity Name</label>
              <input
                type="text"
                name="legal_name"
                value={formData.legal_name}
                onChange={handleChange}
                placeholder="e.g. Acme Power Pvt Ltd"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Trade / Brand Name</label>
              <input
                type="text"
                name="trade_name"
                value={formData.trade_name}
                onChange={handleChange}
                placeholder="e.g. Acme Enterprises"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Support Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contact@company.com"
                  className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Billing Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  type="email"
                  name="billing_email"
                  value={formData.billing_email}
                  onChange={handleChange}
                  placeholder="billing@company.com"
                  className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Contact Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Official Website</label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://company.com"
                  className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Taxation & Licenses */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-foreground">Taxation & Licenses</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground">GSTIN</label>
                {formData.gstin ? (
                  <button
                    type="button"
                    onClick={() => handleCopy(formData.gstin, "GSTIN")}
                    className="text-3xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    {copiedKey === "GSTIN" ? "Copied!" : "Copy"}
                  </button>
                ) : null}
              </div>
              <input
                type="text"
                name="gstin"
                value={formData.gstin}
                onChange={handleChange}
                placeholder="22AAAAA0000A1Z5"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">PAN Number</label>
              <input
                type="text"
                name="pan"
                value={formData.pan}
                onChange={handleChange}
                placeholder="AAAAA0000A"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">CIN (Corporate ID)</label>
              <input
                type="text"
                name="cin"
                value={formData.cin}
                onChange={handleChange}
                placeholder="U12345MH2020PTC123456"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Drug License (20B/21B)</label>
              <input
                type="text"
                name="drug_license"
                value={formData.drug_license}
                onChange={handleChange}
                placeholder="License No."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-foreground block mb-1">FSSAI License</label>
              <input
                type="text"
                name="fssai_license"
                value={formData.fssai_license}
                onChange={handleChange}
                placeholder="FSSAI License No."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Business Address & Localization */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <MapPin className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-bold text-foreground">Headquarters Address & Localization</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Street Address</label>
              <textarea
                name="address"
                rows={2}
                value={formData.address}
                onChange={handleChange}
                placeholder="Complete registered business address..."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="State"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  placeholder="400001"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="India"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Currency</label>
                <input
                  type="text"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  placeholder="INR (₹)"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Financial Year</label>
                <input
                  type="text"
                  name="financial_year"
                  value={formData.financial_year}
                  onChange={handleChange}
                  placeholder="2025-2026"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Banking & Payment Info */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <CreditCard className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-foreground">Bank Credentials & Payment Accounts</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Bank Name</label>
              <input
                type="text"
                name="bank_name"
                value={formData.bank_name}
                onChange={handleChange}
                placeholder="e.g. HDFC Bank"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Account Name</label>
              <input
                type="text"
                name="account_name"
                value={formData.account_name}
                onChange={handleChange}
                placeholder="Beneficiary Name"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Account Number</label>
              <input
                type="text"
                name="account_number"
                value={formData.account_number}
                onChange={handleChange}
                placeholder="50200012345678"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">IFSC Code</label>
              <input
                type="text"
                name="ifsc_code"
                value={formData.ifsc_code}
                onChange={handleChange}
                placeholder="HDFC0001234"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Branch Name</label>
              <input
                type="text"
                name="branch_name"
                value={formData.branch_name}
                onChange={handleChange}
                placeholder="Main Branch"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">UPI ID</label>
              <input
                type="text"
                name="upi_id"
                value={formData.upi_id}
                onChange={handleChange}
                placeholder="company@upi"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Quotation Terms */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground">Standard Quotation Terms & Conditions</h3>
            </div>
            <span className="text-3xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5">
              {formData.quotation_terms?.length || 0} Terms Defined
            </span>
          </div>

          <div className="space-y-3">
            {formData.quotation_terms && formData.quotation_terms.length > 0 ? (
              <div className="space-y-2">
                {formData.quotation_terms.map((term: string, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-xs text-foreground"
                  >
                    <span className="font-semibold text-primary shrink-0">{idx + 1}.</span>
                    <span className="flex-1">{term}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(idx)}
                      className="rounded-lg p-1 text-muted hover:bg-rose-500/10 hover:text-rose-400 transition"
                      title="Remove term"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted italic">No quotation terms defined yet.</p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTerm();
                  }
                }}
                placeholder="Add a new default quotation clause..."
                className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddTerm}
                className="flex items-center gap-1.5 rounded-xl bg-primary/20 border border-primary/30 px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition"
              >
                <Plus className="h-4 w-4" />
                Add Clause
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
