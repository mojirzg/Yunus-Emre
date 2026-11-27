import { AuthForm } from "@/components/AuthForm";

interface SignupPageProps {
  searchParams: Promise<{ auth_error?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { auth_error } = await searchParams;
  return <AuthForm mode="signup" initialErrorCode={auth_error} />;
}
