import { Link } from "react-router-dom";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 px-4">
      <div className="text-center">
        <p className="text-8xl font-bold text-surface-800">404</p>
        <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-4 max-w-md text-surface-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link to="/">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/explore">
              <Search className="h-4 w-4" />
              Explore
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
