<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { actions } from 'astro:actions'

// ── Types ──────────────────────────────────────────────────────
interface Question {
  id:           string
  text:         string
  type:         'single' | 'multiple' | 'open' | 'yesNo'
  options:      string
  field:        string | null
  maxSelection: number | null
  categoryName: string | null
}
interface AnswerRow {
  id:         string
  questionId: string
  answer:     string
}

// ── State ──────────────────────────────────────────────────────
const questions = ref<Question[]>([])
const answers   = ref<AnswerRow[]>([])
const loading   = ref(true)
const error     = ref<string | null>(null)
const totalRespondents = ref(0)

// ── Load ───────────────────────────────────────────────────────
onMounted(async () => {
  try {
    // Get latest survey first
    const { data: survey, error: surveyErr } = await actions.getSurvey({})
    if (surveyErr) throw new Error(surveyErr.message)

    const { data, error: resultsErr } = await actions.getResults({
      surveyId: survey!.id,
    })
    if (resultsErr) throw new Error(resultsErr.message)

    questions.value = (data!.questions ?? []) as Question[]
    answers.value   = data!.answers ?? []

    // Proxy for unique respondents: max answers for any single question
    if (questions.value.length) {
      const counts = questions.value.map(q => answersFor(q.id).length)
      totalRespondents.value = Math.max(...counts)
    }
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load results.'
  } finally {
    loading.value = false
  }
})

// ── Helpers ────────────────────────────────────────────────────
function parseOptions(raw: string): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function answersFor(questionId: string): AnswerRow[] {
  return answers.value.filter(a => a.questionId === questionId)
}

function totalFor(questionId: string): number {
  return answersFor(questionId).length
}

function countOption(questionId: string, option: string): number {
  return answersFor(questionId).filter(a => a.answer === option).length
}

function countMultiple(questionId: string, option: string): number {
  return answersFor(questionId).reduce((acc, a) => {
    try {
      const arr: string[] = JSON.parse(a.answer)
      return acc + (arr.includes(option) ? 1 : 0)
    } catch { return acc }
  }, 0)
}

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100)
}

function openAnswers(questionId: string): string[] {
  return answersFor(questionId).map(a => a.answer.trim()).filter(Boolean)
}

// Group questions by category
const grouped = computed(() => {
  const map = new Map<string, { categoryName: string; questions: Question[] }>()
  for (const q of questions.value) {
    const key  = q.field ?? '__none__'
    const name = q.categoryName ?? 'General'
    if (!map.has(key)) map.set(key, { categoryName: name, questions: [] })
    map.get(key)!.questions.push(q)
  }
  return Array.from(map.values())
})
</script>

<template>
  <div class="min-h-screen bg-flutter-bg text-slate-200 font-syne px-4 py-16">
    <div class="max-w-3xl mx-auto">

      <!-- Header -->
      <div class="text-center mb-14">
        <div class="inline-flex items-center gap-2 font-mono text-[.7rem] tracking-[.14em] uppercase text-flutter-teal border border-flutter-teal/30 bg-flutter-teal/[.07] px-4 py-1.5 rounded-full mb-6">
          <span class="w-1.5 h-1.5 rounded-full bg-flutter-accent animate-pulse inline-block"></span>
          Live Results · 2026
        </div>
        <h1 class="font-syne font-extrabold text-white text-[clamp(2rem,5vw,3rem)] leading-tight mb-3">
          State of Flutter
        </h1>
        <p class="text-slate-400 text-sm">
          <span class="font-mono text-flutter-blue font-bold">{{ totalRespondents }}</span>
          developer{{ totalRespondents !== 1 ? 's' : '' }} responded so far
        </p>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-20">
        <div class="w-10 h-10 border-2 border-flutter-teal border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="font-mono text-sm text-slate-500 tracking-widest">LOADING RESULTS…</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center text-red-400 font-mono text-sm py-20">
        {{ error }}
      </div>

      <!-- Results -->
      <div v-else class="space-y-12">
        <section v-for="group in grouped" :key="group.categoryName">

          <!-- Category header -->
          <div class="flex items-center gap-3 mb-6">
            <span class="font-mono text-[.7rem] tracking-[.14em] uppercase text-flutter-accent border border-flutter-accent/30 bg-flutter-accent/6 px-3 py-1 rounded-full whitespace-nowrap">
              {{ group.categoryName }}
            </span>
            <div class="flex-1 h-px" style="background: linear-gradient(90deg, rgba(84,197,248,.15), transparent)"></div>
          </div>

          <div class="space-y-6">
            <div
              v-for="q in group.questions"
              :key="q.id"
              class="border border-flutter-blue/10 rounded-2xl bg-flutter-card p-6"
            >
              <h3 class="font-syne font-bold text-white text-base mb-1 leading-snug">{{ q.text }}</h3>
              <p class="font-mono text-[.68rem] tracking-widest text-slate-500 uppercase mb-5">
                {{ totalFor(q.id) }} response{{ totalFor(q.id) !== 1 ? 's' : '' }}
              </p>

              <!-- Single / yesNo -->
              <div v-if="q.type === 'single' || q.type === 'yesNo'" class="space-y-3">
                <div
                  v-for="option in (q.type === 'yesNo' ? ['Yes', 'No'] : parseOptions(q.options))"
                  :key="option"
                >
                  <div class="flex justify-between items-center mb-1.5">
                    <span class="text-sm text-slate-300">{{ option }}</span>
                    <span class="font-mono text-xs text-flutter-blue">
                      {{ pct(countOption(q.id, option), totalFor(q.id)) }}%
                      <span class="text-slate-600 ml-1">({{ countOption(q.id, option) }})</span>
                    </span>
                  </div>
                  <div class="h-2 bg-flutter-bg rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-700"
                      :style="{
                        width: pct(countOption(q.id, option), totalFor(q.id)) + '%',
                        background: 'linear-gradient(90deg, #01BAEF, #54C5F8)'
                      }"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Multiple -->
              <div v-else-if="q.type === 'multiple'" class="space-y-3">
                <p class="font-mono text-[.65rem] text-slate-600 tracking-widest uppercase mb-3">
                  % of respondents per option
                </p>
                <div
                  v-for="option in parseOptions(q.options)"
                  :key="option"
                >
                  <div class="flex justify-between items-center mb-1.5">
                    <span class="text-sm text-slate-300">{{ option }}</span>
                    <span class="font-mono text-xs text-flutter-blue">
                      {{ pct(countMultiple(q.id, option), totalFor(q.id)) }}%
                      <span class="text-slate-600 ml-1">({{ countMultiple(q.id, option) }})</span>
                    </span>
                  </div>
                  <div class="h-2 bg-flutter-bg rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-700"
                      :style="{
                        width: Math.min(pct(countMultiple(q.id, option), totalFor(q.id)), 100) + '%',
                        background: 'linear-gradient(90deg, #FFC107, #FFD54F)'
                      }"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Open -->
              <div v-else-if="q.type === 'open'">
                <p v-if="!openAnswers(q.id).length" class="font-mono text-xs text-slate-600">No answers yet.</p>
                <ul v-else class="space-y-2 max-h-60 overflow-y-auto pr-1">
                  <li
                    v-for="(ans, i) in openAnswers(q.id)"
                    :key="i"
                    class="text-sm text-slate-300 border-l-2 border-flutter-teal/30 pl-3 py-0.5 leading-relaxed"
                  >
                    {{ ans }}
                  </li>
                </ul>
              </div>

            </div>
          </div>

        </section>
      </div>

    </div>
  </div>
</template>