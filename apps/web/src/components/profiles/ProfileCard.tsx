import { ProfileAvatar } from "./ProfileAvatar";

interface ProfileCardProps {
  name: string;
  avatarUrl?: string | null;
  isKidsProfile?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isLocked?: boolean;
  showActions?: boolean;
  disabled?: boolean;
}

export function ProfileCard({
  name,
  avatarUrl,
  isKidsProfile = false,
  onClick,
  onEdit,
  onDelete,
  isLocked = false,
  showActions = false,
  disabled = false,
}: ProfileCardProps) {
  return (
    <div className="group flex flex-col items-center gap-3">
      <div className="relative">
        <button
          onClick={onClick}
          disabled={disabled}
          className="rounded-full transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ProfileAvatar avatarUrl={avatarUrl} name={name} size="xl" />
        </button>

        {showActions && (
          <div className="absolute top-0 right-0 flex gap-1 -translate-y-1 translate-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={onEdit}
                className="h-8 w-8 rounded-full bg-surface-700 hover:bg-surface-600 flex items-center justify-center text-white"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="h-8 w-8 rounded-full bg-red-700 hover:bg-red-600 flex items-center justify-center text-white"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-white font-medium text-lg">{name}</p>
        {isKidsProfile && (
          <p className="text-sm text-surface-400">Kids profile</p>
        )}
      </div>
    </div>
  );
}
