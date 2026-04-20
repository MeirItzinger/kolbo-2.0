import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import * as authApi from "@/api/auth";
import { setTokens } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";

const schema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [showPassword, setShowPassword] = useState(false);

  const inviteQuery = useQuery({
    queryKey: ["auth", "invite", token],
    queryFn: () => authApi.getInvite(token!),
    enabled: !!token,
    retry: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
    },
    values: inviteQuery.data
      ? {
          firstName: inviteQuery.data.firstName ?? "",
          lastName: inviteQuery.data.lastName ?? "",
          password: "",
          confirmPassword: "",
        }
      : undefined,
  });

  const acceptMutation = useMutation({
    mutationFn: (vars: FormValues) =>
      authApi.acceptInvite({
        token: token!,
        password: vars.password,
        firstName: vars.firstName,
        lastName: vars.lastName,
      }),
    onSuccess: (res) => {
      setTokens(res.accessToken, (res as any).refreshToken ?? res.sessionId);
      qc.setQueryData(["auth", "me"], res.user);

      const roles = res.user.roles ?? [];
      const channelAdmin = roles.find(
        (r: any) => (r.role?.key ?? r.key) === "CHANNEL_ADMIN" && r.channelId
      );
      const creatorAdmin = roles.find(
        (r: any) =>
          (r.role?.key ?? r.key) === "CREATOR_ADMIN" && r.creatorProfileId
      );

      if (channelAdmin) {
        navigate(`/channel-admin/${channelAdmin.channelId}`, { replace: true });
      } else if (creatorAdmin) {
        navigate(`/creator-admin/${creatorAdmin.creatorProfileId}`, {
          replace: true,
        });
      } else {
        navigate("/", { replace: true });
      }
    },
  });

  if (!token) {
    return (
      <Card className="w-full max-w-md border-surface-800">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Invalid invite link
          </h2>
          <p className="mb-6 text-sm text-surface-400">
            This invite link is missing or invalid.
          </p>
          <Button asChild>
            <Link to="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (inviteQuery.isLoading) {
    return (
      <Card className="w-full max-w-md border-surface-800">
        <CardContent className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    return (
      <Card className="w-full max-w-md border-surface-800">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Invite not found
          </h2>
          <p className="mb-6 text-sm text-surface-400">
            This invite link is invalid or has expired. Ask your admin to send a
            new one.
          </p>
          <Button asChild>
            <Link to="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const invite = inviteQuery.data;

  return (
    <Card className="w-full max-w-md border-surface-800">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to Kolbo</CardTitle>
        <CardDescription className="text-surface-400">
          {invite.contextLabel
            ? `You've been invited as ${invite.contextLabel}.`
            : "You've been invited to Kolbo."}
          <br />
          Set your password for{" "}
          <span className="font-medium text-surface-200">{invite.email}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((v) => acceptMutation.mutate(v))}
          className="space-y-4"
        >
          {acceptMutation.error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {(acceptMutation.error as any)?.response?.data?.message ??
                "Could not accept the invite. The link may have expired."}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label
                htmlFor="firstName"
                className="text-sm font-medium text-surface-200"
              >
                First name
              </label>
              <Input
                id="firstName"
                autoComplete="given-name"
                {...register("firstName")}
                onChange={(e) => setValue("firstName", e.target.value)}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label
                htmlFor="lastName"
                className="text-sm font-medium text-surface-200"
              >
                Last name
              </label>
              <Input
                id="lastName"
                autoComplete="family-name"
                {...register("lastName")}
                onChange={(e) => setValue("lastName", e.target.value)}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-surface-200"
            >
              New password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
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

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-surface-200"
            >
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending ? "Setting password…" : "Accept invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
