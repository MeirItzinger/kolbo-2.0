import { User } from "lucide-react";

interface ProfileAvatarProps {
  avatarUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-20 w-20",
  xl: "h-32 w-32",
};

export function ProfileAvatar({ avatarUrl, name, size = "md", className = "" }: ProfileAvatarProps) {
  const baseClasses = `${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center bg-surface-800 ${className}`;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${baseClasses} object-cover`}
      />
    );
  }

  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={`${baseClasses} bg-primary-600`}>
      <span className="text-white font-semibold text-lg">
        {initial || <User className="h-6 w-6" />}
      </span>
    </div>
  );
}
