"use client";

import { useState } from "react";
import {
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  Minus,
} from "lucide-react";
import { useDocuments, useUploadDocument } from "@/hooks/use-documents";
import { apiClient } from "@/lib/api-client";
import type { CandidateDocument, DocumentType } from "@recruitment-os/types";

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  cv: "CV",
  license: "Rijbewijs",
  code95: "Code 95",
  adr: "ADR",
  id: "ID",
  other: "Overig",
};

const DOCUMENT_TYPE_COLORS: Record<DocumentType, string> = {
  cv: "bg-blue-100 text-blue-800",
  license: "bg-purple-100 text-purple-800",
  code95: "bg-indigo-100 text-indigo-800",
  adr: "bg-orange-100 text-orange-800",
  id: "bg-gray-100 text-gray-800",
  other: "bg-gray-100 text-gray-600",
};

function getExpiryInfo(expiresAt: string | null): {
  label: string;
  color: string;
  icon: typeof CheckCircle;
} {
  if (!expiresAt) {
    return { label: "-", color: "text-gray-400", icon: Minus };
  }

  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Verlopen", color: "text-red-600", icon: AlertTriangle };
  }
  if (diffDays <= 30) {
    return {
      label: `Verloopt over ${diffDays} dagen`,
      color: "text-yellow-600",
      icon: Clock,
    };
  }
  return { label: "Geldig", color: "text-green-600", icon: CheckCircle };
}

interface DocumentListProps {
  candidateId: string;
}

/**
 * Document list component for candidate detail view.
 * Shows uploaded documents with type badges, expiry status, and download links.
 */
export function DocumentList({ candidateId }: DocumentListProps) {
  const { data: documents, isLoading } = useDocuments(candidateId);
  const uploadMutation = useUploadDocument();
  const [showUploadForm, setShowUploadForm] = useState(false);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  const handleDownload = async (s3Key: string, filename: string) => {
    try {
      const { url } = await apiClient<{ url: string }>(
        `/api/files/download-url?key=${encodeURIComponent(s3Key)}`
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Documenten</h3>
        <button
          type="button"
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </button>
      </div>

      {showUploadForm && (
        <UploadForm
          candidateId={candidateId}
          onUpload={uploadMutation.mutateAsync}
          onClose={() => setShowUploadForm(false)}
        />
      )}

      {!documents || documents.length === 0 ? (
        <p className="text-sm text-gray-500">Geen documenten gevonden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="pb-2 pr-4">Bestand</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Verloopt</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((doc: CandidateDocument) => {
                const expiry = getExpiryInfo(doc.expiresAt);
                const ExpiryIcon = expiry.icon;
                const docType = (doc.documentType ?? "other") as DocumentType;
                return (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-900 truncate max-w-[200px]">
                      {doc.filename}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${DOCUMENT_TYPE_COLORS[docType]}`}
                      >
                        {DOCUMENT_TYPE_LABELS[docType]}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-500">
                      {doc.expiresAt ?? "-"}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${expiry.color}`}
                      >
                        <ExpiryIcon className="h-3.5 w-3.5" />
                        {expiry.label}
                      </span>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(doc.s3Key, doc.filename)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface UploadFormProps {
  candidateId: string;
  onUpload: (data: {
    candidateId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    s3Key: string;
    documentType: string;
    expiresAt?: string | null;
    contentHash?: string | null;
  }) => Promise<unknown>;
  onClose: () => void;
}

function UploadForm({ candidateId, onUpload, onClose }: UploadFormProps) {
  const [documentType, setDocumentType] = useState<DocumentType>("cv");
  const [expiresAt, setExpiresAt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // Step 1: Get presigned upload URL
      const { url, key } = await apiClient<{ url: string; key: string }>(
        "/api/files/upload-url",
        {
          method: "POST",
          body: JSON.stringify({
            entityType: "candidate",
            entityId: candidateId,
            filename: file.name,
            contentType: file.type,
          }),
        }
      );

      // Step 2: Upload to S3
      await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // Step 3: Record document metadata
      await onUpload({
        candidateId,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        s3Key: key,
        documentType,
        expiresAt: expiresAt || null,
      });

      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload mislukt"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Type document
          </label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Vervaldatum (optioneel)
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Bestand kiezen
        </label>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          disabled={uploading}
          className="text-sm"
        />
      </div>
      {uploading && (
        <p className="text-xs text-blue-600">Uploaden...</p>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        Annuleren
      </button>
    </div>
  );
}
