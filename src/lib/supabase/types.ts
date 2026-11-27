export type ProgressStatus = "unlearned" | "learned";

export const WORD_TYPES = [
  "verb",
  "noun",
  "adjective",
  "adverb",
  "pronoun",
  "conjunction",
  "preposition",
  "interjection",
  "number",
  "phrase",
  "other",
] as const;

export type WordType = (typeof WORD_TYPES)[number];

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  sort_order: number;
  is_published: boolean;
}

export interface Lesson {
  id: string;
  course_id: string;
  unit_number: number;
  title: string;
  sort_order: number;
}

export interface Word {
  id: string;
  turkish: string;
  english: string;
  persian: string;
  frequency_rank: number;
  type: WordType;
}

export interface UserWordProgress {
  user_id: string;
  word_id: string;
  status: ProgressStatus;
  review_count: number;
  last_reviewed_at: string | null;
  updated_at: string;
}

export interface StudyWord extends Word {
  status: ProgressStatus;
  review_count: number;
}

export interface CourseWithProgress extends Course {
  totalWords: number;
  learnedWords: number;
  percentage: number;
}

export interface LessonWithProgress extends Lesson {
  totalWords: number;
  learnedWords: number;
  percentage: number;
}
