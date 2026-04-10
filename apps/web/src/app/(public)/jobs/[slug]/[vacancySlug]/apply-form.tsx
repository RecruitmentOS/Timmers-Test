"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const LICENSE_TYPES = ["B", "C", "CE", "D", "D1", "taxi"] as const;

const labels = {
  nl: {
    firstName: "Voornaam",
    lastName: "Achternaam",
    phone: "Telefoonnummer",
    email: "E-mailadres",
    city: "Woonplaats",
    cv: "CV uploaden",
    license: "Rijbewijs",
    code95: "Code 95",
    submit: "Solliciteren",
    submitting: "Bezig met versturen...",
    success: "Bedankt voor je sollicitatie!",
    successSub: "We nemen zo snel mogelijk contact met je op.",
    error: "Er is iets misgegaan. Probeer het opnieuw.",
    retry: "Opnieuw proberen",
    required: "Verplicht veld",
    invalidEmail: "Ongeldig e-mailadres",
    uploading: "Uploaden...",
    fileSelected: "Bestand geselecteerd",
  },
  en: {
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone number",
    email: "Email",
    city: "City",
    cv: "Upload CV",
    license: "License",
    code95: "Code 95",
    submit: "Apply",
    submitting: "Submitting...",
    success: "Thank you for your application!",
    successSub: "We will contact you as soon as possible.",
    error: "Something went wrong. Please try again.",
    retry: "Try again",
    required: "Required field",
    invalidEmail: "Invalid email address",
    uploading: "Uploading...",
    fileSelected: "File selected",
  },
} as const;

interface ApplyFormProps {
  slug: string;
  vacancySlug: string;
  lang: "nl" | "en";
}

export function ApplyForm({ slug, vacancySlug, lang }: ApplyFormProps) {
  const t = labels[lang];
  const searchParams = useSearchParams();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    city: "",
    licenseTypes: [] as string[],
    hasCode95: false,
  });

  const [utmParams, setUtmParams] = useState({
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
  });

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvKey, setCvKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Capture UTM params from URL on mount
  useEffect(() => {
    setUtmParams({
      utmSource: searchParams.get("utm_source") || searchParams.get("source") || "",
      utmMedium: searchParams.get("utm_medium") || "",
      utmCampaign: searchParams.get("utm_campaign") || "",
    });
  }, [searchParams]);

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function toggleLicense(license: string) {
    setForm((prev) => ({
      ...prev,
      licenseTypes: prev.licenseTypes.includes(license)
        ? prev.licenseTypes.filter((l) => l !== license)
        : [...prev.licenseTypes, license],
    }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = t.required;
    if (!form.lastName.trim()) errors.lastName = t.required;
    if (!form.phone.trim()) errors.phone = t.required;
    if (!form.email.trim()) {
      errors.email = t.required;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = t.invalidEmail;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleCvUpload(file: File) {
    setCvFile(file);
    setUploading(true);
    try {
      // Get presigned URL
      const urlRes = await fetch(
        `${API_BASE}/api/public/${slug}/upload-url?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
      );
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, key } = await urlRes.json();

      // Upload file to S3
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Failed to upload file");

      setCvKey(key);
    } catch {
      setCvFile(null);
      setCvKey(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);

    try {
      const body = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        city: form.city.trim() || undefined,
        cvFileId: cvKey || undefined,
        licenseTypes:
          form.licenseTypes.length > 0 ? form.licenseTypes : undefined,
        hasCode95: form.hasCode95 || undefined,
        utmSource: utmParams.utmSource || undefined,
        utmMedium: utmParams.utmMedium || undefined,
        utmCampaign: utmParams.utmCampaign || undefined,
      };

      const res = await fetch(
        `${API_BASE}/api/public/${slug}/apply/${vacancySlug}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Application failed");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg bg-green-50 p-8 text-center">
        <svg
          className="mx-auto h-12 w-12 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <h3 className="mt-4 text-xl font-semibold text-green-800">
          {t.success}
        </h3>
        <p className="mt-2 text-green-600">{t.successSub}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* First name */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t.firstName} *
        </label>
        <input
          type="text"
          value={form.firstName}
          onChange={(e) => updateField("firstName", e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {fieldErrors.firstName && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.firstName}</p>
        )}
      </div>

      {/* Last name */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t.lastName} *
        </label>
        <input
          type="text"
          value={form.lastName}
          onChange={(e) => updateField("lastName", e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {fieldErrors.lastName && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.lastName}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t.phone} *
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => updateField("phone", e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {fieldErrors.phone && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.phone}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t.email} *
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {fieldErrors.email && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
        )}
      </div>

      {/* City */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t.city}
        </label>
        <input
          type="text"
          value={form.city}
          onChange={(e) => updateField("city", e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* CV upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t.cv}
        </label>
        <div className="mt-1">
          <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 transition-colors hover:border-blue-400 hover:bg-blue-50">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCvUpload(file);
              }}
              disabled={uploading}
            />
            {uploading ? (
              <span className="text-sm text-gray-500">{t.uploading}</span>
            ) : cvFile ? (
              <span className="text-sm text-green-600">
                {t.fileSelected}: {cvFile.name}
              </span>
            ) : (
              <span className="text-sm text-gray-500">{t.cv} (PDF, DOC)</span>
            )}
          </label>
        </div>
      </div>

      {/* License types */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t.license}
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {LICENSE_TYPES.map((license) => (
            <button
              key={license}
              type="button"
              onClick={() => toggleLicense(license)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                form.licenseTypes.includes(license)
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
              }`}
            >
              {license}
            </button>
          ))}
        </div>
      </div>

      {/* Code 95 */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="code95"
          checked={form.hasCode95}
          onChange={(e) => updateField("hasCode95", e.target.checked)}
          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="code95" className="text-sm font-medium text-gray-700">
          {t.code95}
        </label>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="mt-2 text-sm font-medium text-red-700 underline"
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || uploading}
        className="w-full rounded-lg bg-blue-600 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {submitting ? t.submitting : t.submit}
      </button>
    </form>
  );
}
