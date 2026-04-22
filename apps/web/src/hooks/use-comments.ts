"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  Comment,
  CreateCommentInput,
  UpdateCommentInput,
} from "@recruitment-os/types";

/**
 * Comments query + mutation hooks.
 *
 * All calls go through the callable `apiClient<T>(path, init?)` function.
 */

export function useComments(
  targetType: string,
  targetId: string,
  includeInternal = true
) {
  return useQuery<Comment[]>({
    queryKey: ["comments", targetType, targetId],
    queryFn: () =>
      apiClient<Comment[]>(
        `/api/comments?targetType=${targetType}&targetId=${targetId}&includeInternal=${includeInternal}`
      ),
    enabled: !!targetType && !!targetId,
    staleTime: 10_000,
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation<Comment, Error, CreateCommentInput, { previous: Comment[] | undefined }>({
    mutationFn: (input: CreateCommentInput) =>
      apiClient<Comment>("/api/comments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      // Optimistic insert — append a placeholder to the cache
      await qc.cancelQueries({
        queryKey: ["comments", input.targetType, input.targetId],
      });
      const previous = qc.getQueryData<Comment[]>([
        "comments",
        input.targetType,
        input.targetId,
      ]);
      if (previous) {
        const optimistic: Comment = {
          id: `temp-${Date.now()}`,
          organizationId: "",
          targetType: input.targetType,
          targetId: input.targetId,
          authorId: "",
          authorName: "You",
          body: input.body,
          mentions: input.mentions ?? [],
          kind: input.kind ?? "comment",
          feedbackThumb: input.feedbackThumb ?? null,
          isInternal: input.isInternal ?? true,
          createdAt: new Date().toISOString(),
          updatedAt: null,
        };
        qc.setQueryData<Comment[]>(
          ["comments", input.targetType, input.targetId],
          [...previous, optimistic]
        );
      }
      return { previous };
    },
    onError: (_err, input, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(
          ["comments", input.targetType, input.targetId],
          ctx.previous
        );
      }
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({
        queryKey: ["comments", input.targetType, input.targetId],
      });
    },
  });
}

export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation<
    Comment,
    Error,
    { id: string; patch: UpdateCommentInput }
  >({
    mutationFn: ({ id, patch }) =>
      apiClient<Comment>(`/api/comments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments"] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, { id: string; targetType: string; targetId: string }, { previous: Comment[] | undefined }>({
    mutationFn: ({ id }) =>
      apiClient<{ ok: true }>(`/api/comments/${id}`, {
        method: "DELETE",
      }),
    onMutate: async ({ id, targetType, targetId }) => {
      await qc.cancelQueries({
        queryKey: ["comments", targetType, targetId],
      });
      const previous = qc.getQueryData<Comment[]>([
        "comments",
        targetType,
        targetId,
      ]);
      if (previous) {
        qc.setQueryData<Comment[]>(
          ["comments", targetType, targetId],
          previous.filter((c) => c.id !== id)
        );
      }
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(
          ["comments", vars.targetType, vars.targetId],
          ctx.previous
        );
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({
        queryKey: ["comments", vars.targetType, vars.targetId],
      });
    },
  });
}
