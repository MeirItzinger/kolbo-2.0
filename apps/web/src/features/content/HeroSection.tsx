import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  ctaText?: string;
  ctaLink?: string;
  className?: string;
}

export function HeroSection({
  title,
  subtitle,
  imageUrl,
  ctaText = "Watch Now",
  ctaLink,
  className,
}: HeroSectionProps) {
  return (
    <section className={cn("relative min-h-[420px] sm:min-h-[520px]", className)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/40 via-surface-950 to-surface-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/50 to-transparent" />
      <div className="relative mx-auto flex max-w-7xl items-end px-4 pb-16 pt-32 sm:px-6 sm:pt-48 lg:px-8">
        <div className="max-w-xl">
          <h1 className="text-3xl font-bold text-white sm:text-5xl">{title}</h1>
          {subtitle && (
            <p className="mt-4 text-lg text-surface-300">{subtitle}</p>
          )}
          {ctaLink && (
            <Button size="lg" className="mt-6" asChild>
              <Link to={ctaLink}>
                {ctaText}
                <Play className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
