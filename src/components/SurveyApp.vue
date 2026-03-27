<script setup lang="ts">
import { ref } from 'vue'
import SurveyForm     from './SurveyForm.vue'
import SurveyThankYou from './SurveyThankYou.vue'
// import SurveyResults  from './SurveyResults.vue'

defineOptions({ name: 'SurveyApp' })

type View = 'form' | 'thankyou' | 'results'

const view          = ref<View>('form')
const completedSurveyId = ref('')

function onCompleted(surveyId: string) {
  completedSurveyId.value = surveyId
  view.value = 'thankyou'
}
</script>

<template>
  <SurveyForm
    v-if="view === 'form'"
    @completed="onCompleted"
  />
  <SurveyThankYou
    v-else-if="view === 'thankyou'"
    :survey-id="completedSurveyId"
    @view-results="view = 'results'"
  />
  <!-- <SurveyResults
    v-else-if="view === 'results'"
  /> -->
</template>