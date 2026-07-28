import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — LeadGen Property Manager" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectedFrom?: string }>;
}) {
  const { redirectedFrom } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">LeadGen Property Manager</CardTitle>
          <CardDescription>
            Sign in to your account. Accounts are provisioned by an admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm redirectedFrom={redirectedFrom} />
        </CardContent>
      </Card>
    </main>
  );
}
