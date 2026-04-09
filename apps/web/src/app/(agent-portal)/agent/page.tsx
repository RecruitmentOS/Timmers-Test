"use client";

import { useTranslations } from "next-intl";
import { AgentCandidateList } from "@/components/agent/agent-candidate-list";

/**
 * Agent portal — "Mijn kandidaten" page.
 *
 * Shows agent's assigned candidates in a dedicated minimal list.
 * Per D-12: custom-built UI, NOT reuse of recruiter components.
 */
export default function AgentPage() {
  const t = useTranslations("portal.agent");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("myCandidates")}</h1>
        <p className="text-muted-foreground mt-1">
          Kandidaten die aan jou zijn toegewezen
        </p>
      </div>
      <AgentCandidateList />
    </div>
  );
}
