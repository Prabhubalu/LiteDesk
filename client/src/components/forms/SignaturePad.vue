<template>
  <div class="signature-pad-container">
    <div class="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 p-4">
      <div class="flex items-center justify-between mb-2">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ label || 'Signature' }}
          <span v-if="required" class="text-red-500">*</span>
        </label>
        <button
          v-if="signatureData"
          @click="clearSignature"
          type="button"
          class="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
        >
          Clear
        </button>
      </div>
      
      <div
        ref="canvasContainer"
        class="signature-canvas-container border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 relative"
        :class="{ 'border-brand-500': isDrawing }"
      >
        <canvas
          ref="canvas"
          :width="width"
          :height="height"
          class="cursor-crosshair"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
          @touchstart="startDrawingTouch"
          @touchmove="drawTouch"
          @touchend="stopDrawing"
        ></canvas>
        <div
          v-if="!signatureData"
          class="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm"
        >
          Sign here
        </div>
      </div>
      
      <p v-if="error" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
  modelValue: String,
  label: String,
  required: Boolean,
  width: { type: Number, default: 400 },
  height: { type: Number, default: 200 }
});

const emit = defineEmits(['update:modelValue']);

const canvas = ref(null);
const canvasContainer = ref(null);
const isDrawing = ref(false);
const signatureData = ref(props.modelValue || '');
const error = ref('');

let ctx = null;
let lastX = 0;
let lastY = 0;

onMounted(() => {
  if (canvas.value) {
    ctx = canvas.value.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Load existing signature if provided
    if (props.modelValue) {
      loadSignature(props.modelValue);
    }
  }
});

watch(() => props.modelValue, (newValue) => {
  if (newValue !== signatureData.value) {
    signatureData.value = newValue || '';
    if (newValue && canvas.value) {
      loadSignature(newValue);
    } else if (!newValue && canvas.value) {
      clearCanvas();
    }
  }
});

const getCoordinates = (event) => {
  const rect = canvas.value.getBoundingClientRect();
  const scaleX = canvas.value.width / rect.width;
  const scaleY = canvas.value.height / rect.height;
  
  if (event.touches) {
    return {
      x: (event.touches[0].clientX - rect.left) * scaleX,
      y: (event.touches[0].clientY - rect.top) * scaleY
    };
  } else {
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }
};

const startDrawing = (event) => {
  if (!ctx) return;
  isDrawing.value = true;
  const coords = getCoordinates(event);
  lastX = coords.x;
  lastY = coords.y;
};

const startDrawingTouch = (event) => {
  event.preventDefault();
  startDrawing(event);
};

const draw = (event) => {
  if (!isDrawing.value || !ctx) return;
  const coords = getCoordinates(event);
  
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(coords.x, coords.y);
  ctx.stroke();
  
  lastX = coords.x;
  lastY = coords.y;
  
  // Update signature data
  updateSignature();
};

const drawTouch = (event) => {
  event.preventDefault();
  draw(event);
};

const stopDrawing = () => {
  if (isDrawing.value) {
    isDrawing.value = false;
    updateSignature();
  }
};

const updateSignature = () => {
  if (!canvas.value) return;
  try {
    const dataURL = canvas.value.toDataURL('image/png');
    signatureData.value = dataURL;
    emit('update:modelValue', dataURL);
    error.value = '';
  } catch (err) {
    console.error('Error updating signature:', err);
    error.value = 'Failed to save signature';
  }
};

const loadSignature = (dataURL) => {
  if (!canvas.value || !ctx || !dataURL) return;
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
    ctx.drawImage(img, 0, 0);
  };
  img.src = dataURL;
};

const clearCanvas = () => {
  if (!canvas.value || !ctx) return;
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
};

const clearSignature = () => {
  clearCanvas();
  signatureData.value = '';
  emit('update:modelValue', '');
};

// Expose method for parent component
defineExpose({
  clear: clearSignature,
  getSignature: () => signatureData.value
});
</script>

<style scoped>
.signature-canvas-container {
  min-height: 200px;
  touch-action: none;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>

