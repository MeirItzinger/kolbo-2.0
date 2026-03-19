import { Link, Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 px-4 py-12">
      <div className="mb-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
            <span className="text-lg font-bold text-white">K</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Kolbo
          </span>
        </Link>
      </div>

      <div className="w-full max-w-md">
        <Outlet />
      </div>

      <p className="mt-8 text-center text-xs text-surface-500">
        &copy; {new Date().getFullYear()} Kolbo. All rights reserved.
      </p>
    </div>
  );
}
