/**
 * useZoomPan composable
 *
 * Manages zoom level and drag-to-pan state for the EPD preview container.
 * Provides reactive zoom level, CSS transform scale, and mouse event handlers.
 */

import { ref, computed, type Ref } from 'vue'

export type ZoomLevel = 'fit' | '50' | '75' | '100'

const ZOOM_LEVELS: readonly ZoomLevel[] = ['fit', '50', '75', '100']

/**
 * Map zoom level to CSS transform scale factor.
 * 'fit' is special — handled by the container via object-fit.
 * For numeric levels, we compute scale relative to the container size at runtime.
 */
const ZOOM_SCALE: Record<Exclude<ZoomLevel, 'fit'>, number> = {
  '50': 0.5,
  '75': 0.75,
  '100': 1.0,
}

export interface UseZoomPanReturn {
  /** Current zoom level */
  zoomLevel: Ref<ZoomLevel>

  /** Whether the image should use 'fit' mode (object-contain in container) */
  isFitMode: Ref<boolean>

  /** CSS transform scale value for non-fit modes */
  scaleValue: Ref<number>

  /** Set zoom level directly */
  setZoom: (level: ZoomLevel) => void

  /** Cycle to next zoom level (for Ctrl+wheel up) */
  zoomIn: () => void

  /** Cycle to previous zoom level (for Ctrl+wheel down) */
  zoomOut: () => void

  /** Handle Ctrl+wheel event on the preview container */
  handleWheel: (e: WheelEvent) => void

  /** Mouse handlers for drag-to-pan */
  handleMouseDown: (e: MouseEvent) => void
  handleMouseMove: (e: MouseEvent) => void
  handleMouseUp: () => void

  /** Whether drag is in progress (for cursor style) */
  isDragging: Ref<boolean>
}

export function useZoomPan(): UseZoomPanReturn {
  const zoomLevel = ref<ZoomLevel>('fit')
  const isDragging = ref(false)

  // Drag state
  let dragStartX = 0
  let dragStartY = 0
  let scrollStartX = 0
  let scrollStartY = 0
  let dragTarget: HTMLElement | null = null

  const isFitMode = computed(() => zoomLevel.value === 'fit')

  const scaleValue = computed(() => {
    if (zoomLevel.value === 'fit') return 1
    return ZOOM_SCALE[zoomLevel.value as Exclude<ZoomLevel, 'fit'>] ?? 1
  })

  function setZoom(level: ZoomLevel): void {
    zoomLevel.value = level
  }

  function zoomIn(): void {
    const currentIdx = ZOOM_LEVELS.indexOf(zoomLevel.value)
    if (currentIdx < ZOOM_LEVELS.length - 1) {
      zoomLevel.value = ZOOM_LEVELS[currentIdx + 1]
    }
  }

  function zoomOut(): void {
    const currentIdx = ZOOM_LEVELS.indexOf(zoomLevel.value)
    if (currentIdx > 0) {
      zoomLevel.value = ZOOM_LEVELS[currentIdx - 1]
    }
  }

  function handleWheel(e: WheelEvent): void {
    if (!e.ctrlKey) return
    e.preventDefault()
    if (e.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
  }

  function handleMouseDown(e: MouseEvent): void {
    // Only enable drag in non-fit modes
    if (isFitMode.value) return

    const container = (e.currentTarget as HTMLElement)
    if (!container) return

    isDragging.value = true
    dragTarget = container
    dragStartX = e.clientX
    dragStartY = e.clientY
    scrollStartX = container.scrollLeft
    scrollStartY = container.scrollTop

    // Prevent text selection during drag
    e.preventDefault()
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!isDragging.value || !dragTarget) return

    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY
    dragTarget.scrollLeft = scrollStartX - dx
    dragTarget.scrollTop = scrollStartY - dy
  }

  function handleMouseUp(): void {
    isDragging.value = false
    dragTarget = null
  }

  return {
    zoomLevel,
    isFitMode,
    scaleValue,
    setZoom,
    zoomIn,
    zoomOut,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isDragging,
  }
}
