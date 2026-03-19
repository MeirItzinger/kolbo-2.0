import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import * as authApi from "@/api/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const mutation = useMutation({
    mutationFn: (t: string) => authApi.verifyEmail(t),
  });

  useEffect(() => {
    if (token && !mutation.isSuccess && !mutation.isError) {
      mutation.mutate(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <Card className="border-surface-800">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Missing verification token
          </h2>
          <p className="mb-6 text-sm text-surface-400">
            This verification link appears to be invalid.
          </p>
          <Button asChild>
            <Link to="/login">Go to Login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mutation.isPending) {
    return (
      <Card className="border-surface-800">
        <CardContent className="flex flex-col items-center pt-8 pb-8">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary-500" />
          <h2 className="text-lg font-semibold text-white">
            Verifying your email…
          </h2>
        </CardContent>
      </Card>
    );
  }

  if (mutation.isError) {
    return (
      <Card className="border-surface-800">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Verification failed
          </h2>
          <p className="mb-6 text-sm text-surface-400">
            {(mutation.error as any)?.response?.data?.message ??
              "This link may have expired or is invalid."}
          </p>
          <Button asChild>
            <Link to="/login">Go to Login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-surface-800">
      <CardContent className="pt-8 pb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600/20">
          <CheckCircle className="h-6 w-6 text-primary-400" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-white">
          Email verified!
        </h2>
        <p className="mb-6 text-sm text-surface-400">
          Your email has been verified. You can now sign in.
        </p>
        <Button asChild>
          <Link to="/login">Sign In</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
