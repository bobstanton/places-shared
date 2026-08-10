import { type Feet, feet } from '../Units';

// Pure map defaults. This module must remain safe to bundle into web workers.
// Retained because `gradeDistance:` is still accepted as an alias for
// `gradeWindow:`, and its unlabelled number means feet.
export const DEFAULT_GRADE_DISTANCE_FEET: Feet = feet(100);
export const DEFAULT_MAP_HEIGHT = 'calc(100vh - 200px)';
export const DEFAULT_MAP_WIDTH = '100%';
