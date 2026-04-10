"use client";

import { useState } from "react";
import {
  useTeamMembers,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
} from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, UserPlus } from "lucide-react";

const ROLES = [
  { value: "super_admin", label: "Admin" },
  { value: "recruiter", label: "Recruiter" },
  { value: "agent", label: "Agent" },
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "client_viewer", label: "Client Viewer" },
  { value: "marketing_op", label: "Marketing" },
];

export default function TeamSettingsPage() {
  const { data: members, isLoading } = useTeamMembers();
  const inviteMember = useInviteMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("recruiter");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleInvite = () => {
    if (!inviteEmail) return;
    inviteMember.mutate(
      { email: inviteEmail, role: inviteRole },
      {
        onSuccess: () => {
          setInviteOpen(false);
          setInviteEmail("");
          setInviteRole("recruiter");
        },
      }
    );
  };

  const handleDelete = (memberId: string) => {
    removeMember.mutate(memberId, {
      onSuccess: () => setDeleteId(null),
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Teamleden</h2>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <UserPlus className="mr-2 size-4" />
            Uitnodigen
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Teamlid uitnodigen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email">E-mailadres</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="naam@bedrijf.nl"
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleInvite}
                disabled={!inviteEmail || inviteMember.isPending}
              >
                {inviteMember.isPending ? "Verzenden..." : "Uitnodiging versturen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Naam</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Lid sinds</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members?.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>{m.email}</TableCell>
              <TableCell>
                <Select
                  value={m.role}
                  onValueChange={(role) =>
                    role && updateRole.mutate({ memberId: m.id, role })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {new Date(m.createdAt).toLocaleDateString("nl-NL")}
              </TableCell>
              <TableCell>
                <Dialog
                  open={deleteId === m.id}
                  onOpenChange={(open) => setDeleteId(open ? m.id : null)}
                >
                  <DialogTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" />
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Teamlid verwijderen</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      Weet je zeker dat je {m.name} wilt verwijderen uit het team?
                    </p>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(m.id)}
                        disabled={removeMember.isPending}
                      >
                        Verwijderen
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
          {(!members || members.length === 0) && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Geen teamleden gevonden
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
