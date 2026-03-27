<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { actions } from 'astro:actions'

defineOptions({ name: 'SurveyForm' })

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

// ── Emits ──────────────────────────────────────────────────────
const emit = defineEmits<{
  (e: 'completed', surveyId: string): void
}>()

// ── State ──────────────────────────────────────────────────────
const surveyId    = ref<string | null>(null)
const questions   = ref<Question[]>([])
const answers     = ref<Record<string, string | string[]>>({})
const currentStep = ref(0)
const loading     = ref(true)
const submitting  = ref(false)
const error       = ref<string | null>(null)

// ── Computed ───────────────────────────────────────────────────
const currentQuestion = computed(() => questions.value[currentStep.value])
const isLast          = computed(() => currentStep.value === questions.value.length - 1)
const progress        = computed(() =>
  questions.value.length
    ? Math.round((currentStep.value / questions.value.length) * 100)
    : 0
)
const currentAnswer = computed(() =>
  currentQuestion.value ? (answers.value[currentQuestion.value.id] ?? null) : null
)
const canAdvance = computed(() => {
  const a = currentAnswer.value
  if (!a) return false
  if (Array.isArray(a)) return a.length > 0
  return String(a).trim().length > 0
})

// ── Helpers ────────────────────────────────────────────────────
function parseOptions(raw: string): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function setAnswer(questionId: string, value: string | string[]) {
  answers.value = { ...answers.value, [questionId]: value }
}

function toggleMultiple(questionId: string, option: string, max: number | null) {
  const current = (answers.value[questionId] as string[]) ?? []
  if (current.includes(option)) {
    setAnswer(questionId, current.filter(o => o !== option))
  } else {
    if (max !== null && current.length >= max) return
    setAnswer(questionId, [...current, option])
  }
}

function isChecked(questionId: string, option: string): boolean {
  const a = answers.value[questionId]
  return Array.isArray(a) ? a.includes(option) : false
}

// ── Load ───────────────────────────────────────────────────────
onMounted(async () => {
  try {
    // 1. Fetch latest survey
    const { data: survey, error: surveyErr } = await actions.getSurvey({})
    if (surveyErr) throw new Error(surveyErr.message)

    surveyId.value = survey!.id

    // 2. Fetch questions for that survey
    const { data: qs, error: qErr } = await actions.getQuestions({
      surveyId: survey!.id,
    })
    if (qErr) throw new Error(qErr.message)

    questions.value = (qs ?? []) as Question[]
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load survey.'
  } finally {
    loading.value = false
  }
})

// ── Navigation ─────────────────────────────────────────────────
function next() {
  if (canAdvance.value && !isLast.value) currentStep.value++
}
function prev() {
  if (currentStep.value > 0) currentStep.value--
}

// ── Submit ─────────────────────────────────────────────────────
async function submit() {
  if (!surveyId.value || submitting.value || !canAdvance.value) return
  submitting.value = true
  error.value = null

  try {
    const payload = questions.value.map(q => ({
      questionId: q.id,
      answer: Array.isArray(answers.value[q.id])
        ? JSON.stringify(answers.value[q.id])
        : (answers.value[q.id] as string) ?? '',
    }))

    const { data, error: submitErr } = await actions.submitAnswers({
      surveyId: surveyId.value,
      answers:  payload,
    })

    if (submitErr) throw new Error(submitErr.message)
    emit('completed', data!.surveyId)
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to submit. Please try again.'
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-flutter-bg text-slate-200 font-syne flex items-center justify-center px-4 py-16">

    <!-- Loading -->
    <div v-if="loading" class="text-center">
      <div class="w-10 h-10 border-2 border-flutter-teal border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="font-mono text-sm text-slate-500 tracking-widest">LOADING SURVEY…</p>
    </div>

    <!-- Global error (failed to load) -->
    <div v-else-if="error && !questions.length" class="text-center max-w-sm">
      <p class="text-red-400 font-mono text-sm">{{ error }}</p>
    </div>

    <!-- Survey -->
    <div v-else class="w-full max-w-2xl">

      <!-- Header -->
      <div class="mb-8 text-center">
        <span class="font-mono text-[.7rem] tracking-[.14em] uppercase text-flutter-teal border border-flutter-teal/30 bg-flutter-teal/[.07] px-4 py-1.5 rounded-full">
          State of Flutter · 2026
        </span>
        <p class="font-mono text-xs text-slate-500 mt-4 tracking-wider">
          Question {{ currentStep + 1 }} of {{ questions.length }}
        </p>
      </div>

      <!-- Progress bar -->
      <div class="w-full h-1 bg-flutter-card rounded-full mb-10 overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :style="{ width: progress + '%', background: 'linear-gradient(90deg, #01BAEF, #54C5F8)' }"
        ></div>
      </div>

      <!-- Question card -->
      <div
        v-if="currentQuestion"
        class="border border-flutter-blue/10 rounded-2xl bg-flutter-card p-8 shadow-xl"
      >

        <!-- Category badge -->
        <span
          v-if="currentQuestion.categoryName"
          class="inline-block font-mono text-[.68rem] tracking-widest uppercase text-flutter-accent border border-flutter-accent/30 bg-flutter-accent/6 px-3 py-1 rounded-full mb-5"
        >
          {{ currentQuestion.categoryName }}
        </span>

        <!-- Question text -->
        <h2 class="font-syne font-bold text-white text-xl leading-snug mb-6">
          {{ currentQuestion.text }}
        </h2>

        <!-- ── Single ── -->
        <div v-if="currentQuestion.type === 'single'" class="space-y-3">
          <label
            v-for="option in parseOptions(currentQuestion.options)"
            :key="option"
            class="flex items-center gap-3 cursor-pointer group"
          >
            <input
              type="radio"
              :name="`q-${currentQuestion.id}`"
              :value="option"
              :checked="currentAnswer === option"
              @change="setAnswer(currentQuestion.id, option)"
              class="hidden"
            />
            <span
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150"
              :class="currentAnswer === option
                ? 'border-flutter-teal bg-flutter-teal'
                : 'border-slate-600 group-hover:border-flutter-teal/60'"
            >
              <span v-if="currentAnswer === option" class="w-2 h-2 rounded-full bg-flutter-bg"></span>
            </span>
            <span
              class="text-sm transition-colors duration-150"
              :class="currentAnswer === option ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'"
            >
              {{ option }}
            </span>
          </label>
        </div>

        <!-- ── Multiple ── -->
        <div v-else-if="currentQuestion.type === 'multiple'" class="space-y-3">
          <p v-if="currentQuestion.maxSelection" class="font-mono text-[.68rem] tracking-widest text-slate-500 uppercase mb-2">
            Select up to {{ currentQuestion.maxSelection }}
          </p>
          <label
            v-for="option in parseOptions(currentQuestion.options)"
            :key="option"
            class="flex items-center gap-3 cursor-pointer group"
          >
            <input
              type="checkbox"
              :value="option"
              :checked="isChecked(currentQuestion.id, option)"
              @change="toggleMultiple(currentQuestion.id, option, currentQuestion.maxSelection)"
              class="hidden"
            />
            <span
              class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-150"
              :class="isChecked(currentQuestion.id, option)
                ? 'border-flutter-teal bg-flutter-teal'
                : 'border-slate-600 group-hover:border-flutter-teal/60'"
            >
              <svg v-if="isChecked(currentQuestion.id, option)" width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#050E1A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <span
              class="text-sm transition-colors duration-150"
              :class="isChecked(currentQuestion.id, option) ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'"
            >
              {{ option }}
            </span>
          </label>
        </div>

        <!-- ── Yes / No ── -->
        <div v-else-if="currentQuestion.type === 'yesNo'" class="flex gap-4">
          <button
            v-for="opt in ['Yes', 'No']"
            :key="opt"
            @click="setAnswer(currentQuestion.id, opt)"
            class="flex-1 py-3 rounded-xl font-mono text-sm tracking-widest border-2 transition-all duration-150"
            :class="currentAnswer === opt
              ? 'border-flutter-teal bg-flutter-teal/15 text-flutter-teal'
              : 'border-slate-700 text-slate-400 hover:border-flutter-teal/40 hover:text-slate-200'"
          >
            {{ opt }}
          </button>
        </div>

        <!-- ── Open ── -->
        <div v-else-if="currentQuestion.type === 'open'">
          <textarea
            :value="(currentAnswer as string) ?? ''"
            @input="setAnswer(currentQuestion.id, ($event.target as HTMLTextAreaElement).value)"
            rows="4"
            placeholder="Your answer…"
            class="w-full bg-flutter-bg border border-slate-700 focus:border-flutter-teal outline-none rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 font-syne resize-none transition-colors duration-150"
          ></textarea>
        </div>
      </div>

      <!-- Inline submit error -->
      <p v-if="error" class="font-mono text-xs text-red-400 text-center mt-4">{{ error }}</p>

      <!-- Navigation -->
      <div class="flex items-center justify-between mt-6">
        <button
          @click="prev"
          :disabled="currentStep === 0"
          class="font-mono text-xs tracking-widest uppercase text-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-4 py-2"
        >
          ← Back
        </button>

        <!-- Next -->
        <button
          v-if="!isLast"
          @click="next"
          :disabled="!canAdvance"
          class="inline-flex items-center gap-2 font-mono font-bold text-sm tracking-widest px-8 py-3 rounded-full transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          :style="canAdvance
            ? 'background:linear-gradient(135deg,#01BAEF,#54C5F8);color:#050E1A;box-shadow:0 0 28px rgba(1,186,239,.35)'
            : 'background:#0d2035;color:#6e90a8'"
        >
          Next →
        </button>

        <!-- Submit -->
        <button
          v-else
          @click="submit"
          :disabled="!canAdvance || submitting"
          class="inline-flex items-center gap-2 font-mono font-bold text-sm tracking-widest px-8 py-3 rounded-full transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          :style="canAdvance && !submitting
            ? 'background:linear-gradient(135deg,#01BAEF,#54C5F8);color:#050E1A;box-shadow:0 0 28px rgba(1,186,239,.35)'
            : 'background:#0d2035;color:#6e90a8'"
        >
          <svg v-if="submitting" class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          {{ submitting ? 'Submitting…' : 'Submit Survey' }}
        </button>
      </div>

    </div>
  </div>
</template>