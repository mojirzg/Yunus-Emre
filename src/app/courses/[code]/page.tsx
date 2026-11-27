import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Layers, List } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { getCourseDetailWithProgress } from "@/lib/supabase/queries";
import { getHeaderUser } from "@/lib/supabase/user-profile";

export const dynamic = "force-dynamic";

interface CourseDetailPageProps {
  params: Promise<{ code: string }>;
}

export default async function CourseDetailPage({
  params,
}: CourseDetailPageProps) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const data = await getCourseDetailWithProgress(supabase, user.id, code);
  if (!data) {
    notFound();
  }

  const { course, lessons } = data;
  const slug = course.code.toLowerCase();

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader
        title={course.title}
        subtitle={`${course.learnedWords} / ${course.totalWords} words learned`}
        backHref="/courses"
        backLabel="Back to courses"
        user={getHeaderUser(user)}
      />

      <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 pb-safe">
        {/* Course Progress Card */}
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-stone-900">
              Course Progress
            </h2>
            <span className="text-lg font-bold text-teal-700">
              {course.percentage}%
            </span>
          </div>

          <div
            className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-stone-100"
            role="progressbar"
            aria-valuenow={course.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall course progress"
          >
            <div
              className="h-full rounded-full bg-teal-600 transition-all"
              style={{ width: `${course.percentage}%` }}
            />
          </div>

          <p className="mt-2 text-xs font-medium text-stone-500">
            {course.learnedWords} of {course.totalWords} unique words learned
            across {lessons.length} units
          </p>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href={`/courses/${slug}/study`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.99]"
            >
              <Layers className="h-5 w-5" aria-hidden="true" />
              Study Whole Course
            </Link>
            <Link
              href={`/courses/${slug}/words`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-5 py-3.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 active:scale-[0.99]"
            >
              <List className="h-4 w-4" aria-hidden="true" />
              Word List
            </Link>
          </div>
        </section>

        {/* Lessons List */}
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-bold tracking-wide text-stone-500 uppercase">
            Units
          </h2>
          <ul className="space-y-3">
            {lessons.map((lesson) => (
              <li
                key={lesson.id}
                className="rounded-3xl border border-stone-200 bg-white p-4 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-stone-900">
                      {lesson.title}
                    </h3>
                    <p className="text-xs font-medium text-stone-500">
                      {lesson.learnedWords} / {lesson.totalWords} words learned
                    </p>
                  </div>
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800">
                    {lesson.percentage}%
                  </span>
                </div>

                <div
                  className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-100"
                  role="progressbar"
                  aria-valuenow={lesson.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${lesson.title} progress`}
                >
                  <div
                    className="h-full rounded-full bg-teal-600 transition-all"
                    style={{ width: `${lesson.percentage}%` }}
                  />
                </div>

                <div className="mt-3.5 flex gap-2">
                  <Link
                    href={`/courses/${slug}/lessons/${lesson.unit_number}/study`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 active:scale-[0.98]"
                  >
                    <Layers className="h-4 w-4" aria-hidden="true" />
                    Study
                  </Link>
                  <Link
                    href={`/courses/${slug}/lessons/${lesson.unit_number}/words`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 active:scale-[0.98]"
                  >
                    <List className="h-4 w-4" aria-hidden="true" />
                    Words
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
