import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
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

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: () => setSent(true),
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values.email);
  };

  if (sent) {
    return (
      <Card className="border-surface-800">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600/20">
            <CheckCircle className="h-6 w-6 text-primary-400" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Check your email
          </h2>
          <p className="mb-6 text-sm text-surface-400">
            We sent a password reset link to{" "}
            <span className="font-medium text-surface-200">
              {getValues("email")}
            </span>
          </p>
          <Button variant="ghost" asChild>
            <Link to="/login">
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-surface-800">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Forgot password?</CardTitle>
        <CardDescription className="text-surface-400">
          Enter your email and we&apos;ll send you a reset link
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {mutation.error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {(mutation.error as any)?.response?.data?.message ??
                "Something went wrong. Please try again."}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-surface-200">
              Email address
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

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              "Sending…"
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send Reset Link
              </>
            )}
          </Button>

          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm text-surface-400 hover:text-white"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to login
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
