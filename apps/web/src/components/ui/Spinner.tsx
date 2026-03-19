import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "default" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-4 w-4 border-2",
  default: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-3",
} as const;

export function Spinner({ size = "default", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-primary-500 border-t-transparent",
        sizeMap[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
