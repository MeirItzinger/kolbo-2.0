import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, UserCircle, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  createProfile,
  deleteProfile,
  listProfiles,
  updateProfile,
  uploadAvatar,
  type ProfileInput,
} from "@/api/profiles";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import type { Profile } from "@/types";

const PROFILES_KEY = ["profiles", "list"] as const;
const MAX_PROFILES = 5;

interface ProfileFormState {
  name: string;
  avatarUrl: string;
  isKidsProfile: boolean;
}

const EMPTY_FORM: ProfileFormState = {
  name: "",
  avatarUrl: "",
  isKidsProfile: false,
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function ProfilesPage() {
  const qc = useQueryClient();
  const { setActiveProfile, activeProfile } = useActiveProfile();

  const { data: profiles = [], isLoading } = useQuery<Profile[]>({
    queryKey: PROFILES_KEY,
    queryFn: listProfiles,
  });

  const [editor, setEditor] = useState<{
    open: boolean;
    mode: "create" | "edit";
    profile: Profile | null;
    form: ProfileFormState;
  }>({ open: false, mode: "create", profile: null, form: EMPTY_FORM });

  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: PROFILES_KEY });
    qc.invalidateQueries({ queryKey: ["auth", "me"] });
  };

  const createMutation = useMutation({
    mutationFn: (input: ProfileInput) => createProfile(input),
    onSuccess: () => {
      invalidate();
      closeEditor();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<ProfileInput> }) =>
      updateProfile(vars.id, vars.patch),
    onSuccess: () => {
      invalidate();
      closeEditor();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProfile(id),
    onSuccess: (_data, id) => {
      if (activeProfile?.id === id) setActiveProfile(null);
      setConfirmDelete(null);
      invalidate();
    },
  });

  function openCreate() {
    setEditor({ open: true, mode: "create", profile: null, form: EMPTY_FORM });
  }

  function openEdit(profile: Profile) {
    setEditor({
      open: true,
      mode: "edit",
      profile,
      form: {
        name: profile.name,
        avatarUrl: profile.avatarUrl ?? "",
        isKidsProfile: !!profile.isKidsProfile,
      },
    });
  }

  function closeEditor() {
    setEditor((prev) => ({ ...prev, open: false }));
  }

  function setForm(patch: Partial<ProfileFormState>) {
    setEditor((prev) => ({ ...prev, form: { ...prev.form, ...patch } }));
  }

  async function handleAvatarFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      setForm({ avatarUrl: url });
    } catch (err) {
      console.error("avatar upload failed", err);
    } finally {
      setUploading(false);
    }
  }

  function submitEditor() {
    const payload: ProfileInput = {
      name: editor.form.name.trim(),
      avatarUrl: editor.form.avatarUrl.trim() || null,
      isKidsProfile: editor.form.isKidsProfile,
    };
    if (!payload.name) return;
    if (editor.mode === "create") {
      createMutation.mutate(payload);
    } else if (editor.profile) {
      updateMutation.mutate({ id: editor.profile.id, patch: payload });
    }
  }

  const submitting = createMutation.isPending || updateMutation.isPending;
  const formError =
    (createMutation.error as Error | null)?.message ??
    (updateMutation.error as Error | null)?.message ??
    null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Profiles</h1>
          <p className="mt-1 text-sm text-surface-400">
            Add up to {MAX_PROFILES} profiles. Each profile keeps its own watch
            history and favorites.
          </p>
        </div>
        <Button
          onClick={openCreate}
          disabled={profiles.length >= MAX_PROFILES}
        >
          <Plus className="h-4 w-4" /> Add profile
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
                <Avatar className="h-20 w-20">
                  {profile.avatarUrl ? (
                    <AvatarImage src={profile.avatarUrl} />
                  ) : null}
                  <AvatarFallback className="text-xl">
                    {initials(profile.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-base font-medium text-white">
                    {profile.name}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {profile.isKidsProfile && (
                      <Badge variant="default">Kids</Badge>
                    )}
                    {activeProfile?.id === profile.id && (
                      <Badge variant="success">Active</Badge>
                    )}
                  </div>
                </div>
                <div className="flex w-full items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setActiveProfile(profile)}
                  >
                    Use
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Edit profile"
                    onClick={() => openEdit(profile)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Delete profile"
                    onClick={() => setConfirmDelete(profile)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {profiles.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <UserCircle className="h-10 w-10 text-surface-600" />
                <p className="text-surface-400">No profiles yet.</p>
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Create your first profile
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={editor.open} onOpenChange={(o) => !o && closeEditor()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor.mode === "create" ? "New profile" : "Edit profile"}
            </DialogTitle>
            <DialogDescription>
              Give the profile a name, choose an avatar, and decide if it's a
              kids profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {editor.form.avatarUrl ? (
                  <AvatarImage src={editor.form.avatarUrl} />
                ) : null}
                <AvatarFallback>
                  {initials(editor.form.name || "?")}
                </AvatarFallback>
              </Avatar>
              <label className="cursor-pointer text-sm text-primary-400 hover:text-primary-300">
                {uploading ? "Uploading…" : "Upload avatar"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAvatarFile(f);
                  }}
                />
              </label>
              {editor.form.avatarUrl && (
                <button
                  type="button"
                  className="text-sm text-surface-400 hover:text-white"
                  onClick={() => setForm({ avatarUrl: "" })}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-surface-200">
                Name
              </label>
              <Input
                value={editor.form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                placeholder="e.g. Sarah"
                maxLength={40}
                autoFocus
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-surface-800 p-3">
              <div>
                <p className="text-sm font-medium text-white">Kids profile</p>
                <p className="text-xs text-surface-400">
                  Restricts content based on maturity ratings.
                </p>
              </div>
              <Switch
                checked={editor.form.isKidsProfile}
                onCheckedChange={(v) => setForm({ isKidsProfile: v })}
              />
            </div>

            {formError && (
              <p className="text-sm text-red-400">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button
              onClick={submitEditor}
              disabled={submitting || !editor.form.name.trim()}
            >
              {editor.mode === "create" ? "Create profile" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this profile?</DialogTitle>
            <DialogDescription>
              {confirmDelete?.name}'s watch history and favorites will be
              removed. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                confirmDelete && deleteMutation.mutate(confirmDelete.id)
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
