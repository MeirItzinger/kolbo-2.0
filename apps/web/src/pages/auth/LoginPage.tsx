import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn, Tv } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;
type LoginMode = "kolbo" | "toveedo";

export default function LoginPage() {
  const { login, loginToveedo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [mode, setMode] = useState<LoginMode>("kolbo");

  const rawFrom = (location.state as {
    from?: string | { pathname: string; search?: string };
  })?.from;
  const from =
    typeof rawFrom === "string"
      ? rawFrom
      : rawFrom?.pathname
        ? `${rawFrom.pathname}${rawFrom.search ?? ""}`
        : "/explore";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const switchMode = (newMode: LoginMode) => {
    setMode(newMode);
    setServerError(null);
  };

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    try {
      if (mode === "toveedo") {
        await loginToveedo(values.email, values.password);
        navigate("/channels/toveedo", { replace: true });
      } else {
        const user = await login(values.email, values.password);
        const isSuperAdmin = user.roles.some((r: any) => (r.role?.key ?? r) === "SUPER_ADMIN");
        const channelAdminRole = user.roles.find((r: any) => (r.role?.key ?? r) === "CHANNEL_ADMIN");
        const creatorAdminRole = user.roles.find((r: any) => (r.role?.key ?? r) === "CREATOR_ADMIN");
        if (isSuperAdmin || channelAdminRole) {
          navigate("/admin", { replace: true });
        } else if (creatorAdminRole?.creatorProfileId) {
          navigate(`/creator-admin/${creatorAdminRole.creatorProfileId}`, { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }
    } catch (err: any) {
      setServerError(
        err?.response?.data?.message ?? (mode === "toveedo"
          ? "Invalid Toveedo credentials"
          : "Invalid email or password"),
      );
    }
  };

  return (
    <Card className="border-surface-800">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          {mode === "toveedo" ? "Toveedo Login" : "Welcome back"}
        </CardTitle>
        <CardDescription className="text-surface-400">
          {mode === "toveedo"
            ? "Sign in with your Toveedo account to watch Toveedo content"
            : "Sign in to your Kolbo account"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-surface-700 p-1">
          <button
            type="button"
            onClick={() => switchMode("kolbo")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "kolbo"
                ? "bg-primary-600 text-white"
                : "text-surface-400 hover:text-surface-200"
            }`}
          >
            <LogIn className="h-4 w-4" />
            Kolbo Account
          </button>
          <button
            type="button"
            onClick={() => switchMode("toveedo")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "toveedo"
                ? "bg-emerald-600 text-white"
                : "text-surface-400 hover:text-surface-200"
            }`}
          >
            <Tv className="h-4 w-4" />
            Toveedo
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-surface-200">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-surface-200">
                Password
              </label>
              {mode === "kolbo" && (
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className={`w-full ${mode === "toveedo" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Signing in…"
            ) : mode === "toveedo" ? (
              <>
                <Tv className="h-4 w-4" />
                Sign in with Toveedo
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Sign In
              </>
            )}
          </Button>
        </form>
      </CardContent>

      {mode === "kolbo" && (
        <CardFooter className="justify-center">
          <p className="text-sm text-surface-400">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="font-medium text-primary-400 hover:text-primary-300"
            >
              Sign up
            </Link>
          </p>
        </CardFooter>
      )}

      {mode === "toveedo" && (
        <CardFooter className="justify-center">
          <p className="text-center text-xs text-surface-500">
            Use your existing Toveedo / Uscreen credentials.
            <br />
            This gives you access to Toveedo content only.
          </p>
        </CardFooter>
      )}
    </Card>
  );
}
