/**
 * Proposed Indian locales for civic grievance voice input.
 * Hindi is the system-wide default per CivicSarthi requirements.
 */
export const VOICE_LANGUAGES = [
  { code: 'hi-IN', label: 'Hindi (हिन्दी)', nativeName: 'हिन्दी' },
  { code: 'en-IN', label: 'English (India)', nativeName: 'English (India)' },
  { code: 'bn-IN', label: 'Bengali (বাংলা)', nativeName: 'বাংলা' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)', nativeName: 'தமிழ்' },
  { code: 'mr-IN', label: 'Marathi (मराठी)', nativeName: 'मराठी' },
  { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)', nativeName: 'ગુજરાતી' },
  { code: 'te-IN', label: 'Telugu (తెలుగు)', nativeName: 'తెలుగు' },
  { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'Malayalam (മലയാളം)', nativeName: 'മലയാളം' },
  { code: 'pa-IN', label: 'Punjabi (ਪੰਜਾਬੀ)', nativeName: 'ਪੰਜਾਬੀ' }
];

/**
 * Safely retrieves the browser SpeechRecognition constructor across browsers.
 */
export function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Maps browser Web Speech API error codes to citizen-friendly explanatory guidance.
 */
export function mapRecognitionError(errorCode) {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. Please allow microphone access in your browser settings to use voice input, or type manually.';
    case 'no-speech':
      return 'No speech was detected. Please check your microphone and try again.';
    case 'audio-capture':
      return 'No microphone device was detected or audio capture failed. Please check your audio hardware.';
    case 'network':
      return 'Voice recognition network error. Please check your internet connectivity.';
    case 'aborted':
      return null; // Intentional stop
    default:
      return `Speech recognition failed (${errorCode}). You can retry or type your grievance narrative directly.`;
  }
}

/**
 * Pure helper to insert or append recognized speech into narrative with proper spacing.
 */
export function mergeTranscript(existingText, incomingTranscript, mode = 'append') {
  if (!incomingTranscript || !incomingTranscript.trim()) {
    return existingText || '';
  }
  const cleanIncoming = incomingTranscript.trim();
  if (mode === 'replace' || !existingText || !existingText.trim()) {
    return cleanIncoming;
  }
  return `${existingText.trim()} ${cleanIncoming}`;
}

