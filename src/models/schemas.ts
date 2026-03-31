import { z } from 'astro/zod';

// Schema for collection: users
export const UsersSchema = z.object({
  id: z.string(),
  created: z.date(),
  updated: z.date(),
  email: z.email(),
  emailVisibility: z.boolean().optional().nullable(),
  verified: z.boolean().optional().nullable(),
  name: z.string().max(255).optional().nullable(),
  avatar: z.url().optional().nullable(),
});

export type Users = z.infer<typeof UsersSchema>;

// Schema for collection: questionCategories
export const QuestionCategoriesSchema = z.object({
  id: z.string(),
  created: z.date(),
  updated: z.date(),
  name: z.string().optional().nullable(),
});

export type QuestionCategories = z.infer<typeof QuestionCategoriesSchema>;

// Schema for collection: questions
export const QuestionsSchema = z.object({
  id: z.string(),
  created: z.date(),
  updated: z.date(),
  text: z.string().optional().nullable(),
  type: z.enum(['single', 'multiple', 'open', 'yesNo']).optional().nullable(),
  options: z.string().optional().nullable(),
  field: z.string().optional().nullable(),
  maxSelection: z.number().optional().nullable(),
  optional: z.boolean().optional().nullable(),
});

export type Questions = z.infer<typeof QuestionsSchema>;

// Schema for collection: surveys
export const SurveysSchema = z.object({
  id: z.string(),
  created: z.date(),
  updated: z.date(),
  completed: z.boolean().optional().nullable(),
});

export type Surveys = z.infer<typeof SurveysSchema>;

// Schema for collection: surveyAnswers
export const SurveyAnswersSchema = z.object({
  id: z.string(),
  created: z.date(),
  updated: z.date(),
  surveyId: z.string().optional().nullable(),
  questionId: z.string().optional().nullable(),
  answer: z.string().optional().nullable(),
});

export type SurveyAnswers = z.infer<typeof SurveyAnswersSchema>;

