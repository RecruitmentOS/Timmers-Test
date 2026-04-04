"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useClient,
  useClientVacancyAccess,
  useAddClientVacancyAccess,
  useClientUsers,
  useInviteClientUser,
} from "@/hooks/use-clients";
import { useVacancies } from "@/hooks/use-vacancies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, UserPlus, Mail, User } from "lucide-react";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client, isLoading } = useClient(id);
  const { data: vacancyAccess } = useClientVacancyAccess(id);
  const addAccessMutation = useAddClientVacancyAccess(id);
  const { data: clientUsers } = useClientUsers(id);
  const inviteUserMutation = useInviteClientUser(id);
  const { data: allVacancies } = useVacancies();

  const [selectedVacancyId, setSelectedVacancyId] = useState("");
  const [vacancyDialogOpen, setVacancyDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!client) {
    return <p className="text-muted-foreground">Client not found.</p>;
  }

  const handleAddVacancyAccess = async () => {
    if (!selectedVacancyId) return;
    await addAccessMutation.mutateAsync(selectedVacancyId);
    setSelectedVacancyId("");
    setVacancyDialogOpen(false);
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) return;
    try {
      await inviteUserMutation.mutateAsync(inviteEmail);
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setTimeout(() => setInviteSuccess(""), 3000);
    } catch {
      setInviteSuccess("Failed to send invitation");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <Badge
            variant="secondary"
            className={
              client.status === "active"
                ? "bg-green-100 text-green-800 mt-1"
                : "bg-gray-100 text-gray-800 mt-1"
            }
          >
            {client.status}
          </Badge>
        </div>
      </div>

      {/* Info card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{client.contactPerson || "No contact person"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{client.contactEmail || "No email"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vacancy Access section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Vacancy Access</CardTitle>
            <Dialog
              open={vacancyDialogOpen}
              onOpenChange={setVacancyDialogOpen}
            >
              <DialogTrigger
                render={
                  <Button variant="outline" size="sm">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Add Vacancy
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Vacancy Access</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Select
                    value={selectedVacancyId}
                    onValueChange={(v) => setSelectedVacancyId((v as string) ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vacancy" />
                    </SelectTrigger>
                    <SelectContent>
                      {(allVacancies as any[])?.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddVacancyAccess}
                    disabled={!selectedVacancyId}
                  >
                    Grant Access
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!(vacancyAccess as any[])?.length ? (
            <p className="text-sm text-muted-foreground">
              No vacancy access configured.
            </p>
          ) : (
            <div className="space-y-2">
              {(vacancyAccess as any[]).map((v: any) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{v.title}</span>
                  </div>
                  <Badge variant="secondary">{v.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Users section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Client Users</CardTitle>
            <Dialog
              open={inviteDialogOpen}
              onOpenChange={setInviteDialogOpen}
            >
              <DialogTrigger
                render={
                  <Button variant="outline" size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite Client User
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Client User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    The user will receive a magic link to access the client
                    portal. They will have read-only access to assigned
                    vacancies.
                  </p>
                  <Input
                    type="email"
                    placeholder="email@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  {inviteSuccess && (
                    <p className="text-sm text-green-600">{inviteSuccess}</p>
                  )}
                  <Button
                    onClick={handleInviteUser}
                    disabled={!inviteEmail || inviteUserMutation.isPending}
                  >
                    {inviteUserMutation.isPending
                      ? "Sending..."
                      : "Send Invitation"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {!(clientUsers as any[])?.length ? (
            <p className="text-sm text-muted-foreground">
              No client users assigned. Invite someone to grant portal access.
            </p>
          ) : (
            <div className="space-y-2">
              {(clientUsers as any[]).map((u: any) => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{u.userId}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
