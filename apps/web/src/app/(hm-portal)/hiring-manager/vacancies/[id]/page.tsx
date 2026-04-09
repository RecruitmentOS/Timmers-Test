"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useHMCandidates, useRequestMoreCandidates } from "@/hooks/use-portal";
import { PortalCandidateRow } from "@/components/portal-shared/portal-candidate-row";
import { ApprovalActions } from "@/components/portal-shared/approval-actions";
import { CommentThread } from "@/components/collaboration/comment-thread";
import { ActivityTimeline } from "@/components/collaboration/activity-timeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, Loader2, CheckCircle } from "lucide-react";

export default function HMVacancyDetailPage() {
  const params = useParams<{ id: string }>();
  const vacancyId = params.id;
  const {
    data: candidates,
    isLoading,
    error,
  } = useHMCandidates(vacancyId);
  const requestMore = useRequestMoreCandidates();
  const [requested, setRequested] = React.useState(false);

  function handleRequestMore() {
    requestMore.mutate(vacancyId, {
      onSuccess: () => setRequested(true),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vacature details</h1>
          <p className="text-muted-foreground mt-1">
            Kandidaten en activiteiten
          </p>
        </div>
        <Button
          onClick={handleRequestMore}
          disabled={requestMore.isPending || requested}
          className="gap-1.5"
        >
          {requestMore.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : requested ? (
            <CheckCircle className="size-4" />
          ) : (
            <UserPlus className="size-4" />
          )}
          {requested ? "Aangevraagd" : "Meer kandidaten aanvragen"}
        </Button>
      </div>

      <Tabs defaultValue="candidates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="candidates">Kandidaten</TabsTrigger>
          <TabsTrigger value="activity">Activiteit</TabsTrigger>
          <TabsTrigger value="comments">Opmerkingen</TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">
              Kon kandidaten niet laden.
            </p>
          ) : candidates && candidates.length > 0 ? (
            candidates.map((c) => (
              <PortalCandidateRow
                key={c.id}
                candidate={c}
                actions={
                  <ApprovalActions
                    applicationId={c.id}
                    portalType="hm"
                  />
                }
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <Users className="size-10 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Geen kandidaten</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Er zijn nog geen kandidaten gedeeld voor deze vacature.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTimeline vacancyId={vacancyId} />
        </TabsContent>

        <TabsContent value="comments">
          <CommentThread
            targetType="vacancy"
            targetId={vacancyId}
            includeInternal={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
