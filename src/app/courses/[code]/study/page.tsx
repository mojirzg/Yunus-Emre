import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { FlashcardDeck } from "@/components/FlashcardDeck";
import { createClient } from "@/lib/supabase/server";
import { getCourseStudyData } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

interface CourseStudyPageProps {
  params: Promise<{ code: string }>;
}

export default async function CourseStudyPage({
  params,
}: CourseStudyPageProps) {
  const { code } = await params;
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
    <div className="flex min-h-dvh flex-col bg-stone-50">
      <AppHeader
        title={`${data.course.code} Flashcards`}
        subtitle="Whole Course · Ordered by spoken frequency"
        backHref={`/courses/${slug}`}
        backLabel="Back to course"
      />
      <FlashcardDeck
        userId={user.id}
        initialWords={data.words}
        wordsListHref={`/courses/${slug}/words`}
        backToCourseHref={`/courses/${slug}`}
      />
    </div>
  );
}
