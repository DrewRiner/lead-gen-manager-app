"use client";

import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createUserAction,
  deactivateUserAction,
  reactivateUserAction,
  updateUserAction,
  type UserActionResult,
} from "@/lib/actions/users";
import { cn } from "@/lib/utils";

type Role = "admin" | "member";

export interface UserRow {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  deactivatedAt: Date | string | null;
  createdAt: Date | string;
}

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", member: "Member" };

function fmtDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(d),
  );
}

export function UsersPanel({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Temporary password to reveal ONCE after creating a user.
  const [newCredential, setNewCredential] = useState<{
    email: string;
    password: string;
  } | null>(null);

  function run(action: () => Promise<UserActionResult>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-6">
        <div className="text-sm text-muted-foreground">
          {users.length} {users.length === 1 ? "user" : "users"}
        </div>
        <AddUserDialog
          pending={pending}
          onCreate={(fd, done) =>
            run(
              async () => {
                const res = await createUserAction(fd);
                if (res.ok && res.tempPassword && res.email) {
                  setNewCredential({ email: res.email, password: res.tempPassword });
                }
                return res;
              },
              done,
            )
          }
        />
      </div>

      {error ? (
        <p className="px-6 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {newCredential ? (
        <div className="mx-6 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <KeyRound className="h-4 w-4" /> Temporary password for {newCredential.email}
          </div>
          <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
            Copy this now and share it with the user securely — it won&rsquo;t be
            shown again. They can sign in immediately and should change it.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded border bg-background px-3 py-2 font-mono text-sm">
              {newCredential.password}
            </code>
            <CopyButton value={newCredential.password} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNewCredential(null)}
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const deactivated = u.deactivatedAt != null;
              const isSelf = u.id === currentUserId;
              return (
                <TableRow key={u.id} className={cn(deactivated && "opacity-60")}>
                  <TableCell className="font-medium">
                    {u.fullName ?? "—"}
                    {isSelf ? (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {ROLE_LABEL[u.role]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {deactivated ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                        Deactivated
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(u.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <EditUserDialog
                        user={u}
                        pending={pending}
                        onSave={(fd, done) => run(() => updateUserAction(fd), done)}
                      />
                      {deactivated ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => {
                            const fd = new FormData();
                            fd.set("id", u.id);
                            run(() => reactivateUserAction(fd));
                          }}
                        >
                          Reactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending || isSelf}
                          title={
                            isSelf ? "You can't deactivate your own account." : undefined
                          }
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Deactivate ${u.email}? They will be signed out and blocked immediately. Historical data is preserved.`,
                              )
                            ) {
                              return;
                            }
                            const fd = new FormData();
                            fd.set("id", u.id);
                            run(() => deactivateUserAction(fd));
                          }}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// -- Add user ----------------------------------------------------------------

function AddUserDialog({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (fd: FormData, done: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("member");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("role", role);
            onCreate(fd, () => setOpen(false));
          }}
        >
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Creates the account and shows a one-time temporary password to
              share with them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="add-name">Full name</Label>
              <Input id="add-name" name="fullName" required autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-email">Email</Label>
              <Input id="add-email" name="email" type="email" required autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member — full access except user management</SelectItem>
                  <SelectItem value="admin">Admin — full access including users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -- Edit user ---------------------------------------------------------------

function EditUserDialog({
  user,
  pending,
  onSave,
}: {
  user: UserRow;
  pending: boolean;
  onSave: (fd: FormData, done: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(user.role);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("id", user.id);
            fd.set("role", role);
            onSave(fd, () => setOpen(false));
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-name-${user.id}`}>Full name</Label>
              <Input
                id={`edit-name-${user.id}`}
                name="fullName"
                defaultValue={user.fullName ?? ""}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="icon"
      variant="outline"
      title="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}
