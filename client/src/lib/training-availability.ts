import { trainingEnabled } from '@shared/training-availability';

// Build-time visibility only. Server authentication and activation remain authoritative.
export const TRAINING_VISIBLE = trainingEnabled(import.meta.env.MODE, import.meta.env.VITE_TRAINING_ENABLED);
