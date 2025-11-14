<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Sections & Questions</h2>
      <button
        @click="addSection"
        class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-all"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Section
      </button>
    </div>

    <!-- Sections List -->
    <div v-if="localForm.sections && localForm.sections.length > 0" class="space-y-4">
      <div
        v-for="(section, sectionIndex) in localForm.sections"
        :key="section.sectionId || sectionIndex"
        :draggable="true"
        @dragstart="(e) => handleSectionDragStart(e, sectionIndex)"
        @dragover.prevent="(e) => handleSectionDragOver(e, sectionIndex)"
        @dragleave="handleSectionDragLeave"
        @drop="(e) => handleSectionDrop(e, sectionIndex)"
        @dragend="handleSectionDragEnd"
        class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 cursor-move transition-all"
        :class="{ 
          'opacity-50': draggedSectionIndex === sectionIndex,
          'border-brand-500 border-2': dragOverSectionIndex === sectionIndex && draggedSectionIndex !== sectionIndex
        }"
      >
        <!-- Section Header -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2 flex-1">
            <!-- Drag Handle -->
            <svg class="w-5 h-5 text-gray-400 dark:text-gray-500 cursor-move flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
            </svg>
            <div class="flex-1">
              <input
                v-model="section.name"
                type="text"
                placeholder="Section name"
                class="text-lg font-semibold text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 w-full"
              />
              <div class="flex items-center gap-4 mt-2">
                <input
                  v-model.number="section.weightage"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Weightage %"
                  class="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
          <button
            @click="removeSection(sectionIndex)"
            class="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        <!-- Subsections -->
        <div class="ml-4 space-y-3">
          <div
            v-for="(subsection, subIndex) in section.subsections"
            :key="subsection.subsectionId || subIndex"
            :draggable="true"
            @dragstart="(e) => handleSubsectionDragStart(e, sectionIndex, subIndex)"
            @dragover.prevent="(e) => handleSubsectionDragOver(e, sectionIndex, subIndex)"
            @dragleave="handleSubsectionDragLeave"
            @drop="(e) => handleSubsectionDrop(e, sectionIndex, subIndex)"
            @dragend="handleSubsectionDragEnd"
            class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600 cursor-move transition-all"
            :class="{ 
              'opacity-50': draggedSubsectionIndex === subIndex && draggedSubsectionSectionIndex === sectionIndex,
              'border-brand-500 border-2': dragOverSubsectionIndex === subIndex && dragOverSubsectionSectionIndex === sectionIndex && (draggedSubsectionIndex !== subIndex || draggedSubsectionSectionIndex !== sectionIndex)
            }"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2 flex-1">
                <!-- Drag Handle -->
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-move flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                </svg>
                <input
                  v-model="subsection.name"
                  type="text"
                  placeholder="Subsection name"
                  class="font-medium text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 flex-1"
                />
              </div>
              <input
                v-model.number="subsection.weightage"
                type="number"
                min="0"
                max="100"
                placeholder="Weightage %"
                class="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <button
                @click="removeSubsection(sectionIndex, subIndex)"
                class="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded ml-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Questions -->
            <div class="ml-4 space-y-2 mt-3">
              <div
                v-for="(question, qIndex) in (subsection.questions || [])"
                :key="question.questionId || qIndex"
                :draggable="true"
                @dragstart="(e) => handleQuestionDragStart(e, sectionIndex, subIndex, qIndex)"
                @dragover.prevent="(e) => handleQuestionDragOver(e, sectionIndex, subIndex, qIndex)"
                @dragleave="handleQuestionDragLeave"
                @drop="(e) => handleQuestionDrop(e, sectionIndex, subIndex, qIndex)"
                @dragend="handleQuestionDragEnd"
                class="bg-gray-50 dark:bg-gray-700/30 rounded p-3 border border-gray-200 dark:border-gray-600 cursor-move transition-all"
                :class="{ 
                  'opacity-50': draggedQuestionIndex === qIndex && draggedQuestionSubsectionIndex === subIndex && draggedQuestionSectionIndex === sectionIndex,
                  'border-brand-500 border-2': dragOverQuestionIndex === qIndex && dragOverQuestionSubsectionIndex === subIndex && dragOverQuestionSectionIndex === sectionIndex && (draggedQuestionIndex !== qIndex || draggedQuestionSubsectionIndex !== subIndex || draggedQuestionSectionIndex !== sectionIndex)
                }"
              >
                <div class="space-y-3">
                  <!-- Question Header -->
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2 flex-1">
                      <!-- Drag Handle -->
                      <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-move flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                      </svg>
                      <div class="flex-1">
                        <input
                          v-model="question.questionText"
                          type="text"
                          placeholder="Enter question text"
                          class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                        <div class="flex items-center gap-2 mt-2">
                        <select
                          v-model="question.type"
                          class="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="Text">Text</option>
                          <option value="Textarea">Textarea</option>
                          <option value="Email">Email</option>
                          <option value="Number">Number</option>
                          <option value="Date">Date</option>
                          <option value="Dropdown">Dropdown</option>
                          <option value="Rating">Rating</option>
                          <option value="File">File</option>
                          <option value="Signature">Signature</option>
                          <option value="Yes-No">Yes-No</option>
                        </select>
                        <label class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <input
                            v-model="question.mandatory"
                            type="checkbox"
                            class="w-3 h-3"
                          />
                          Required
                        </label>
                        <button
                          @click="toggleQuestionSettings(sectionIndex, subIndex, qIndex)"
                          class="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 px-2 py-1"
                        >
                          {{ expandedQuestions[`${sectionIndex}-${subIndex}-${qIndex}`] ? 'Hide' : 'Settings' }}
                        </button>
                        </div>
                      </div>
                    </div>
                    <button
                      @click="removeQuestion(sectionIndex, subIndex, qIndex)"
                      class="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <!-- Dropdown Options Editor -->
                  <div v-if="question.type === 'Dropdown' && expandedQuestions[`${sectionIndex}-${subIndex}-${qIndex}`]" class="mt-2 pl-4 border-l-2 border-brand-500">
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Options</label>
                    <div class="space-y-1">
                      <div
                        v-for="(option, optIndex) in (question.options || [])"
                        :key="optIndex"
                        class="flex items-center gap-2"
                      >
                        <input
                          v-model="question.options[optIndex]"
                          type="text"
                          :placeholder="`Option ${optIndex + 1}`"
                          class="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <button
                          @click="removeOption(sectionIndex, subIndex, qIndex, optIndex)"
                          class="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <button
                        @click="addOption(sectionIndex, subIndex, qIndex)"
                        class="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Option
                      </button>
                    </div>
                  </div>

                  <!-- Advanced Settings (Expanded) -->
                  <div v-if="expandedQuestions[`${sectionIndex}-${subIndex}-${qIndex}`]" class="mt-3 pl-4 border-l-2 border-gray-300 dark:border-gray-600 space-y-3">
                    <!-- Scoring Logic -->
                    <div v-if="question.type === 'Yes-No' || question.type === 'Rating' || question.type === 'Dropdown'">
                      <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Scoring Logic</label>
                      <div class="space-y-2">
                        <div class="flex items-center gap-2">
                          <label class="text-xs text-gray-600 dark:text-gray-400 w-20">Pass Value:</label>
                          <input
                            v-model="question.scoringLogic.passValue"
                            type="text"
                            :placeholder="question.type === 'Yes-No' ? 'Yes' : question.type === 'Rating' ? '4' : 'Option'"
                            class="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div class="flex items-center gap-2">
                          <label class="text-xs text-gray-600 dark:text-gray-400 w-20">Weightage:</label>
                          <input
                            v-model.number="question.weightage"
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            class="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <!-- Conditional Logic -->
                    <div>
                      <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Show If (Conditional Logic)</label>
                      <div class="space-y-2">
                        <select
                          :value="question.conditionalLogic?.showIf?.questionId || ''"
                          @change="(e) => { ensureConditionalLogic(question); question.conditionalLogic.showIf.questionId = e.target.value; }"
                          class="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="">-- Select Question --</option>
                          <template v-for="(s, sIdx) in localForm.sections" :key="sIdx">
                            <template v-for="(sub, subIdx) in s.subsections" :key="subIdx">
                              <option
                                v-for="(q, qIdx) in (sub.questions || [])"
                                :key="qIdx"
                                :value="q.questionId"
                                :disabled="q.questionId === question.questionId"
                              >
                                {{ q.questionText || `Question ${qIdx + 1}` }}
                              </option>
                            </template>
                          </template>
                        </select>
                        <div v-if="question.conditionalLogic?.showIf?.questionId" class="flex items-center gap-2">
                          <select
                            v-model="question.conditionalLogic.showIf.operator"
                            class="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            <option value="equals">Equals</option>
                            <option value="not_equals">Not Equals</option>
                            <option value="contains">Contains</option>
                            <option value="greater_than">Greater Than</option>
                            <option value="less_than">Less Than</option>
                          </select>
                          <input
                            v-model="question.conditionalLogic.showIf.value"
                            type="text"
                            placeholder="Value"
                            class="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <!-- File Upload Settings -->
                    <div v-if="question.type === 'File'">
                      <label class="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <input
                          v-model="question.attachmentAllowance"
                          type="checkbox"
                          class="w-3 h-3"
                        />
                        Allow Multiple Files
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <button
                @click="addQuestion(sectionIndex, subIndex)"
                class="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 px-2 py-1 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Question
              </button>
            </div>
          </div>

          <button
            @click="addSubsection(sectionIndex)"
            class="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Subsection
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
      <svg class="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p class="text-gray-600 dark:text-gray-400 mb-4">No sections yet</p>
      <button
        @click="addSection"
        class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-all"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Your First Section
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update']);

// Ensure all questions have proper structure when form is loaded
const normalizeQuestions = (sections) => {
  if (!sections || !Array.isArray(sections)) return;
  
  sections.forEach(section => {
    if (section.subsections && Array.isArray(section.subsections)) {
      section.subsections.forEach(subsection => {
        if (subsection.questions && Array.isArray(subsection.questions)) {
          subsection.questions.forEach(question => {
            // Ensure conditionalLogic exists
            if (!question.conditionalLogic) {
              question.conditionalLogic = {
                showIf: {
                  questionId: '',
                  operator: 'equals',
                  value: null
                }
              };
            } else if (!question.conditionalLogic.showIf) {
              question.conditionalLogic.showIf = {
                questionId: '',
                operator: 'equals',
                value: null
              };
            }
            
            // Ensure scoringLogic exists
            if (!question.scoringLogic) {
              question.scoringLogic = {
                passValue: null,
                failValue: null,
                weightage: 0
              };
            }
            
            // Ensure options array exists for dropdowns
            if (question.type === 'Dropdown' && !Array.isArray(question.options)) {
              question.options = [];
            }
          });
        }
      });
    }
  });
};

// Initialize localForm with proper structure
const initializeLocalForm = () => {
  const formData = props.form || {};
  const initializedForm = {
    ...formData,
    sections: Array.isArray(formData.sections) ? formData.sections.map(section => ({
      ...section,
      subsections: Array.isArray(section.subsections) ? section.subsections : []
    })) : []
  };
  
  // Normalize questions to ensure proper structure
  normalizeQuestions(initializedForm.sections);
  
  return initializedForm;
};

const localForm = ref(initializeLocalForm());
let isSyncing = false;
let lastEmittedForm = null;
const expandedQuestions = ref({}); // Track which questions have settings expanded

// Drag-drop state for sections
const draggedSectionIndex = ref(null);
const dragOverSectionIndex = ref(null);

// Drag-drop state for subsections
const draggedSubsectionIndex = ref(null);
const draggedSubsectionSectionIndex = ref(null);
const dragOverSubsectionIndex = ref(null);
const dragOverSubsectionSectionIndex = ref(null);

// Drag-drop state for questions
const draggedQuestionIndex = ref(null);
const draggedQuestionSubsectionIndex = ref(null);
const draggedQuestionSectionIndex = ref(null);
const dragOverQuestionIndex = ref(null);
const dragOverQuestionSubsectionIndex = ref(null);
const dragOverQuestionSectionIndex = ref(null);

// Only sync when form ID changes (new form loaded)
watch(() => props.form?._id, (newId) => {
  if (newId && newId !== localForm.value._id) {
    isSyncing = true;
    localForm.value = initializeLocalForm();
    // Normalize questions to ensure proper structure
    normalizeQuestions(localForm.value.sections);
    lastEmittedForm = null;
    setTimeout(() => { isSyncing = false; }, 100);
  }
}, { immediate: true });

// Watch localForm and emit updates, but prevent circular updates
watch(() => localForm.value, (newForm) => {
  if (!isSyncing) {
    // Only emit if the form actually changed (compare serialized versions)
    const serialized = JSON.stringify(newForm);
    if (serialized !== lastEmittedForm) {
      lastEmittedForm = serialized;
      emit('update', JSON.parse(serialized));
    }
  }
}, { deep: true });

const generateId = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const addSection = () => {
  if (!localForm.value.sections) {
    localForm.value.sections = [];
  }
  localForm.value.sections.push({
    sectionId: generateId('SEC'),
    name: '',
    weightage: 0,
    subsections: [],
    questions: [],
    order: localForm.value.sections.length
  });
};

const removeSection = (index) => {
  localForm.value.sections.splice(index, 1);
};

const addSubsection = (sectionIndex) => {
  const section = localForm.value.sections[sectionIndex];
  if (!section.subsections) {
    section.subsections = [];
  }
  section.subsections.push({
    subsectionId: generateId('SUB'),
    name: '',
    weightage: 0,
    questions: [],
    order: section.subsections.length
  });
};

const removeSubsection = (sectionIndex, subsectionIndex) => {
  localForm.value.sections[sectionIndex].subsections.splice(subsectionIndex, 1);
};

const addQuestion = (sectionIndex, subsectionIndex) => {
  // Ensure sections array exists
  if (!localForm.value.sections) {
    localForm.value.sections = [];
  }
  
  // Ensure section exists
  if (!localForm.value.sections[sectionIndex]) {
    console.error('Section not found at index:', sectionIndex);
    return;
  }
  
  const section = localForm.value.sections[sectionIndex];
  
  // Ensure subsections array exists
  if (!section.subsections) {
    section.subsections = [];
  }
  
  // Ensure subsection exists
  if (!section.subsections[subsectionIndex]) {
    console.error('Subsection not found at index:', subsectionIndex);
    return;
  }
  
  const subsection = section.subsections[subsectionIndex];
  
  // Ensure questions array exists
  if (!subsection.questions) {
    subsection.questions = [];
  }
  
  // Add new question
  subsection.questions.push({
    questionId: generateId('Q'),
    questionText: 'New Question', // Set default text (required field)
    type: 'Text', // Backend expects: 'Text', 'Dropdown', 'Rating', 'File', 'Signature', 'Yes-No'
    options: [],
    mandatory: false,
    scoringLogic: {
      passValue: null,
      failValue: null,
      weightage: 0
    },
    conditionalLogic: {
      showIf: {
        questionId: '',
        operator: 'equals',
        value: null
      }
    },
    attachmentAllowance: false,
    passFailDefinition: '',
    order: subsection.questions.length
  });
};

const removeQuestion = (sectionIndex, subsectionIndex, questionIndex) => {
  const subsection = localForm.value.sections[sectionIndex].subsections[subsectionIndex];
  if (subsection.questions && subsection.questions[questionIndex]) {
    const questionId = subsection.questions[questionIndex].questionId;
    subsection.questions.splice(questionIndex, 1);
    // Clean up expanded state
    delete expandedQuestions.value[`${sectionIndex}-${subsectionIndex}-${questionIndex}`];
  }
};

const toggleQuestionSettings = (sectionIndex, subsectionIndex, questionIndex) => {
  const key = `${sectionIndex}-${subsectionIndex}-${questionIndex}`;
  expandedQuestions.value[key] = !expandedQuestions.value[key];
};

const addOption = (sectionIndex, subsectionIndex, questionIndex) => {
  const question = localForm.value.sections[sectionIndex].subsections[subsectionIndex].questions[questionIndex];
  if (!question.options) {
    question.options = [];
  }
  question.options.push('');
};

const removeOption = (sectionIndex, subsectionIndex, questionIndex, optionIndex) => {
  const question = localForm.value.sections[sectionIndex].subsections[subsectionIndex].questions[questionIndex];
  if (question.options && question.options[optionIndex]) {
    question.options.splice(optionIndex, 1);
  }
};

// Ensure conditionalLogic structure exists
const ensureConditionalLogic = (question) => {
  if (!question.conditionalLogic) {
    question.conditionalLogic = {
      showIf: {
        questionId: '',
        operator: 'equals',
        value: null
      }
    };
  } else if (!question.conditionalLogic.showIf) {
    question.conditionalLogic.showIf = {
      questionId: '',
      operator: 'equals',
      value: null
    };
  }
};

// Section drag-drop handlers
const handleSectionDragStart = (event, index) => {
  draggedSectionIndex.value = index;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', index.toString());
  event.currentTarget.classList.add('opacity-50');
};

const handleSectionDragOver = (event, index) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  if (draggedSectionIndex.value !== null && draggedSectionIndex.value !== index) {
    dragOverSectionIndex.value = index;
  }
};

const handleSectionDragLeave = () => {
  dragOverSectionIndex.value = null;
};

const handleSectionDrop = (event, targetIndex) => {
  event.preventDefault();
  if (draggedSectionIndex.value !== null && draggedSectionIndex.value !== targetIndex) {
    const fromIndex = draggedSectionIndex.value;
    const toIndex = targetIndex;
    
    // Reorder sections
    const sections = localForm.value.sections;
    const [movedSection] = sections.splice(fromIndex, 1);
    sections.splice(toIndex, 0, movedSection);
    
    // Update order property
    sections.forEach((section, idx) => {
      section.order = idx;
    });
  }
  dragOverSectionIndex.value = null;
};

const handleSectionDragEnd = (event) => {
  event.currentTarget.classList.remove('opacity-50');
  draggedSectionIndex.value = null;
  dragOverSectionIndex.value = null;
};

// Subsection drag-drop handlers
const handleSubsectionDragStart = (event, sectionIndex, subsectionIndex) => {
  draggedSubsectionIndex.value = subsectionIndex;
  draggedSubsectionSectionIndex.value = sectionIndex;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `${sectionIndex}-${subsectionIndex}`);
  event.currentTarget.classList.add('opacity-50');
};

const handleSubsectionDragOver = (event, sectionIndex, subsectionIndex) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  if (draggedSubsectionIndex.value !== null && 
      (draggedSubsectionIndex.value !== subsectionIndex || draggedSubsectionSectionIndex.value !== sectionIndex)) {
    dragOverSubsectionIndex.value = subsectionIndex;
    dragOverSubsectionSectionIndex.value = sectionIndex;
  }
};

const handleSubsectionDragLeave = () => {
  dragOverSubsectionIndex.value = null;
  dragOverSubsectionSectionIndex.value = null;
};

const handleSubsectionDrop = (event, targetSectionIndex, targetSubsectionIndex) => {
  event.preventDefault();
  if (draggedSubsectionIndex.value !== null && 
      (draggedSubsectionIndex.value !== targetSubsectionIndex || draggedSubsectionSectionIndex.value !== targetSectionIndex)) {
    const fromSectionIndex = draggedSubsectionSectionIndex.value;
    const fromSubsectionIndex = draggedSubsectionIndex.value;
    const toSectionIndex = targetSectionIndex;
    const toSubsectionIndex = targetSubsectionIndex;
    
    // Reorder subsections (only within the same section for now)
    if (fromSectionIndex === toSectionIndex) {
      const subsections = localForm.value.sections[fromSectionIndex].subsections;
      const [movedSubsection] = subsections.splice(fromSubsectionIndex, 1);
      subsections.splice(toSubsectionIndex, 0, movedSubsection);
      
      // Update order property
      subsections.forEach((subsection, idx) => {
        subsection.order = idx;
      });
    }
  }
  dragOverSubsectionIndex.value = null;
  dragOverSubsectionSectionIndex.value = null;
};

const handleSubsectionDragEnd = (event) => {
  event.currentTarget.classList.remove('opacity-50');
  draggedSubsectionIndex.value = null;
  draggedSubsectionSectionIndex.value = null;
  dragOverSubsectionIndex.value = null;
  dragOverSubsectionSectionIndex.value = null;
};

// Question drag-drop handlers
const handleQuestionDragStart = (event, sectionIndex, subsectionIndex, questionIndex) => {
  draggedQuestionIndex.value = questionIndex;
  draggedQuestionSubsectionIndex.value = subsectionIndex;
  draggedQuestionSectionIndex.value = sectionIndex;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `${sectionIndex}-${subsectionIndex}-${questionIndex}`);
  event.currentTarget.classList.add('opacity-50');
};

const handleQuestionDragOver = (event, sectionIndex, subsectionIndex, questionIndex) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  if (draggedQuestionIndex.value !== null && 
      (draggedQuestionIndex.value !== questionIndex || 
       draggedQuestionSubsectionIndex.value !== subsectionIndex || 
       draggedQuestionSectionIndex.value !== sectionIndex)) {
    dragOverQuestionIndex.value = questionIndex;
    dragOverQuestionSubsectionIndex.value = subsectionIndex;
    dragOverQuestionSectionIndex.value = sectionIndex;
  }
};

const handleQuestionDragLeave = () => {
  dragOverQuestionIndex.value = null;
  dragOverQuestionSubsectionIndex.value = null;
  dragOverQuestionSectionIndex.value = null;
};

const handleQuestionDrop = (event, targetSectionIndex, targetSubsectionIndex, targetQuestionIndex) => {
  event.preventDefault();
  if (draggedQuestionIndex.value !== null && 
      (draggedQuestionIndex.value !== targetQuestionIndex || 
       draggedQuestionSubsectionIndex.value !== targetSubsectionIndex || 
       draggedQuestionSectionIndex.value !== targetSectionIndex)) {
    const fromSectionIndex = draggedQuestionSectionIndex.value;
    const fromSubsectionIndex = draggedQuestionSubsectionIndex.value;
    const fromQuestionIndex = draggedQuestionIndex.value;
    const toSectionIndex = targetSectionIndex;
    const toSubsectionIndex = targetSubsectionIndex;
    const toQuestionIndex = targetQuestionIndex;
    
    // Reorder questions (only within the same subsection for now)
    if (fromSectionIndex === toSectionIndex && fromSubsectionIndex === toSubsectionIndex) {
      const questions = localForm.value.sections[fromSectionIndex].subsections[fromSubsectionIndex].questions;
      const [movedQuestion] = questions.splice(fromQuestionIndex, 1);
      questions.splice(toQuestionIndex, 0, movedQuestion);
      
      // Update order property
      questions.forEach((question, idx) => {
        question.order = idx;
      });
    }
  }
  dragOverQuestionIndex.value = null;
  dragOverQuestionSubsectionIndex.value = null;
  dragOverQuestionSectionIndex.value = null;
};

const handleQuestionDragEnd = (event) => {
  event.currentTarget.classList.remove('opacity-50');
  draggedQuestionIndex.value = null;
  draggedQuestionSubsectionIndex.value = null;
  draggedQuestionSectionIndex.value = null;
  dragOverQuestionIndex.value = null;
  dragOverQuestionSubsectionIndex.value = null;
  dragOverQuestionSectionIndex.value = null;
};
</script>

