"use client";

import { useState } from "react";
import {
  useQualificationPresets,
  useCreateQualificationPreset,
  useUpdateQualificationPreset,
  useDeleteQualificationPreset,
} from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import type { QualificationPreset } from "@recruitment-os/types";

interface PresetForm {
  name: string;
  criteria: string;
  isDefault: boolean;
}

const emptyForm: PresetForm = { name: "", criteria: "", isDefault: false };

export default function QualificationsSettingsPage() {
  const { data: presets, isLoading } = useQualificationPresets();
  const createPreset = useCreateQualificationPreset();
  const updatePreset = useUpdateQualificationPreset();
  const deletePreset = useDeleteQualificationPreset();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PresetForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (preset: QualificationPreset) => {
    setEditingId(preset.id);
    setForm({
      name: preset.name,
      criteria: preset.criteria,
      isDefault: preset.isDefault,
    });
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.criteria.trim()) return;

    if (editingId) {
      updatePreset.mutate(
        { presetId: editingId, ...form },
        { onSuccess: () => setFormOpen(false) }
      );
    } else {
      createPreset.mutate(form, { onSuccess: () => setFormOpen(false) });
    }
  };

  const handleDelete = (id: string) => {
    deletePreset.mutate(id, {
      onSuccess: () => setDeleteTarget(null),
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
        <h2 className="text-xl font-semibold">Kwalificatie-presets</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Nieuwe preset
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Definieer herbruikbare checklists voor het screenen van kandidaten. Een
        preset kan als standaard worden ingesteld voor nieuwe vacatures.
      </p>

      <div className="space-y-3">
        {presets?.map((preset) => (
          <Card key={preset.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  {preset.name}
                  {preset.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="mr-1 size-3" />
                      Standaard
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(preset)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(preset.id)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {preset.criteria.length > 200
                  ? `${preset.criteria.slice(0, 200)}...`
                  : preset.criteria}
              </p>
            </CardContent>
          </Card>
        ))}

        {(!presets || presets.length === 0) && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Geen kwalificatie-presets geconfigureerd. Maak een preset aan om te beginnen.
          </p>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Preset bewerken" : "Nieuwe preset"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Naam</Label>
              <Input
                id="preset-name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="bijv. Transport Chauffeur CE"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preset-criteria">Criteria</Label>
              <Textarea
                id="preset-criteria"
                value={form.criteria}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, criteria: e.target.value }))
                }
                placeholder={"Rijbewijs CE\nCode 95 geldig\nADR certificaat\nMinimaal 2 jaar ervaring"}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Eeen criterium per regel
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="preset-default"
                checked={form.isDefault}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    isDefault: checked === true,
                  }))
                }
              />
              <Label htmlFor="preset-default" className="text-sm">
                Standaard preset voor nieuwe vacatures
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSave}
              disabled={
                !form.name.trim() ||
                !form.criteria.trim() ||
                createPreset.isPending ||
                updatePreset.isPending
              }
            >
              {createPreset.isPending || updatePreset.isPending
                ? "Opslaan..."
                : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preset verwijderen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Weet je zeker dat je deze kwalificatie-preset wilt verwijderen?
          </p>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={deletePreset.isPending}
            >
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
