/**
 * @fileoverview Pure Vector jsPDF Builder for Dedicated Proforma Invoices.
 * Generates 100% crisp vector PDFs with exact Order Details and Customer Order Acceptance blocks.
 * @module components/quotations/buildProformaInvoicePdf
 */

import type { LeadQuotationRecord, LeadQuotationProformaDetails } from "@/store/api";
import { formatCompanyAddress } from "@/components/portal/shared/pdfCompanyLetterhead";
import { resolvePublicAssetUrl } from "@/lib/env";

type JsPDF = InstanceType<(typeof import("jspdf"))["jsPDF"]>;

export type ProformaCompanyInfo = {
  trade_name?: string;
  legal_name?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  account_type?: string;
  upi_id?: string;
  swift_code?: string;
};

export type BuildProformaInvoicePdfInput = {
  quotation: LeadQuotationRecord;
  proformaDetails?: LeadQuotationProformaDetails;
  company?: ProformaCompanyInfo;
  portalLabel?: string;
  downloadedBy?: string;
};

// Brand Colors (RGB)
const NAVY: [number, number, number] = [30, 58, 95];
const BLUE: [number, number, number] = [37, 99, 235];
const DARK: [number, number, number] = [15, 23, 42];
const TEXT: [number, number, number] = [51, 65, 85];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [203, 213, 225];
const LIGHT_BG: [number, number, number] = [248, 250, 252];
const ACCENT_BG: [number, number, number] = [239, 246, 255];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 10;
const CONTENT_W = PAGE_W - M * 2; // 190mm

function formatCurrency(amount?: number): string {
  if (amount == null || Number.isNaN(amount)) return "0.00";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Loads an image via HTML Image element and converts to base64 data URL.
 */
function loadImageData(url: string): Promise<{ dataUrl: string; width: number; height: number; format: string } | null> {
  return new Promise((resolve) => {
    if (!url || typeof window === "undefined") return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight, format: "PNG" });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Builds a vector-based jsPDF document for Proforma Invoice.
 */
export async function buildProformaInvoicePdf(input: BuildProformaInvoicePdfInput): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const { quotation, company, proformaDetails } = input;
  const pDetails = proformaDetails || quotation.proforma_details || {};

  const companyName =
    company?.trade_name ||
    company?.legal_name ||
    quotation.company_name ||
    "Shakti Technology IT";
  const companyAddress = formatCompanyAddress(company as any, quotation.company_regd_address);
  const companyPhone = company?.phone || quotation.company_phone || "";
  const companyEmail = company?.email || quotation.company_email || "";
  const companyGstin = company?.gstin || quotation.company_gstin || "";

  const bankName = quotation.bank_name || company?.bank_name || "";
  const accountName = quotation.account_name || company?.account_name || companyName;
  const accountNumber = quotation.account_number || company?.account_number || "";
  const ifscCode = quotation.ifsc_code || company?.ifsc_code || "";
  const branchName = quotation.branch_name || company?.branch_name || "";

  const customerName = quotation.customer_name
    ? quotation.customer_name.startsWith("M/s")
      ? quotation.customer_name
      : `M/s. ${quotation.customer_name}`
    : "M/s. Customer";

  const customerAddress = quotation.address
    ? [
        quotation.address.address_line_1,
        quotation.address.city,
        quotation.address.state,
        quotation.address.pincode,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const rawNo = quotation.quotation_no ? quotation.quotation_no.replace(/^QUOT-?/i, "") : String(Date.now()).slice(-4);
  const proformaNo = pDetails.proforma_no || `PINV-${rawNo}`;
  const invoiceDateStr = formatDate(pDetails.invoice_date || quotation.proforma_issued_at || new Date());
  const poNumber = pDetails.customer_po_number || quotation.customer_po_number || "Verbal";
  const poDateStr = formatDate(pDetails.customer_po_date || quotation.customer_po_date || quotation.quotation_date);

  const approvedBy =
    typeof quotation.approved_by === "object" && quotation.approved_by !== null
      ? (quotation.approved_by as any).name
      : quotation.signatory_name || "Authorized Authority";
  const approvedDateStr = formatDate(quotation.approved_at || quotation.updatedAt);

  const logoRaw = company?.logo_url || (quotation as any)?.company_logo || (quotation as any)?.logo_url || "";
  const resolvedLogoUrl = logoRaw ? resolvePublicAssetUrl(logoRaw) : "";
  let logoData: { dataUrl: string; width: number; height: number; format: string } | null = null;
  if (resolvedLogoUrl) {
    try {
      logoData = await loadImageData(resolvedLogoUrl);
    } catch {
      logoData = null;
    }
  }

  let currentY = M;

  // -------------------------------------------------------------
  // 1. Company Letterhead Header
  // -------------------------------------------------------------
  const drawHeader = () => {
    const headerTop = currentY;
    if (logoData) {
      const maxW = 38;
      const maxH = 15;
      const aspect = logoData.width / logoData.height;
      let w = maxW;
      let h = w / aspect;
      if (h > maxH) {
        h = maxH;
        w = h * aspect;
      }
      try {
        pdf.addImage(logoData.dataUrl, logoData.format, M, headerTop, w, h, undefined, "FAST");
      } catch {
        // Fallback text if image fail
      }
    }

    // Right Badge: PROFORMA INVOICE
    const badgeW = 36;
    const badgeH = 11;
    const badgeX = PAGE_W - M - badgeW;
    pdf.setFillColor(...ACCENT_BG);
    pdf.setDrawColor(191, 219, 254);
    pdf.setLineWidth(0.3);
    pdf.rect(badgeX, headerTop, badgeW, badgeH, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...NAVY);
    pdf.text("PROFORMA INVOICE", badgeX + badgeW / 2, headerTop + 4.5, { align: "center" });

    pdf.setFontSize(7);
    pdf.setTextColor(...BLUE);
    pdf.text(proformaNo, badgeX + badgeW / 2, headerTop + 8.5, { align: "center" });

    // Company Name & Info Center
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12.5);
    pdf.setTextColor(...NAVY);
    pdf.text(companyName.toUpperCase(), PAGE_W / 2, headerTop + 4, { align: "center" });

    let infoY = headerTop + 8;
    if (companyAddress) {
      pdf.setFontSize(7.2);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...TEXT);
      const splitAddr = pdf.splitTextToSize(`Regd. Off: ${companyAddress}`, 110);
      pdf.text(splitAddr, PAGE_W / 2, infoY, { align: "center" });
      infoY += splitAddr.length * 3.2 + 0.5;
    }

    const contactParts: string[] = [];
    if (companyPhone) contactParts.push(`Phone: ${companyPhone}`);
    if (companyEmail) contactParts.push(`Email: ${companyEmail}`);
    if (companyGstin) contactParts.push(`GSTIN: ${companyGstin}`);

    if (contactParts.length > 0) {
      pdf.setFontSize(6.8);
      pdf.setTextColor(...MUTED);
      pdf.text(contactParts.join("  |  "), PAGE_W / 2, infoY, { align: "center" });
      infoY += 4;
    }

    currentY = Math.max(headerTop + 18, infoY);
    pdf.setDrawColor(...NAVY);
    pdf.setLineWidth(0.6);
    pdf.line(M, currentY, PAGE_W - M, currentY);
    currentY += 4;
  };

  // -------------------------------------------------------------
  // 2. Title & Document Meta Box
  // -------------------------------------------------------------
  const drawMetaBox = () => {
    const boxX = M;
    const boxW = CONTENT_W;
    const col1W = 105;
    const col2W = boxW - col1W;

    // Left Column Lines
    const leftLines: Array<{ label: string; val: string; bold?: boolean; color?: [number, number, number] }> = [
      { label: "", val: "PROFORMA INVOICE", bold: true, color: NAVY },
      { label: "", val: customerName, bold: true, color: DARK },
    ];
    if (customerAddress) leftLines.push({ label: "", val: customerAddress });
    if (quotation.gstin) leftLines.push({ label: "GSTIN : ", val: quotation.gstin, bold: true });
    if (quotation.kind_attn) leftLines.push({ label: "Contact Person : ", val: quotation.kind_attn, bold: true });
    
    const phoneParts: string[] = [];
    if (quotation.phone) phoneParts.push(`Tel. : ${quotation.phone}`);
    if (quotation.cell) phoneParts.push(`Cell : ${quotation.cell}`);
    if (phoneParts.length > 0) leftLines.push({ label: "", val: phoneParts.join("   ") });
    if (quotation.email) leftLines.push({ label: "E-mail : ", val: quotation.email });

    // Right Column Lines
    const rightLines: Array<{ label: string; val: string; bold?: boolean; color?: [number, number, number] }> = [
      { label: "Pro. Invoice No. : ", val: proformaNo, bold: true, color: BLUE },
      { label: "Invoice Date. : ", val: invoiceDateStr, bold: true },
      { label: "PO No. : ", val: poNumber },
      { label: "PO Date. : ", val: poDateStr },
      { label: "Approved By : ", val: approvedBy },
      { label: "Approved Date. : ", val: approvedDateStr },
    ];

    // Measure Height
    let leftH = 0;
    leftLines.forEach((l) => {
      pdf.setFontSize(l.bold && l.val === "PROFORMA INVOICE" ? 10.5 : 7.5);
      const text = l.label ? `${l.label}${l.val}` : l.val;
      const split = pdf.splitTextToSize(text, col1W - 6);
      leftH += split.length * 3.5 + 0.5;
    });

    let rightH = rightLines.length * 4.2;
    const boxH = Math.max(leftH, rightH) + 5;

    // Draw background and borders
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.rect(boxX, currentY, boxW, boxH, "FD");

    // Divider Line
    pdf.line(boxX + col1W, currentY, boxX + col1W, currentY + boxH);

    // Render Left Column
    let ly = currentY + 4;
    leftLines.forEach((l) => {
      pdf.setFont("helvetica", l.bold ? "bold" : "normal");
      pdf.setFontSize(l.val === "PROFORMA INVOICE" ? 10.5 : 7.5);
      pdf.setTextColor(...(l.color || (l.bold ? DARK : TEXT)));

      if (l.label) {
        pdf.setFont("helvetica", "bold");
        pdf.text(l.label, boxX + 3, ly);
        const lw = pdf.getTextWidth(l.label);
        pdf.setFont("helvetica", l.bold ? "bold" : "normal");
        const valSplit = pdf.splitTextToSize(l.val, col1W - 6 - lw);
        pdf.text(valSplit, boxX + 3 + lw, ly);
        ly += valSplit.length * 3.5 + 0.5;
      } else {
        const split = pdf.splitTextToSize(l.val, col1W - 6);
        pdf.text(split, boxX + 3, ly);
        ly += split.length * 3.5 + 0.5;
      }
    });

    // Render Right Column
    let ry = currentY + 4;
    rightLines.forEach((r) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...TEXT);
      pdf.text(r.label, boxX + col1W + 3, ry);

      const labelW = pdf.getTextWidth(r.label);
      pdf.setFont("helvetica", r.bold ? "bold" : "normal");
      pdf.setTextColor(...(r.color || DARK));
      pdf.text(r.val, boxX + col1W + 3 + labelW, ry);
      ry += 4.5;
    });

    currentY += boxH + 3;
  };

  // -------------------------------------------------------------
  // 3. Goods & Commercial Pricing Table
  // -------------------------------------------------------------
  const drawItemsTable = () => {
    const items = quotation.items || [];
    const tableX = M;
    const tableW = CONTENT_W;

    // Columns configuration: Total 190mm
    // Sr(8) | Description(56) | HSN(16) | Qty(10) | Rate(21) | Sub Total(22) | Tax %(12) | Tax Amt(18) | Total(27)
    const cols = [
      { header: "Sr.", w: 8, align: "center" },
      { header: "Description of Goods", w: 56, align: "left" },
      { header: "HSN/SAC", w: 16, align: "center" },
      { header: "QTY", w: 10, align: "center" },
      { header: "Rate", w: 21, align: "right" },
      { header: "Sub Total", w: 22, align: "right" },
      { header: "Tax %", w: 12, align: "center" },
      { header: "Tax Amt", w: 18, align: "right" },
      { header: "Total", w: 27, align: "right" },
    ];

    // Header row
    const headerH = 6;
    pdf.setFillColor(...NAVY);
    pdf.rect(tableX, currentY, tableW, headerH, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(255, 255, 255);

    let curX = tableX;
    cols.forEach((col) => {
      let tx = curX + 1.5;
      if (col.align === "center") tx = curX + col.w / 2;
      if (col.align === "right") tx = curX + col.w - 1.5;
      pdf.text(col.header, tx, currentY + 4, { align: col.align as any });
      curX += col.w;
    });

    currentY += headerH;

    // Body rows
    items.forEach((it, idx) => {
      const qty = Number(it.quantity || 1);
      const rate = Number(it.rate || 0);
      const subtotal = Number(it.taxable_amount || qty * rate);
      const gstRate = Number(it.gst_rate || 18);
      const gstAmt = Number(it.total_gst_amount || (subtotal * gstRate) / 100);
      const total = Number(it.line_total || subtotal + gstAmt);

      const descLines = pdf.splitTextToSize(
        it.description ? `${it.product_name}\n${it.description}` : it.product_name,
        cols[1].w - 3
      );
      const rowH = Math.max(6, descLines.length * 3.3 + 2.5);

      // Check for page break
      if (currentY + rowH > PAGE_H - 45) {
        pdf.addPage();
        currentY = M;
        drawHeader();
      }

      pdf.setFillColor(idx % 2 === 0 ? 255 : 249, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
      pdf.setDrawColor(...LINE);
      pdf.setLineWidth(0.2);
      pdf.rect(tableX, currentY, tableW, rowH, "FD");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.8);
      pdf.setTextColor(...DARK);

      let cx = tableX;

      // Col 0: Sr
      pdf.text(String(idx + 1), cx + cols[0].w / 2, currentY + 4, { align: "center" });
      cx += cols[0].w;

      // Col 1: Description
      pdf.setFont("helvetica", "bold");
      pdf.text(descLines[0] || "", cx + 1.5, currentY + 3.8);
      if (descLines.length > 1) {
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...MUTED);
        for (let l = 1; l < descLines.length; l++) {
          pdf.text(descLines[l], cx + 1.5, currentY + 3.8 + l * 3.2);
        }
      }
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...DARK);
      cx += cols[1].w;

      // Col 2: HSN
      pdf.text(it.hsn_code || "—", cx + cols[2].w / 2, currentY + 4, { align: "center" });
      cx += cols[2].w;

      // Col 3: Qty
      pdf.text(String(qty), cx + cols[3].w / 2, currentY + 4, { align: "center" });
      cx += cols[3].w;

      // Col 4: Rate
      pdf.text(formatCurrency(rate), cx + cols[4].w - 1.5, currentY + 4, { align: "right" });
      cx += cols[4].w;

      // Col 5: Sub Total
      pdf.text(formatCurrency(subtotal), cx + cols[5].w - 1.5, currentY + 4, { align: "right" });
      cx += cols[5].w;

      // Col 6: Tax %
      pdf.text(`${gstRate}%`, cx + cols[6].w / 2, currentY + 4, { align: "center" });
      cx += cols[6].w;

      // Col 7: Tax Amt
      pdf.text(formatCurrency(gstAmt), cx + cols[7].w - 1.5, currentY + 4, { align: "right" });
      cx += cols[7].w;

      // Col 8: Total
      pdf.setFont("helvetica", "bold");
      pdf.text(formatCurrency(total), cx + cols[8].w - 1.5, currentY + 4, { align: "right" });

      currentY += rowH;
    });

    // Totals Summary Line
    const sumH = 6;
    pdf.setFillColor(...ACCENT_BG);
    pdf.setDrawColor(...LINE);
    pdf.rect(tableX, currentY, tableW, sumH, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...NAVY);

    const labelEnd = tableX + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w;
    pdf.text("Total", labelEnd - 2, currentY + 4, { align: "right" });

    // Subtotal (Col 5)
    let cx = labelEnd;
    pdf.text(formatCurrency(quotation.subtotal), cx + cols[5].w - 1.5, currentY + 4, { align: "right" });

    // GST Total (Col 7)
    cx += cols[5].w + cols[6].w;
    pdf.text(formatCurrency(quotation.total_gst), cx + cols[7].w - 1.5, currentY + 4, { align: "right" });

    // Grand Total (Col 8)
    cx += cols[7].w;
    pdf.setTextColor(...BLUE);
    pdf.text(formatCurrency(quotation.grand_total), cx + cols[8].w - 1.5, currentY + 4, { align: "right" });

    currentY += sumH + 2;

    // Grand Total & Words Bar
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...LINE);
    pdf.rect(tableX, currentY, tableW, 10, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...NAVY);
    pdf.text("Total GST :", tableX + 3, currentY + 4);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...DARK);
    pdf.text(`Rs. ${formatCurrency(quotation.total_gst)}`, tableX + 18, currentY + 4);

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...NAVY);
    pdf.text("Grand Total :", tableX + 65, currentY + 4);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...BLUE);
    pdf.text(`Rs. ${formatCurrency(quotation.grand_total)}`, tableX + 83, currentY + 4);

    if (quotation.amount_in_words) {
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...TEXT);
      pdf.text("Amount in words :", tableX + 3, currentY + 8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...DARK);
      pdf.text(quotation.amount_in_words, tableX + 27, currentY + 8);
    }

    currentY += 13;
  };

  // -------------------------------------------------------------
  // 4. Order & Dispatch Details (2-Column Grid)
  // -------------------------------------------------------------
  const drawOrderDetails = () => {
    const boxX = M;
    const boxW = CONTENT_W;
    const colW = boxW / 2;

    const salesPersonVal =
      pDetails.sales_person ||
      quotation.sales_person_name ||
      (typeof quotation.sales_person_user === "object" && quotation.sales_person_user !== null
        ? quotation.sales_person_user.name
        : "") ||
      "Sales Representative";

    const leftRows = [
      { label: "Sales Person", val: salesPersonVal },
      { label: "ORC", val: pDetails.orc || "na" },
      { label: "Dispatch Date", val: formatDate(pDetails.dispatch_date || quotation.valid_until || new Date()) },
      { label: "Payment Terms", val: pDetails.payment_terms || quotation.payment_terms || "On Delivery" },
      { label: "Installation Required", val: pDetails.installation_required || "No" },
      { label: "Margin Sheet Attached", val: pDetails.margin_sheet_attached || "na" },
    ];

    const rightRows = [
      { label: "Freight Charges", val: pDetails.freight_charges || "Extra at actual" },
      { label: "Transport", val: pDetails.transport || "To be arranged / SafeXpress" },
      { label: "Ship to Address", val: pDetails.ship_to_address || "Same as billing" },
      { label: "Customer Type", val: pDetails.customer_type || "Dealer" },
      { label: "GST Concession", val: pDetails.gst_concession || "na" },
      { label: "KYC", val: pDetails.kyc_status || "na" },
    ];

    const rowCount = Math.max(leftRows.length, rightRows.length);
    const boxH = rowCount * 4 + 7;

    // Header bar
    pdf.setFillColor(...ACCENT_BG);
    pdf.setDrawColor(...LINE);
    pdf.rect(boxX, currentY, boxW, 5, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...NAVY);
    pdf.text("Order Details:", boxX + 3, currentY + 3.5);

    // Body
    pdf.setFillColor(255, 255, 255);
    pdf.rect(boxX, currentY + 5, boxW, boxH - 5, "FD");
    pdf.line(boxX + colW, currentY + 5, boxX + colW, currentY + boxH);

    let ry = currentY + 8.5;
    for (let i = 0; i < rowCount; i++) {
      // Left
      const lr = leftRows[i];
      if (lr) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.8);
        pdf.setTextColor(...TEXT);
        pdf.text(lr.label, boxX + 3, ry);

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...DARK);
        const maxValW = colW - 35;
        const valText = pdf.splitTextToSize(lr.val, maxValW)[0] || "";
        pdf.text(`: ${valText}`, boxX + 31, ry);
      }

      // Right
      const rr = rightRows[i];
      if (rr) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.8);
        pdf.setTextColor(...TEXT);
        pdf.text(rr.label, boxX + colW + 3, ry);

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...DARK);
        const maxValW = colW - 35;
        const valText = pdf.splitTextToSize(rr.val, maxValW)[0] || "";
        pdf.text(`: ${valText}`, boxX + colW + 31, ry);
      }

      ry += 4;
    }

    currentY += boxH + 3;
  };

  // -------------------------------------------------------------
  // 5. Bottom Sign-Off: Bank Coordinates & Order Acceptance
  // -------------------------------------------------------------
  const drawSignOff = () => {
    const boxX = M;
    const boxW = CONTENT_W;
    const colW = boxW / 2;
    const boxH = 26;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...LINE);
    pdf.rect(boxX, currentY, boxW, boxH, "FD");
    pdf.line(boxX + colW, currentY, boxX + colW, currentY + boxH);

    // Left: Company Banking Coordinates
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...NAVY);
    pdf.text("Company Banking Details (for Advance Transfer):", boxX + 3, currentY + 4);

    pdf.setFontSize(6.5);
    pdf.setTextColor(...DARK);

    let by = currentY + 7.5;
    if (bankName) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Bank Name : ", boxX + 3, by);
      pdf.setFont("helvetica", "normal");
      pdf.text(bankName, boxX + 22, by);
      by += 3.5;
    }
    if (accountName) {
      pdf.setFont("helvetica", "bold");
      pdf.text("A/C Name : ", boxX + 3, by);
      pdf.setFont("helvetica", "normal");
      pdf.text(accountName, boxX + 22, by);
      by += 3.5;
    }
    if (accountNumber) {
      pdf.setFont("helvetica", "bold");
      pdf.text("A/C No. : ", boxX + 3, by);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...BLUE);
      pdf.text(accountNumber, boxX + 22, by);
      pdf.setTextColor(...DARK);
      by += 3.5;
    }
    if (ifscCode) {
      pdf.setFont("helvetica", "bold");
      pdf.text("IFSC Code : ", boxX + 3, by);
      pdf.setFont("helvetica", "normal");
      pdf.text(ifscCode, boxX + 22, by);
      by += 3.5;
    }
    if (branchName) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Branch : ", boxX + 3, by);
      pdf.setFont("helvetica", "normal");
      pdf.text(branchName, boxX + 22, by);
    }

    // Right: Order Acceptance & Authorized Signatory
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(...NAVY);
    pdf.text("Order Acceptance,", boxX + colW + 3, currentY + 4);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...DARK);
    pdf.text(customerName, boxX + colW + 3, currentY + 8);

    // Sign line
    pdf.setDrawColor(...LINE);
    pdf.line(boxX + colW + 3, currentY + 19, boxX + boxW - 3, currentY + 19);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...MUTED);
    pdf.text("Authorised Signatory ( Name / Company Seal )", boxX + colW + 3, currentY + 22.5);

    currentY += boxH + 4;
  };

  // Execution flow
  drawHeader();
  drawMetaBox();
  drawItemsTable();
  drawOrderDetails();
  drawSignOff();

  return pdf;
}
