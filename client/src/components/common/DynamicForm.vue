<template>
  <div class="space-y-6">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
    </div>
    
    <!-- Error state -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>
    
    <!-- Form content -->
    <template v-else-if="moduleDefinition">
    <!-- Advanced Layout Mode (Grid-based) -->
    <template v-if="useAdvancedLayout && layout && layout.rows && layout.rows.length > 0">
      <div v-for="(row, ri) in layout.rows" :key="ri" class="grid grid-cols-12 gap-4">
        <div 
          v-for="(col, ci) in row.cols" 
          :key="ci"
          :class="getSpanClass(col.span)"
          v-if="col.fieldKey && getFieldByKey(col.fieldKey) && shouldShowField(getFieldByKey(col.fieldKey))"
        >
          <DynamicFormField 
            :field="getFieldByKey(col.fieldKey)"
            :value="localFormData[col.fieldKey]"
            @update:value="updateField(col.fieldKey, $event)"
            :errors="errors"
            :dependency-state="getFieldState(getFieldByKey(col.fieldKey))"
          />
        </div>
      </div>
    </template>
    
    <!-- Simple Mode (List-based) -->
    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          v-for="field in orderedFields" 
          :key="field.key"
          :class="field.dataType === 'Text-Area' || field.dataType === 'Rich Text' ? 'md:col-span-2' : ''"
        >
          <DynamicFormField 
            :field="field"
            :value="localFormData[field.key]"
            @update:value="updateField(field.key, $event)"
            :errors="errors"
            :dependency-state="getFieldState(field)"
          />
        </div>
      </div>
    </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import DynamicFormField from './DynamicFormField.vue';
import apiClient from '@/utils/apiClient';
import { getFieldDependencyState } from '@/utils/dependencyEvaluation';

const props = defineProps({
  moduleKey: {
    type: String,
    required: true
  },
  formData: {
    type: Object,
    required: true,
    default: () => ({})
  },
  errors: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:formData', 'submit', 'ready']);

const moduleDefinition = ref(null);
const loading = ref(true);
const localFormData = ref({ ...props.formData });
const error = ref(null);

// Field rendering helpers - case-insensitive lookup
const fieldMap = computed(() => {
  if (!moduleDefinition.value?.fields) return {};
  const map = {};
  for (const field of moduleDefinition.value.fields) {
    if (field.key) {
      // Store with lowercase key for case-insensitive lookup
      map[field.key.toLowerCase()] = field;
      // Also store with original key for backward compatibility
      map[field.key] = field;
    }
  }
  return map;
});

// Helper function to get field by key (case-insensitive)
const getFieldByKey = (key) => {
  if (!key || !moduleDefinition.value?.fields) return null;
  const keyLower = key.toLowerCase();
  // Try exact match first
  let field = moduleDefinition.value.fields.find(f => f.key === key);
  if (!field) {
    // Try case-insensitive match
    field = moduleDefinition.value.fields.find(f => f.key?.toLowerCase() === keyLower);
  }
  return field || null;
};

const layout = computed(() => moduleDefinition.value?.quickCreateLayout);
const useAdvancedLayout = computed(() => {
  return layout.value && layout.value.rows && layout.value.rows.length > 0;
});

const orderedFields = computed(() => {
  if (!moduleDefinition.value) return [];
  const quickCreate = moduleDefinition.value.quickCreate || [];
  const allFields = moduleDefinition.value.fields || [];
  
  // Exclude system fields and hidden fields
  // assignedTo should be visible in Quick Create forms (admin can assign)
  // Note: activitylogs is NOT in this list so it's available in edit forms
  // Note: createdby is excluded from Quick Create (set by backend automatically)
  const systemFieldKeys = ['organizationid', 'createdat', 'updatedat', '_id', '__v', 'createdby'];
  
  // Access localFormData.value to ensure Vue tracks this dependency for reactivity
  const currentFormData = localFormData.value || {};
  
  // Create a case-insensitive field map for lookup
  const fieldMapByKey = new Map();
  for (const field of allFields) {
    if (field.key) {
      const keyLower = field.key.toLowerCase();
      if (!fieldMapByKey.has(keyLower)) {
        fieldMapByKey.set(keyLower, field);
      }
    }
  }
  
  // Get fields in quickCreate order, respecting main field order
  const ordered = [];
  const seen = new Set(); // Use Set with lowercase keys for case-insensitive deduplication
  
  console.log('🔍 Processing quickCreate fields:', {
    quickCreateArray: quickCreate,
    quickCreateLength: quickCreate.length,
    fieldMapByKeySize: fieldMapByKey.size,
    systemFieldKeys: systemFieldKeys,
    currentFormData: currentFormData
  });
  
  // First, add fields from quickCreate array in the exact order they appear
  // Check dependency visibility based on current form data
  for (const key of quickCreate) {
    if (!key) continue;
    const keyLower = key.toLowerCase().trim();
    if (seen.has(keyLower)) {
      console.log(`⏭️  Skipping duplicate: "${key}"`);
      continue; // Skip duplicates
    }
    
    const field = fieldMapByKey.get(keyLower);
    if (!field) {
      console.warn(`⚠️  Field "${key}" (${keyLower}) from quickCreate not found in module fields`, {
        availableKeys: Array.from(fieldMapByKey.keys()).slice(0, 10),
        keyLower: keyLower
      });
      continue;
    }
    
    const fieldKeyLower = field.key?.toLowerCase();
    // Exclude system fields
    const isSystem = systemFieldKeys.includes(fieldKeyLower);
    
    // Check dependency-based visibility using current form data
    let isVisible = true;
    if (field.dependencies && Array.isArray(field.dependencies) && field.dependencies.length > 0) {
      const depState = getFieldDependencyState(field, currentFormData, allFields);
      isVisible = depState.visible !== false; // Default to visible if undefined
    }
    
    console.log(`✅ Processing field "${key}":`, {
      found: !!field,
      fieldKey: field.key,
      fieldLabel: field.label,
      isSystem: isSystem,
      isVisible: isVisible,
      hasDependencies: !!(field.dependencies && field.dependencies.length > 0),
      willInclude: !isSystem && isVisible
    });
    
    if (!isSystem && isVisible) {
      ordered.push(field);
      seen.add(keyLower);
      console.log(`✅ Added field "${key}" to ordered list`);
    } else {
      if (isSystem) {
        console.log(`⏭️  Excluding system field "${key}"`);
      } else {
        console.log(`⏭️  Excluding hidden field "${key}" (dependency not met)`);
      }
    }
  }
  
  console.log('📋 Ordered fields after quickCreate processing:', {
    count: ordered.length,
    fields: ordered.map(f => ({ key: f.key, label: f.label }))
  });
  
  // Also include required fields that might not be in quickCreate (but not system fields)
  // Only if quickCreate array is empty - otherwise trust the admin's configuration
  if (quickCreate.length === 0) {
    for (const field of allFields) {
      const fieldKeyLower = field.key?.toLowerCase();
      const isSystem = systemFieldKeys.includes(fieldKeyLower);
      
      // Check dependency visibility for required fields too
      let isVisible = true;
      if (field.dependencies && Array.isArray(field.dependencies) && field.dependencies.length > 0) {
        const depState = getFieldDependencyState(field, currentFormData, allFields);
        isVisible = depState.visible !== false;
      }
      
      if (field.required && 
          !seen.has(fieldKeyLower) && 
          !isSystem &&
          isVisible) {
        ordered.push(field);
        seen.add(fieldKeyLower);
      }
    }
  }
  
  // Sort by order property while maintaining quickCreate order for fields with same order
  ordered.sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    // If order is same, maintain quickCreate order
    const idxA = quickCreate.findIndex(k => k?.toLowerCase() === a.key?.toLowerCase());
    const idxB = quickCreate.findIndex(k => k?.toLowerCase() === b.key?.toLowerCase());
    if (idxA >= 0 && idxB >= 0) return idxA - idxB;
    if (idxA >= 0) return -1;
    if (idxB >= 0) return 1;
    return 0;
  });
  
  console.log('Ordered fields result:', ordered.map(f => ({ key: f.key, label: f.label })));
  
  return ordered;
});

const getSpanClass = (span) => {
  const spanMap = {
    1: 'col-span-1',
    2: 'col-span-2',
    3: 'col-span-3',
    4: 'col-span-4',
    5: 'col-span-5',
    6: 'col-span-6',
    7: 'col-span-7',
    8: 'col-span-8',
    9: 'col-span-9',
    10: 'col-span-10',
    11: 'col-span-11',
    12: 'col-span-12'
  };
  return spanMap[span] || 'col-span-12';
};

const getFieldComponent = (field) => {
  return DynamicFormField;
};

const shouldShowField = (field) => {
  if (!field || !field.key) return false;
  // Exclude system fields - assignedTo should be visible in Quick Create, createdby should not
  // Note: createdby is excluded from Quick Create (set by backend automatically)
  const systemFieldKeys = ['organizationid', 'createdat', 'updatedat', '_id', '__v', 'createdby'];
  if (systemFieldKeys.includes(field.key.toLowerCase())) return false;
  
  // Evaluate dependency-based visibility using getFieldState for consistency
  // Access localFormData.value to ensure Vue tracks this dependency
  const currentFormData = localFormData.value || {};
  if (field.dependencies && Array.isArray(field.dependencies) && field.dependencies.length > 0) {
    const depState = getFieldDependencyState(field, currentFormData, moduleDefinition.value?.fields || []);
    // Only hide if explicitly set to false, default to visible if undefined
    if (depState.visible === false) return false;
  }
  
  // For Quick Create fields, ignore visibility - if admin added it to Quick Create, show it
  // Visibility settings apply to detail/list views, not Quick Create forms
  return true;
};

// Get field dependency state for a field (reactive)
const getFieldState = (field) => {
  if (!field || !field.dependencies || !Array.isArray(field.dependencies) || field.dependencies.length === 0) {
    return {
      readonly: false,
      required: field.required || false,
      allowedOptions: null
    };
  }
  // Access localFormData.value to ensure reactivity - Vue tracks this dependency
  const currentFormData = localFormData.value;
  return getFieldDependencyState(field, currentFormData, moduleDefinition.value?.fields || []);
};

const updateField = (key, value) => {
  localFormData.value[key] = value;
  emit('update:formData', { ...localFormData.value });
};

// Watch for external formData changes
watch(() => props.formData, (newData) => {
  localFormData.value = { ...newData };
}, { deep: true });


// Fetch module definition
const fetchModule = async () => {
  loading.value = true;
  error.value = null;
  try {
    const data = await apiClient.get('/modules');
    if (data.success) {
      const targetModule = data.data.find(m => m.key === props.moduleKey);
      if (targetModule) {
        // Ensure quickCreate and quickCreateLayout are always present
        if (!targetModule.quickCreate) targetModule.quickCreate = [];
        if (!targetModule.quickCreateLayout) targetModule.quickCreateLayout = { version: 1, rows: [] };
        
        console.log('Module loaded:', {
          key: targetModule.key,
          quickCreate: targetModule.quickCreate,
          quickCreateLayout: targetModule.quickCreateLayout,
          quickCreateLength: targetModule.quickCreate?.length || 0,
          quickCreateLayoutRows: targetModule.quickCreateLayout?.rows?.length || 0,
          fieldsCount: targetModule.fields?.length || 0,
          fields: targetModule.fields?.map(f => ({ key: f.key, label: f.label })) || []
        });
        
        // Debug: Log fields in Quick Create config
        if (targetModule.quickCreate && targetModule.quickCreate.length > 0) {
          console.log('Fields in quickCreate config:', targetModule.quickCreate);
          console.log('Matching fields:', targetModule.quickCreate.map(key => {
            const field = targetModule.fields?.find(f => f.key === key);
            return field ? { key: field.key, label: field.label, found: true } : { key, found: false };
          }));
        }
        
        moduleDefinition.value = targetModule;
        emit('ready', targetModule);
      } else {
        error.value = `Module "${props.moduleKey}" not found`;
        console.error('Module not found:', props.moduleKey, 'Available modules:', data.data.map(m => m.key));
      }
    } else {
      error.value = data.message || 'Failed to fetch modules';
    }
  } catch (err) {
    console.error('Error fetching module definition:', err);
    error.value = err.message || 'Failed to fetch module definition';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchModule();
  localFormData.value = { ...props.formData };
});
</script>

