import { Plus } from "lucide-react";
import { ProfileCard } from "./ProfileCard";

interface Profile {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isKidsProfile?: boolean;
  hasPin?: boolean;
}

interface ProfileGridProps {
  profiles: Profile[];
  onProfileClick: (profile: Profile) => void;
  onAddProfile?: () => void;
  onEditProfile?: (profile: Profile) => void;
  onDeleteProfile?: (profile: Profile) => void;
  showActions?: boolean;
  showAddButton?: boolean;
}

export function ProfileGrid({
  profiles = [],
  onProfileClick,
  onAddProfile,
  onEditProfile,
  onDeleteProfile,
  showActions = false,
  showAddButton = true,
}: ProfileGridProps) {
  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {safeProfiles.map((profile) => (
        <ProfileCard
          key={profile.id}
          name={profile.name}
          avatarUrl={profile.avatarUrl}
          isKidsProfile={profile.isKidsProfile}
          isLocked={profile.hasPin}
          showActions={showActions}
          onClick={() => onProfileClick(profile)}
          onEdit={onEditProfile ? () => onEditProfile(profile) : undefined}
          onDelete={onDeleteProfile && profiles.length > 1 ? () => onDeleteProfile(profile) : undefined}
        />
      ))}

      {showAddButton && (
        <button
          onClick={onAddProfile}
          className="group flex flex-col items-center gap-3"
        >
          <div className="h-32 w-32 rounded-full border-2 border-dashed border-surface-600 flex items-center justify-center transition-all duration-200 hover:border-primary-500 hover:bg-primary-500/10">
            <Plus className="h-10 w-10 text-surface-500 group-hover:text-primary-500" />
          </div>
          <p className="text-surface-400 font-medium text-lg group-hover:text-white">
            Add profile
          </p>
        </button>
      )}
    </div>
  );
}
