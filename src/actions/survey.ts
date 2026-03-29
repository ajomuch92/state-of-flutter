import { ActionError, defineAction } from 'astro:actions'
import type { Questions, SurveyAnswers, Surveys } from '../models/schemas'

import { createPB } from '../data'
import { z } from 'astro/zod'

// ── Helpers ────────────────────────────────────────────────────

function pbError(e: unknown, fallback: string): never {
  const msg = e instanceof Error ? e.message : fallback
  throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: msg })
}

// ── Actions ────────────────────────────────────────────────────

export const server = {

  /**
   * Fetch the latest active survey.
   */
  getSurvey: defineAction({
    handler: async () => {
      try {
        const pb = createPB()

        const result = await pb
          .collection('surveys')
          .getList<Surveys>(1, 1, { sort: '-created' })

        if (!result.items.length) {
          throw new ActionError({
            code: 'NOT_FOUND',
            message: 'No active survey found.',
          })
        }

        const survey = result.items[0]
        return {
          id:      survey.id,
          created: survey.created,
          updated: survey.updated,
        }
      } catch (e) {
        if (e instanceof ActionError) throw e
        pbError(e, 'Failed to fetch survey.')
      }
    },
  }),

  createSurvey: defineAction({
    handler: async () => {
      try {
        const pb = createPB()
        const survey = await pb.collection('surveys').create<Surveys>()

        return {
          id:      survey.id,
          created: survey.created,
          updated: survey.updated,
        }
      } catch (e) {
        if (e instanceof ActionError) throw e
        pbError(e, 'Failed to create survey.')
      }
    },
  }),

  /**
   * Fetch all questions for a survey, expanded with their category.
   */
  getQuestions: defineAction({
    input: z.object({
      surveyId: z.string(),
    }),
    handler: async ({ surveyId: _surveyId }) => {
      // surveyId is accepted for future filtering; currently questions are global
      try {
        const pb = createPB()
        const items = await pb
          .collection('questions')
          .getFullList<Questions & { expand?: { field?: { id: string; name: string } } }>({
            expand: 'field',
            sort:   'field,created',
          })

        return items.map(q => ({
          id:           q.id,
          text:         q.text         ?? '',
          type:         q.type         ?? 'open',
          options:      q.options      ?? '[]',
          field:        q.field        ?? null,
          maxSelection: q.maxSelection ?? null,
          categoryName: q.expand?.field?.name ?? null,
        }))
      } catch (e) {
        pbError(e, 'Failed to fetch questions.')
      }
    },
  }),

  /**
   * Submit all answers for a completed survey.
   * Receives an array of { questionId, answer } and persists one
   * surveyAnswers record per question.
   */
  submitAnswers: defineAction({
    input: z.object({
      surveyId: z.string(),
      answers: z.array(
        z.object({
          questionId: z.string(),
          /** Plain string for open/single/yesNo, JSON-serialized array for multiple */
          answer: z.string(),
        })
      ).min(1),
    }),
    handler: async ({ surveyId, answers }) => {
      try {
        const pb = createPB()
        const batch = pb.createBatch()
        for (const { questionId, answer } of answers) {
          batch.collection('surveyAnswers').create({
            surveyId,
            questionId,
            answer,
          })
        }
        batch.collection('surveys').update(surveyId, { completed: true })
        await batch.send()
        return { success: true, surveyId }
      } catch (e) {
        pbError(e, 'Failed to submit answers.')
      }
    },
  }),

  /**
   * Fetch aggregated results for a survey.
   * Returns questions + all their answers so the client can compute stats.
   */
  getResults: defineAction({
    input: z.object({
      surveyId: z.string(),
    }),
    handler: async ({ surveyId }) => {
      try {
        const pb = createPB()
        const [questions, answers] = await Promise.all([
          pb
            .collection('questions')
            .getFullList<Questions & { expand?: { field?: { id: string; name: string } } }>({
              expand: 'field',
              sort:   'field,created',
            }),
          pb
            .collection('surveyAnswers')
            .getFullList<SurveyAnswers>({
              filter: `surveyId = "${surveyId}"`,
            }),
        ])

        return {
          questions: questions.map(q => ({
            id:           q.id,
            text:         q.text         ?? '',
            type:         q.type         ?? 'open',
            options:      q.options      ?? '[]',
            field:        q.field        ?? null,
            maxSelection: q.maxSelection ?? null,
            categoryName: q.expand?.field?.name ?? null,
          })),
          answers: answers.map(a => ({
            id:         a.id,
            questionId: a.questionId ?? '',
            answer:     a.answer     ?? '',
          })),
        }
      } catch (e) {
        pbError(e, 'Failed to fetch results.')
      }
    },
  }),
}