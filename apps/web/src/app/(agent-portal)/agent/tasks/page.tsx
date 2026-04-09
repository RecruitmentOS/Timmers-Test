"use client";

import { useTranslations } from "next-intl";
import { AgentTaskList } from "@/components/agent/agent-task-list";

/**
 * Agent portal — "Mijn taken" page.
 *
 * Shows agent's assigned tasks with overdue highlighting and completion.
 */
export default function AgentTasksPage() {
  const t = useTranslations("portal.agent");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("myTasks")}</h1>
        <p className="text-muted-foreground mt-1">
          Je openstaande en voltooide taken
        </p>
      </div>
      <AgentTaskList />
    </div>
  );
}
