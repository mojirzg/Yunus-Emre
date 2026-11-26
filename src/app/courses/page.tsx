import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { getCoursesWithProgress } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const courses = await getCoursesWithProgress(supabase, user.id);

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader title="Courses" subtitle="Yedi İklim Türkçe" />

      <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 pb-safe">
        {courses.length === 0 ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-xs">
            <BookOpen
              className="mx-auto h-10 w-10 text-teal-700"
              aria-hidden="true"
            />
            <h2 className="mt-3 text-lg font-bold text-stone-900">
              No courses published yet
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Run the seed script to populate Yedi İklim Türkçe A2 vocabulary.
            </p>
          </div>
        ) : (
          <ul className="space-y-3.5">
            {courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.code.toLowerCase()}`}
                  className="block rounded-3xl border border-stone-200 bg-white p-5 shadow-xs transition hover:border-teal-300 hover:shadow-sm active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-800">
                        {course.code}
                      </span>
                      <h2 className="mt-2 text-lg font-bold text-stone-900">
                        {course.title}
                      </h2>
                      {course.description && (
                        <p className="mt-1 text-sm text-stone-600">
                          {course.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className="mt-1 h-5 w-5 shrink-0 text-stone-400"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
                      <span>
                        {course.learnedWords} / {course.totalWords} words learned
                      </span>
                      <span className="text-teal-700">{course.percentage}%</span>
                    </div>
                    <div
                      className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-stone-100"
                      role="progressbar"
                      aria-valuenow={course.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${course.title} completion`}
                    >
                      <div
                        className="h-full rounded-full bg-teal-600 transition-all"
                        style={{ width: `${course.percentage}%` }}
                      />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
