import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  InspectionSession,
  InspectionStep,
  InspectionStatus,
  Detection,
  FrameQuality,
  StateUpdate,
  InspectionResult,
} from '@/types';

interface InspectionStore {
  // Session identity
  inspectionId: string | null;
  sessionId: string | null;

  // Live state
  session: InspectionSession | null;
  isConnected: boolean;
  isCameraActive: boolean;
  isStreaming: boolean;
  error: string | null;

  // History of steps completed (for timeline)
  completedSteps: InspectionStep[];

  // Actions
  setIds: (inspectionId: string, sessionId: string) => void;
  setConnected: (v: boolean) => void;
  setCameraActive: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  applyStateUpdate: (update: StateUpdate) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const INITIAL_SESSION: InspectionSession = {
  inspectionId: '',
  sessionId: '',
  step: 'wait_for_machine',
  progress: 0,
  instruction: 'Point camera at the AED and click Start Inspection.',
  status: 'waiting',
  detections: [],
};

export const useInspectionStore = create<InspectionStore>()(
  devtools(
    (set, get) => ({
      inspectionId: null,
      sessionId: null,
      session: null,
      isConnected: false,
      isCameraActive: false,
      isStreaming: false,
      error: null,
      completedSteps: [],

      setIds: (inspectionId, sessionId) =>
        set({
          inspectionId,
          sessionId,
          session: { ...INITIAL_SESSION, inspectionId, sessionId },
        }),

      setConnected: (v) => set({ isConnected: v }),
      setCameraActive: (v) => set({ isCameraActive: v }),
      setStreaming: (v) => set({ isStreaming: v }),
      setError: (msg) => set({ error: msg }),

      applyStateUpdate: (update: StateUpdate) => {
        const current = get().session;
        if (!current) return;

        const prevStep = current.step;
        const newStep = (update.step as InspectionStep) ?? current.step;
        const data = update.data ?? {};

        // Track completed steps
        const completedSteps = [...get().completedSteps];
        if (update.completed && prevStep !== newStep && !completedSteps.includes(prevStep)) {
          completedSteps.push(prevStep);
        }

        set({
          completedSteps,
          session: {
            ...current,
            step: newStep,
            progress: update.progress ?? current.progress,
            instruction: update.instruction ?? current.instruction,
            status: (update.status as InspectionStatus) ?? current.status,
            detections: update.detections ?? current.detections,
            frameQuality: update.frame_quality ?? current.frameQuality,
            guidance: update.guidance ?? current.guidance,
            // Extract known fields from data
            manufacturer: (data.manufacturer as string) ?? current.manufacturer,
            model: (data.model as string) ?? current.model,
            serialNumber: (data.serial_number as string) ?? current.serialNumber,
            padsExpiry: (data.pads_expiry as string) ?? current.padsExpiry,
            batteryExpiry: (data.battery_expiry as string) ?? current.batteryExpiry,
            statusIndicator: (data.aed_status as string) ?? current.statusIndicator,
            inspectionResult: (data.inspection_result as InspectionResult) ?? current.inspectionResult,
            completedData:
              update.type === 'inspection_complete' ? (data as Record<string, unknown>) : current.completedData,
            error: update.error ?? undefined,
          },
        });
      },

      reset: () =>
        set({
          inspectionId: null,
          sessionId: null,
          session: null,
          isConnected: false,
          isCameraActive: false,
          isStreaming: false,
          error: null,
          completedSteps: [],
        }),
    }),
    { name: 'inspection-store' },
  ),
);
