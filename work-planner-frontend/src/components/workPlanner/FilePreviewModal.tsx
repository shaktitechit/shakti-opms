"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type PreviewFile = {
  name: string;
  url: string;
  mime?: string;
};

export function isPdfPreview(mime: string = "", name: string = ""): boolean {
  const m = mime.toLowerCase();
  const n = name.toLowerCase();
  return m.includes("pdf") || n.endsWith(".pdf");
}

export function isImagePreview(mime: string = "", name: string = ""): boolean {
  const m = mime.toLowerCase();
  const n = name.toLowerCase();
  return m.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n);
}

type FilePreviewModalProps = {
  doc: PreviewFile | null;
  blobUrl: string | null;
  loading: boolean;
  onClose: () => void;
  onDownload?: (doc: PreviewFile) => void;
  subtitle?: string;
};

export function FilePreviewModal({
  doc,
  blobUrl,
  loading,
  onClose,
  onDownload,
  subtitle = "Document Preview",
}: FilePreviewModalProps) {
  if (!doc) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-[min(90vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${doc.name}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-surface-muted/50">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              {doc.name}
            </h3>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {doc.url && (
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Tab
              </a>
            )}
            {blobUrl && onDownload && (
              <button
                type="button"
                onClick={() => onDownload(doc)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto bg-surface-muted/40 p-4">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span>Loading document preview…</span>
            </div>
          )}

          {!loading && blobUrl && isPdfPreview(doc.mime, doc.name) && (
            <iframe
              title={doc.name}
              src={blobUrl}
              className="h-full min-h-[65vh] w-full rounded-lg border border-border bg-card"
            />
          )}

          {!loading && blobUrl && isImagePreview(doc.mime, doc.name) && (
            <div className="flex h-full min-h-[50vh] items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={blobUrl}
                alt={doc.name}
                className="max-h-full max-w-full rounded-lg object-contain shadow-md"
              />
            </div>
          )}

          {!loading &&
            blobUrl &&
            !isPdfPreview(doc.mime, doc.name) &&
            !isImagePreview(doc.mime, doc.name) && (
              <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center">
                <FileText className="h-12 w-12 text-muted" />
                <p className="text-sm font-medium text-foreground">
                  Inline preview is not supported for this file type.
                </p>
                {onDownload && (
                  <button
                    type="button"
                    onClick={() => onDownload(doc)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
                  >
                    <Download className="h-4 w-4" />
                    Download File
                  </button>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export function useFilePreview(token: string | null | undefined) {
  const [previewDoc, setPreviewDoc] = useState<PreviewFile | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewBlobRef = useRef<string | null>(null);

  const closePreview = useCallback(() => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    setPreviewBlobUrl(null);
    setPreviewDoc(null);
    setPreviewLoading(false);
  }, []);

  useEffect(() => () => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
    }
  }, []);

  const openPreview = useCallback(
    async (doc: PreviewFile) => {
      setPreviewDoc(doc);
      setPreviewLoading(true);
      setPreviewBlobUrl(null);

      // File-manager / MinIO presigned URLs are used directly — no auth proxy.
      const isDirectStorageUrl =
        /^https?:\/\//i.test(doc.url) && !/\/api\/files\//i.test(doc.url);

      if (isDirectStorageUrl) {
        setPreviewBlobUrl(doc.url);
        setPreviewLoading(false);
        return;
      }

      try {
        let fetchUrl = doc.url;
        if (token && !fetchUrl.includes("token=")) {
          fetchUrl +=
            (fetchUrl.includes("?") ? "&" : "?") +
            `token=${encodeURIComponent(token)}`;
        }

        const headers: Record<string, string> = {};
        if (token && !doc.url.includes("token=")) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(fetchUrl, { headers });
        if (!response.ok) throw new Error(`Failed to load file: ${response.status}`);
        const blob = await response.blob();
        if (previewBlobRef.current) {
          URL.revokeObjectURL(previewBlobRef.current);
        }
        const blobUrl = URL.createObjectURL(blob);
        previewBlobRef.current = blobUrl;
        setPreviewBlobUrl(blobUrl);
      } catch (err: unknown) {
        console.warn("Blob fetch failed, falling back to direct URL:", err);
        if (doc.url && doc.url !== "#") {
          setPreviewBlobUrl(doc.url);
        } else {
          toast.error("Failed to load document preview");
          closePreview();
        }
      } finally {
        setPreviewLoading(false);
      }
    },
    [token, closePreview]
  );

  const downloadFile = useCallback((doc: PreviewFile) => {
    const targetUrl = previewBlobRef.current || doc.url;
    if (!targetUrl || targetUrl === "#") return;
    const a = document.createElement("a");
    a.href = targetUrl;
    a.download = doc.name || "document";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  };
}
