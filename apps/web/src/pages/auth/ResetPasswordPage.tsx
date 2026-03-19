import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, CheckCircle, AlertTriangle } from "lucide-react";
import * as authApi from "@/api/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (password: string) =>
      authApi.resetPassword({ token: token!, password }),
    onSuccess: () => setSuccess(true),
  });

  if (!token) {
    return (
      <Card className="border-surface-800">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Invalid reset link
          </h2>
          <p className="mb-6 text-sm text-surface-400">
            This password reset link is missing or invalid.
          </p>
          <Button asChild>
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="border-surface-800">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600/20">
            <CheckCircle className="h-6 w-6 text-primary-400" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Password reset!
          </h2>
          <p className="mb-6 text-sm text-surface-400">
            Your password has been updated. You can now sign in.
          </p>
          <Button asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-surface-800">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Set new password</CardTitle>
        <CardDescription className="text-surface-400">
          Choose a strong password for your account
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v.password))}
          className="space-y-4"
        >
          {mutation.error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {(mutation.error as any)?.response?.data?.message ??
                "Reset failed. The link may have expired."}
            </div>
          )}

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
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Resetting…" : "Reset Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
