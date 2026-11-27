import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { WordListClient } from "@/components/WordListClient";
import { createClient } from "@/lib/supabase/server";
import { getCourseStudyData } from "@/lib/supabase/queries";
import { getHeaderUser } from "@/lib/supabase/user-profile";

export const dynamic = "force-dynamic";

interface CourseWordsPageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ verbs?: string }>;
}

export default async function CourseWordsPage({
  params,
  searchParams,
}: CourseWordsPageProps) {
  const [{ code }, { verbs }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const data = await getCourseStudyData(supabase, user.id, code);
  if (!data) {
    notFound();
  }

  const slug = data.course.code.toLowerCase();

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader
        title={`${data.course.code} Word List`}
        subtitle="Whole Course · Ordered by spoken frequency"
        backHref={`/courses/${slug}`}
        backLabel="Back to course"
        user={getHeaderUser(user)}
      />
      <WordListClient
        userId={user.id}
        initialWords={data.words}
        studyHref={`/courses/${slug}/study`}
        initialVerbsOnly={verbs === "1"}
      />
    </div>
  );
}
