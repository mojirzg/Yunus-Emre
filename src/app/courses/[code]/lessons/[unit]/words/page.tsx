import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { WordListClient } from "@/components/WordListClient";
import { createClient } from "@/lib/supabase/server";
import { getLessonStudyData } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

interface LessonWordsPageProps {
  params: Promise<{ code: string; unit: string }>;
}

export default async function LessonWordsPage({
  params,
}: LessonWordsPageProps) {
  const { code, unit } = await params;
  const unitNumber = Number.parseInt(unit, 10);
  if (!Number.isFinite(unitNumber) || unitNumber < 1) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const data = await getLessonStudyData(supabase, user.id, code, unitNumber);
  if (!data) {
    notFound();
  }

  const slug = data.course.code.toLowerCase();

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader
        title={`${data.lesson.title} Words`}
        subtitle={`${data.course.code} · Ordered by spoken frequency`}
        backHref={`/courses/${slug}`}
        backLabel="Back to course"
      />
      <WordListClient
        userId={user.id}
        initialWords={data.words}
        studyHref={`/courses/${slug}/lessons/${unitNumber}/study`}
      />
    </div>
  );
}
