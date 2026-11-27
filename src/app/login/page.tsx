import { AuthForm } from "@/components/AuthForm";

interface LoginPageProps {
  searchParams: Promise<{ auth_error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { auth_error } = await searchParams;
  return <AuthForm mode="signin" initialErrorCode={auth_error} />;
}
