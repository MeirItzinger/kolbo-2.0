import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import {
  createProfile,
  uploadAvatar,
  type ProfileInput,
} from "@/api/profiles";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import type { Profile } from "@/types";

const PROFILES_KEY = ["profiles", "list"] as const;

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

/**
 * Standalone "Add a profile" screen reachable from the profile picker.
 *
 * Lives OUTSIDE the AppLayout gate so a user who has just logged in (and
 * therefore has no active profile yet) can still create a new profile.
 */
export default function AddProfilePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { setActiveProfile } = useActiveProfile();

  // Where to send the user after they pick the new profile from the picker.
  // Default to /explore but preserve any deep-link the picker carries.
  const next = params.get("next") || "/explore";
  const pickerHref = `/profiles/select?next=${encodeURIComponent(next)}`;

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isKidsProfile, setIsKidsProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  const createMutation = useMutation({
    mutationFn: (input: ProfileInput) => createProfile(input),
    onSuccess: (profile: Profile) => {
      // Insert the new profile into the cached list directly. Doing this
      // synchronously *before* setActiveProfile prevents the active-profile
      // hook from seeing a stale list that doesn't contain the new id and
      // mistakenly clearing the selection.
      qc.setQueryData<Profile[]>(PROFILES_KEY, (prev) =>
        prev ? [...prev, profile] : [profile],
      );
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      setActiveProfile(profile);
      navigate(next, { replace: true });
    },
  });

  async function handleAvatarFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
    } catch (err) {
      console.error("avatar upload failed", err);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createMutation.mutate({
      name: trimmed,
      avatarUrl: avatarUrl.trim() || null,
      isKidsProfile,
    });
  }

  const submitting = createMutation.isPending;
  const formError = (createMutation.error as Error | null)?.message ?? null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 px-4 py-12">
      <button
        type="button"
        onClick={() => navigate(pickerHref)}
        className="mb-8 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to profiles
      </button>

      <h1 className="mb-2 text-3xl font-semibold text-white">Add a profile</h1>
      <p className="mb-8 max-w-md text-center text-sm text-surface-400">
        Add a profile for another person watching Kolbo. Each profile gets its
        own watch history and recommendations.
      </p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-xl border border-surface-800 bg-surface-900/40 p-6"
      >
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
            <AvatarFallback className="text-lg">
              {initials(name || "?")}
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
          {avatarUrl && (
            <button
              type="button"
              className="text-sm text-surface-400 hover:text-white"
              onClick={() => setAvatarUrl("")}
              aria-label="Remove avatar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div>
          <label
            htmlFor="profile-name"
            className="mb-1 block text-sm font-medium text-surface-200"
          >
            Name
          </label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            checked={isKidsProfile}
            onCheckedChange={setIsKidsProfile}
          />
        </div>

        {formError && <p className="text-sm text-red-400">{formError}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(pickerHref)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Creating…" : "Continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
