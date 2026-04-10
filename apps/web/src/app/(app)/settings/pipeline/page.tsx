"use client";

import { useState, useEffect } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";

import {
  usePipelineStages,
  useCreatePipelineStage,
  useReorderPipelineStages,
  useUpdatePipelineStage,
  useDeletePipelineStage,
} from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import type { PipelineStageConfig } from "@recruitment-os/types";

function SortableStage({
  stage,
  index,
  onEdit,
  onDelete,
}: {
  stage: PipelineStageConfig;
  index: number;
  onEdit: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(stage.name);

  const { ref } = useSortable({
    id: stage.id,
    index,
  });

  const handleSave = () => {
    if (editName.trim()) {
      onEdit(stage.id, editName.trim());
      setEditing(false);
    }
  };

  return (
    <div
      ref={ref}
      className="flex items-center gap-2 rounded-md border bg-card p-3"
    >
      <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
      <span className="w-6 text-center text-xs text-muted-foreground">
        {index + 1}
      </span>

      {editing ? (
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-7 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Button variant="ghost" size="icon-sm" onClick={handleSave}>
            <Check className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditing(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <span className="flex-1 text-sm font-medium">{stage.name}</span>
      )}

      {stage.isDefault && (
        <Badge variant="secondary" className="text-xs">
          Standaard
        </Badge>
      )}

      {!editing && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setEditName(stage.name);
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(stage.id)}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PipelineSettingsPage() {
  const { data: stages, isLoading } = usePipelineStages();
  const createStage = useCreatePipelineStage();
  const reorderStages = useReorderPipelineStages();
  const updateStage = useUpdatePipelineStage();
  const deleteStage = useDeletePipelineStage();

  const [localStages, setLocalStages] = useState<PipelineStageConfig[]>([]);
  const [newStageName, setNewStageName] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (stages) setLocalStages(stages);
  }, [stages]);

  const handleReorder = (event: any) => {
    const source = event.operation.source;
    const target = event.operation.target;
    if (!source || !target) return;

    const sourceId = String(source.id);
    const targetId = String(target.id);
    if (sourceId === targetId) return;

    const fromIndex = localStages.findIndex((s) => s.id === sourceId);
    const toIndex = localStages.findIndex((s) => s.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const updated = [...localStages];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setLocalStages(updated);
    reorderStages.mutate(updated.map((s) => s.id));
  };

  const handleEdit = (stageId: string, name: string) => {
    updateStage.mutate({ stageId, name });
  };

  const handleCreate = () => {
    if (!newStageName.trim()) return;
    createStage.mutate(newStageName.trim(), {
      onSuccess: () => {
        setNewStageName("");
        setAddOpen(false);
      },
    });
  };

  const handleDelete = (stageId: string) => {
    deleteStage.mutate(stageId, {
      onSuccess: () => setDeleteTarget(null),
      onError: () => setDeleteTarget(null),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Pipeline fases</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 size-4" />
            Nieuwe fase
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuwe pipeline fase</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="Fasenaam"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!newStageName.trim() || createStage.isPending}
              >
                {createStage.isPending ? "Aanmaken..." : "Fase toevoegen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-sm text-muted-foreground">
        Versleep fases om de volgorde aan te passen. Wijzigingen worden direct opgeslagen.
      </p>

      <DragDropProvider onDragEnd={handleReorder}>
        <div className="space-y-2">
          {localStages.map((stage, index) => (
            <SortableStage
              key={stage.id}
              stage={stage}
              index={index}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteTarget(id)}
            />
          ))}
        </div>
      </DragDropProvider>

      {localStages.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Geen pipeline fases geconfigureerd. Voeg een fase toe om te beginnen.
        </p>
      )}

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fase verwijderen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Weet je zeker dat je deze fase wilt verwijderen? Dit kan alleen als er
            geen sollicitaties in deze fase staan.
          </p>
          {deleteStage.isError && (
            <p className="text-sm text-destructive">
              {(deleteStage.error as Error).message}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={deleteStage.isPending}
            >
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
