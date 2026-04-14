"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Switch } from "@/components/ui/switch";
import { Download } from "lucide-react";

type NotificationPrefs = {
  emailMentions: boolean;
  emailAssignments: boolean;
  emailTaskReminders: boolean;
  emailDocumentExpiry: boolean;
};

const PREFS_KEY = ["gdpr", "notification-preferences"];

const toggles: {
  key: keyof NotificationPrefs;
  label: string;
}[] = [
  { key: "emailMentions", label: "Email bij @mentions" },
  { key: "emailAssignments", label: "Email bij toewijzingen" },
  { key: "emailTaskReminders", label: "Email herinneringen taken" },
  { key: "emailDocumentExpiry", label: "Email documentverloopdatum" },
];

/**
 * Notification preferences page — GDPR-03 email opt-out toggles + GDPR-02 data export.
 */
export default function NotificationPreferencesPage() {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery<NotificationPrefs>({
    queryKey: PREFS_KEY,
    queryFn: () => apiClient("/api/gdpr/notification-preferences"),
  });

  const mutation = useMutation({
    mutationFn: (update: Partial<NotificationPrefs>) =>
      apiClient<NotificationPrefs>("/api/gdpr/notification-preferences", {
        method: "PUT",
        body: JSON.stringify(update),
      }),
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: PREFS_KEY });
      const previous = queryClient.getQueryData<NotificationPrefs>(PREFS_KEY);
      if (previous) {
        queryClient.setQueryData<NotificationPrefs>(PREFS_KEY, {
          ...previous,
          ...update,
        });
      }
      return { previous };
    },
    onError: (_err, _update, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PREFS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PREFS_KEY });
    },
  });

  async function handleExport() {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const res = await fetch(`${API_BASE}/api/gdpr/export`, {
      credentials: "include",
    });
    if (!res.ok) {
      console.error("Data export failed:", res.statusText);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Meldingen</h2>
        <p className="text-sm text-slate-500 mt-1">
          Beheer welke e-mailmeldingen u ontvangt.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-slate-100"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {toggles.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
            >
              <label
                htmlFor={key}
                className="text-sm font-medium text-slate-700 cursor-pointer"
              >
                {label}
              </label>
              <Switch
                id={key}
                checked={prefs?.[key] ?? true}
                onCheckedChange={(checked: boolean) =>
                  mutation.mutate({ [key]: checked })
                }
              />
            </div>
          ))}
        </div>
      )}

      <hr className="border-slate-200" />

      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Gegevens exporteren
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Download al uw persoonlijke gegevens als JSON-bestand (AVG artikel 20).
        </p>
        <button
          onClick={handleExport}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        >
          <Download className="size-4" />
          Download mijn gegevens
        </button>
      </div>
    </div>
  );
}
