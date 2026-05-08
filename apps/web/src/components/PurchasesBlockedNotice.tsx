import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

interface PurchasesBlockedNoticeProps {
  profileName: string | null | undefined;
  /** Tighter layout suitable for inline contexts (e.g. above a single CTA). */
  compact?: boolean;
  className?: string;
}

/**
 * Inline banner shown when the active profile's parental controls disallow
 * purchases. Used above buy/subscribe CTAs on pricing, channel and video
 * pages so the user understands why the action is unavailable and what they
 * can do about it.
 */
export function PurchasesBlockedNotice({
  profileName,
  compact = false,
  className,
}: PurchasesBlockedNoticeProps) {
  return (
    <div
      className={[
        "flex items-start gap-3 rounded-lg border border-amber-700/40 bg-amber-500/5 text-amber-100",
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
    >
      <Lock
        className={
          compact ? "mt-0.5 h-3.5 w-3.5 shrink-0" : "mt-0.5 h-4 w-4 shrink-0"
        }
      />
      <div className="flex-1">
        <p className="font-medium">
          Purchases are off for {profileName ?? "this profile"}.
        </p>
        <p className="mt-0.5 text-amber-200/80">
          Switch to a profile with purchasing enabled, or update parental
          controls in{" "}
          <Link
            to="/account/parental-controls"
            className="underline underline-offset-2 hover:text-white"
          >
            settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
