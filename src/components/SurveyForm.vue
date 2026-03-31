<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { actions } from 'astro:actions'

  defineOptions({ name: 'SurveyForm' })

  // ── Types ──────────────────────────────────────────────────────
  interface Question {
    id: string
    text: string
    type: 'single' | 'multiple' | 'open' | 'yesNo'
    options: string
    field: string | null
    maxSelection: number | null
    categoryName: string | null
    optional: boolean
  }

  // ── Emits ──────────────────────────────────────────────────────
  const emit = defineEmits<{
    (e: 'completed', surveyId: string): void
  }>()

  // ── State ──────────────────────────────────────────────────────
  const surveyId        = ref<string | null>(null)
  const questions       = ref<Question[]>([])
  const answers         = ref<Record<string, string | string[]>>({})
  const otherInputs     = ref<Record<string, string>>({})   // questionId → free-text value
  const currentStep     = ref(0)
  const loading         = ref(true)
  const submitting      = ref(false)
  const cancelling      = ref(false)
  const showCancelModal = ref(false)
  const error           = ref<string | null>(null)

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
    // Optional with no answer → always allowed (skip)
    if (!a || (Array.isArray(a) && a.length === 0)) {
      return currentQuestion.value?.optional ?? false
    }

    if (Array.isArray(a)) {
      if (hasOtherSelected(currentQuestion.value?.id ?? '')) {
        return (otherInputs.value[currentQuestion.value?.id ?? ''] ?? '').trim().length > 0
      }
      return true
    }

    // single: if "other" is selected, input must be filled
    if (isOtherOption(a as string)) {
      return (otherInputs.value[currentQuestion.value?.id ?? ''] ?? '').trim().length > 0
    }
    return String(a).trim().length > 0
  })

  const isOptional = computed(() => currentQuestion.value?.optional ?? false)

  // ── Other helpers ──────────────────────────────────────────────
  function isOtherOption(value: string): boolean {
    return /^others?$/i.test(value.trim())
  }

  function hasOtherSelected(questionId: string): boolean {
    const a = answers.value[questionId]
    if (!a) return false
    if (Array.isArray(a)) return a.some(isOtherOption)
    return isOtherOption(a as string)
  }

  /**
   * Build the final answer string/array to persist.
   * Replaces "other"/"others" with the actual typed value.
   */
  function resolveAnswer(questionId: string): string | string[] {
    const raw = answers.value[questionId]
    const freeText = (otherInputs.value[questionId] ?? '').trim()

    if (Array.isArray(raw)) {
      return raw.map(v => (isOtherOption(v) && freeText ? freeText : v))
    }
    if (raw && isOtherOption(raw as string) && freeText) return freeText
    return raw ?? ''
  }

  // ── Generic helpers ────────────────────────────────────────────
  function parseOptions(raw: string): string[] {
    if (!raw) return []
    try { return raw.split(',').map(s => s.trim()) } catch { return [] }
  }

  function setAnswer(questionId: string, value: string | string[]) {
    answers.value = { ...answers.value, [questionId]: value }
    // Clear other input when a different single option is chosen
    if (!Array.isArray(value) && !isOtherOption(value)) {
      const o = { ...otherInputs.value }
      delete o[questionId]
      otherInputs.value = o
    }
  }

  function setOtherInput(questionId: string, value: string) {
    otherInputs.value = { ...otherInputs.value, [questionId]: value }
  }

  function toggleMultiple(questionId: string, option: string, max: number | null) {
    const current = (answers.value[questionId] as string[]) ?? []
    if (current.includes(option)) {
      setAnswer(questionId, current.filter(o => o !== option))
      // Clear other input when "other" is deselected
      if (isOtherOption(option)) {
        const o = { ...otherInputs.value }
        delete o[questionId]
        otherInputs.value = o
      }
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
      const { data: survey, error: surveyErr } = await actions.createSurvey({})
      if (surveyErr) throw new Error(surveyErr.message)
      surveyId.value = survey!.id

      const { data: qs, error: qErr } = await actions.getQuestions({ surveyId: survey!.id })
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

  function skip() {
    // Clear any partial answer for this question
    const id = currentQuestion.value?.id
    if (id) {
      const a = { ...answers.value }
      delete a[id]
      answers.value = a
      const o = { ...otherInputs.value }
      delete o[id]
      otherInputs.value = o
    }
    if (!isLast.value) currentStep.value++
    else submit()
  }

  // ── Cancel ─────────────────────────────────────────────────────
  function requestCancel() { showCancelModal.value = true }
  function dismissCancel()  { showCancelModal.value = false }

  async function confirmCancel() {
    if (!surveyId.value || cancelling.value) return
    cancelling.value = true
    try {
      const { error: cancelErr } = await actions.cancelSurvey({ surveyId: surveyId.value })
      if (cancelErr) throw new Error(cancelErr.message)
      window.location.href = '/'
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to cancel survey.'
      cancelling.value = false
      showCancelModal.value = false
    }
  }

  // ── Submit ─────────────────────────────────────────────────────
  async function submit() {
    if (!surveyId.value || submitting.value || !canAdvance.value) return
    submitting.value = true
    error.value = null

    try {
      const payload = questions.value.map(q => {
        const resolved = resolveAnswer(q.id)
        return {
          questionId: q.id,
          answer: Array.isArray(resolved)
            ? JSON.stringify(resolved)
            : resolved,
        }
      }).filter((a) => !!a.answer)

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

    <!-- ── Cancel confirmation modal ── -->
    <Transition name="modal">
      <div v-if="showCancelModal" class="fixed inset-0 z-50 flex items-center justify-center px-4"
        @keydown.esc="dismissCancel">
        <div class="absolute inset-0 bg-flutter-bg/80 backdrop-blur-sm" @click="dismissCancel"></div>
        <div class="relative z-10 w-full max-w-sm border border-flutter-blue/15 rounded-2xl bg-flutter-card p-8 shadow-2xl">
          <div class="mx-auto mb-5 w-12 h-12 rounded-full flex items-center justify-center bg-red-500/10 border border-red-500/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h3 class="font-syne font-bold text-white text-lg text-center mb-2">Cancel survey?</h3>
          <p class="text-slate-400 text-sm text-center leading-relaxed mb-7">
            This will delete your current session and all answers you've entered so far. This action cannot be undone.
          </p>
          <div class="flex gap-3">
            <button @click="dismissCancel"
              class="cursor-pointer flex-1 py-2.5 rounded-xl font-mono text-sm tracking-widest border border-flutter-blue/20 text-slate-400 hover:border-flutter-blue/40 hover:text-slate-200 transition-all duration-150">
              Keep going
            </button>
            <button @click="confirmCancel" :disabled="cancelling"
              class="cursor-pointer flex-1 py-2.5 rounded-xl font-mono text-sm tracking-widest bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 inline-flex items-center justify-center gap-2">
              <svg v-if="cancelling" class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              {{ cancelling ? 'Cancelling…' : 'Yes, cancel' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Loading -->
    <div v-if="loading" class="text-center">
      <div class="w-10 h-10 border-2 border-flutter-teal border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="font-mono text-sm text-slate-500 tracking-widest">LOADING SURVEY…</p>
    </div>

    <!-- Global error -->
    <div v-else-if="error && !questions.length" class="text-center max-w-sm">
      <p class="text-red-400 font-mono text-sm">{{ error }}</p>
    </div>

    <!-- Survey -->
    <div v-else class="w-full max-w-2xl">

      <!-- Header -->
      <div class="mb-8 flex items-start justify-between gap-4">
        <div class="flex-1 text-center">
          <span class="font-mono text-[.7rem] tracking-[.14em] uppercase text-flutter-teal border border-flutter-teal/30 bg-flutter-teal/[.07] px-4 py-1.5 rounded-full">
            State of Flutter · 2026
          </span>
          <p class="font-mono text-xs text-slate-500 mt-4 tracking-wider">
            Question {{ currentStep + 1 }} of {{ questions.length }}
          </p>
        </div>
        <button @click="requestCancel"
          class="cursor-pointer mt-0.5 flex items-center gap-1.5 font-mono text-[.68rem] tracking-widest uppercase text-slate-600 hover:text-red-400 transition-colors duration-150 px-2 py-1 rounded-lg hover:bg-red-500/5 shrink-0"
          title="Cancel survey">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Cancel
        </button>
      </div>

      <!-- Progress bar -->
      <div class="w-full h-1 bg-flutter-card rounded-full mb-10 overflow-hidden">
        <div class="h-full rounded-full transition-all duration-500"
          :style="{ width: progress + '%', background: 'linear-gradient(90deg, #01BAEF, #54C5F8)' }"></div>
      </div>

      <!-- Question card -->
      <div v-if="currentQuestion" class="border border-flutter-blue/10 rounded-2xl bg-flutter-card p-8 shadow-xl">

        <!-- Card top row: category + optional badge + skip -->
        <div class="flex items-center justify-between gap-3 mb-5">
          <div class="flex items-center gap-2 flex-wrap">
            <span v-if="currentQuestion.categoryName"
              class="inline-block font-mono text-[.68rem] tracking-widest uppercase text-flutter-accent border border-flutter-accent/30 bg-flutter-accent/6 px-3 py-1 rounded-full">
              {{ currentQuestion.categoryName }}
            </span>
            <span v-if="isOptional"
              class="inline-block font-mono text-[.65rem] tracking-widest uppercase text-slate-500 border border-slate-700 bg-slate-800/50 px-2.5 py-1 rounded-full">
              Optional
            </span>
          </div>
          <button v-if="isOptional" @click="skip"
            class="cursor-pointer shrink-0 inline-flex items-center gap-1.5 font-mono text-[.68rem] tracking-widest uppercase text-slate-500 hover:text-flutter-teal border border-slate-700 hover:border-flutter-teal/40 bg-transparent hover:bg-flutter-teal/5 px-3 py-1 rounded-full transition-all duration-150">
            Skip
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <!-- Question text -->
        <h2 class="font-syne font-bold text-white text-xl leading-snug mb-6">
          {{ currentQuestion.text }}
        </h2>

        <!-- ── Single ── -->
        <div v-if="currentQuestion.type === 'single'" class="space-y-3">
          <label v-for="option in parseOptions(currentQuestion.options)" :key="option"
            class="flex items-center gap-3 cursor-pointer group">
            <input type="radio" :name="`q-${currentQuestion.id}`" :value="option"
              :checked="currentAnswer === option"
              @change="setAnswer(currentQuestion.id, option)" class="hidden" />
            <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150"
              :class="currentAnswer === option
                ? 'border-flutter-teal bg-flutter-teal'
                : 'border-slate-600 group-hover:border-flutter-teal/60'">
              <span v-if="currentAnswer === option" class="w-2 h-2 rounded-full bg-flutter-bg"></span>
            </span>
            <span class="text-sm transition-colors duration-150"
              :class="currentAnswer === option ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'">
              {{ option }}
            </span>
          </label>

          <!-- Other free-text input (single) -->
          <Transition name="slide-down">
            <div v-if="isOtherOption(currentAnswer as string ?? '')" class="ml-8 mt-1">
              <input
                type="text"
                :value="otherInputs[currentQuestion.id] ?? ''"
                @input="setOtherInput(currentQuestion.id, ($event.target as HTMLInputElement).value)"
                placeholder="Please specify…"
                autofocus
                class="w-full bg-flutter-bg border border-flutter-teal/40 focus:border-flutter-teal outline-none rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 font-syne transition-colors duration-150"
              />
            </div>
          </Transition>
        </div>

        <!-- ── Multiple ── -->
        <div v-else-if="currentQuestion.type === 'multiple'" class="space-y-3">
          <p v-if="currentQuestion.maxSelection"
            class="font-mono text-[.68rem] tracking-widest text-slate-500 uppercase mb-2">
            Select up to {{ currentQuestion.maxSelection }}
          </p>
          <template v-for="option in parseOptions(currentQuestion.options)" :key="option">
            <label class="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" :value="option"
                :checked="isChecked(currentQuestion.id, option)"
                @change="toggleMultiple(currentQuestion.id, option, currentQuestion.maxSelection)"
                class="hidden" />
              <span class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-150"
                :class="isChecked(currentQuestion.id, option)
                  ? 'border-flutter-teal bg-flutter-teal'
                  : 'border-slate-600 group-hover:border-flutter-teal/60'">
                <svg v-if="isChecked(currentQuestion.id, option)" width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#050E1A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="text-sm transition-colors duration-150"
                :class="isChecked(currentQuestion.id, option) ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'">
                {{ option }}
              </span>
            </label>

            <!-- Other free-text input (multiple) -->
            <Transition name="slide-down">
              <div v-if="isOtherOption(option) && isChecked(currentQuestion.id, option)" class="ml-8">
                <input
                  type="text"
                  :value="otherInputs[currentQuestion.id] ?? ''"
                  @input="setOtherInput(currentQuestion.id, ($event.target as HTMLInputElement).value)"
                  placeholder="Please specify…"
                  autofocus
                  class="w-full bg-flutter-bg border border-flutter-teal/40 focus:border-flutter-teal outline-none rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 font-syne transition-colors duration-150"
                />
              </div>
            </Transition>
          </template>
        </div>

        <!-- ── Yes / No ── -->
        <div v-else-if="currentQuestion.type === 'yesNo'" class="flex gap-4">
          <button v-for="opt in ['Yes', 'No']" :key="opt"
            @click="setAnswer(currentQuestion.id, opt)"
            class="cursor-pointer flex-1 py-3 rounded-xl font-mono text-sm tracking-widest border-2 transition-all duration-150"
            :class="currentAnswer === opt
              ? 'border-flutter-teal bg-flutter-teal/15 text-flutter-teal'
              : 'border-slate-700 text-slate-400 hover:border-flutter-teal/40 hover:text-slate-200'">
            {{ opt }}
          </button>
        </div>

        <!-- ── Open ── -->
        <div v-else-if="currentQuestion.type === 'open'">
          <textarea :value="(currentAnswer as string) ?? ''"
            @input="setAnswer(currentQuestion.id, ($event.target as HTMLTextAreaElement).value)"
            rows="4" placeholder="Your answer…"
            class="w-full bg-flutter-bg border border-slate-700 focus:border-flutter-teal outline-none rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 font-syne resize-none transition-colors duration-150">
          </textarea>
        </div>
      </div>

      <!-- Inline submit error -->
      <p v-if="error" class="font-mono text-xs text-red-400 text-center mt-4">{{ error }}</p>

      <!-- Navigation -->
      <div class="flex items-center justify-between mt-6">
        <button @click="prev" :disabled="currentStep === 0"
          class="cursor-pointer font-mono text-xs tracking-widest uppercase text-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-4 py-2">
          ← Back
        </button>

        <!-- Next -->
        <button v-if="!isLast" @click="next" :disabled="!canAdvance"
          class="cursor-pointer inline-flex items-center gap-2 font-mono font-bold text-sm tracking-widest px-8 py-3 rounded-full transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          :style="canAdvance
            ? 'background:linear-gradient(135deg,#01BAEF,#54C5F8);color:#050E1A;box-shadow:0 0 28px rgba(1,186,239,.35)'
            : 'background:#0d2035;color:#6e90a8'">
          Next →
        </button>

        <!-- Submit -->
        <button v-else @click="submit" :disabled="!canAdvance || submitting"
          class="cursor-pointer inline-flex items-center gap-2 font-mono font-bold text-sm tracking-widest px-8 py-3 rounded-full transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          :style="canAdvance && !submitting
            ? 'background:linear-gradient(135deg,#01BAEF,#54C5F8);color:#050E1A;box-shadow:0 0 28px rgba(1,186,239,.35)'
            : 'background:#0d2035;color:#6e90a8'">
          <svg v-if="submitting" class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          {{ submitting ? 'Submitting…' : 'Submit Survey' }}
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity .2s ease;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform .2s ease, opacity .2s ease;
}
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-from .relative {
  transform: scale(.95) translateY(8px);
  opacity: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all .2s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}
.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 80px;
  margin-top: 0.25rem;
}
</style>