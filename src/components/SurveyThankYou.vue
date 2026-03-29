<script setup lang="ts">
defineProps<{ surveyId: string }>()
defineEmits<{ (e: 'viewResults'): void }>()

defineOptions({ name: 'SurveyThankYou' })
</script>

<template>
  <div class="min-h-screen bg-flutter-bg flex items-center justify-center px-4 font-syne">

    <!-- Blobs -->
    <div class="fixed -top-37.5 -left-25 w-125 h-125 rounded-full bg-flutter-teal opacity-[.12] blur-[120px] pointer-events-none"></div>
    <div class="fixed -bottom-20 -right-20 size-100 rounded-full bg-blue-700 opacity-[.12] blur-[120px] pointer-events-none"></div>

    <div class="relative z-10 text-center max-w-lg">

      <!-- Icon -->
      <div class="mx-auto mb-8 w-20 h-20 rounded-full flex items-center justify-center"
           style="background: linear-gradient(135deg, rgba(1,186,239,.15), rgba(84,197,248,.08)); border: 1px solid rgba(84,197,248,.2)">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#01BAEF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <path d="M22 4 12 14.01l-3-3"/>
        </svg>
      </div>

      <!-- Headline -->
      <div class="inline-flex items-center gap-2 font-mono text-[.7rem] tracking-[.14em] uppercase text-flutter-teal border border-flutter-teal/30 bg-flutter-teal/[.07] px-4 py-1.5 rounded-full mb-6">
        <span class="w-1.5 h-1.5 rounded-full bg-flutter-accent animate-pulse inline-block"></span>
        Survey Submitted
      </div>

      <h1 class="font-syne font-extrabold text-white text-4xl leading-tight mb-4">
        Thank you for<br/>your response!
      </h1>

      <p class="text-slate-400 text-base leading-relaxed mb-10">
        Your answers will help us understand the state of Flutter development in 2026.
        Results will be published openly for the whole community.
      </p>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <!-- <button
          @click="$emit('viewResults')"
          class="inline-flex items-center gap-2 font-mono font-bold text-sm tracking-widest px-8 py-3.5 rounded-full transition-all duration-200 hover:-translate-y-0.5"
          style="background: linear-gradient(135deg,#01BAEF,#54C5F8); color:#050E1A; box-shadow:0 0 28px rgba(1,186,239,.35)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
          </svg>
          View Results
        </button> -->

        <a
          href="https://twitter.com/intent/tweet?text=I+just+took+the+State+of+Flutter+2026+survey!+%23Flutter+%23Dart"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 font-mono text-sm tracking-widest px-8 py-3.5 rounded-full border border-flutter-blue/20 text-slate-400 hover:border-flutter-blue/50 hover:text-slate-200 transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.622 5.905-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          Share on X
        </a>
      </div>

      <!-- Survey ID -->
      <p class="font-mono text-[.65rem] tracking-widest text-slate-600 mt-10">
        Survey ID: {{ surveyId }}
      </p>

    </div>
  </div>
</template>