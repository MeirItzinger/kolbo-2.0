import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Settings as SettingsIcon } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getProfilePinStatus, verifyProfilePin } from "@/api/pin";
import { PinPrompt } from "@/components/pin/PinPrompt";
import type { Profile } from "@/types";

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

export default function ProfilePickerPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profiles, isLoading, setActiveProfile, activeProfile } =
    useActiveProfile();

  const next = params.get("next") || "/explore";
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);

  // If a profile is already active and the user lands here directly, send them on.
  useEffect(() => {
    if (activeProfile && !params.has("force")) {
      navigate(next, { replace: true });
    }
  }, [activeProfile, navigate, next, params]);

  const completeChoose = (profile: Profile) => {
    setActiveProfile(profile);
    navigate(next, { replace: true });
  };

  const choose = async (profile: Profile) => {
    try {
      const { isSet } = await getProfilePinStatus(profile.id);
      if (isSet) {
        setPendingProfile(profile);
        return;
      }
    } catch {
      // If status check fails, fall through and pick anyway.
    }
    completeChoose(profile);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 px-4 py-12">
      <h1 className="mb-2 text-3xl font-semibold text-white">Who's watching?</h1>
      <p className="mb-10 text-sm text-surface-400">
        Choose a profile to continue.
      </p>

      {isLoading ? (
        <Spinner size="lg" />
      ) : (
        <div className="flex flex-wrap items-start justify-center gap-6">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => choose(profile)}
              className="group flex flex-col items-center gap-3 rounded-lg p-2 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <Avatar className="h-24 w-24 ring-2 ring-transparent transition-all group-hover:ring-primary-500">
                {profile.avatarUrl ? (
                  <AvatarImage src={profile.avatarUrl} />
                ) : null}
                <AvatarFallback className="text-2xl">
                  {initials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1 text-center">
                <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-white">
                  {profile.name}
                  {/* small lock hint will be visible when status is fetched on click */}
                </p>
                {profile.isKidsProfile && <Badge>Kids</Badge>}
              </div>
            </button>
          ))}

          <Link
            to={`/profiles/new?next=${encodeURIComponent(next)}`}
            className="flex flex-col items-center gap-3 rounded-lg p-2 text-surface-400 transition-colors hover:text-white"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-surface-700 group-hover:border-primary-500">
              <Plus className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium">Add profile</p>
          </Link>
        </div>
      )}

      <Link
        to="/account/profiles"
        className="mt-10 inline-flex items-center gap-1.5 text-sm text-surface-400 transition-colors hover:text-white"
      >
        <SettingsIcon className="h-4 w-4" /> Manage profiles
      </Link>

      <PinPrompt
        open={!!pendingProfile}
        title={`Enter ${pendingProfile?.name ?? "profile"} PIN`}
        description="This profile is PIN-protected."
        onClose={() => setPendingProfile(null)}
        onVerify={async (pin) => {
          if (!pendingProfile) return false;
          await verifyProfilePin(pendingProfile.id, pin);
          completeChoose(pendingProfile);
          setPendingProfile(null);
          return true;
        }}
      />
    </div>
  );
}
