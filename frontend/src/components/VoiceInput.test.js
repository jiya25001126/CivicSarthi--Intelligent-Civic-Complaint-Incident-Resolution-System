import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  VOICE_LANGUAGES,
  getSpeechRecognitionConstructor,
  mapRecognitionError,
  mergeTranscript
} from './voiceInput.constants.js';

describe('VoiceInput Component - Multilingual Voice Architecture', () => {
  test('defaults to Hindi (hi-IN) as first language option', () => {
    assert.equal(VOICE_LANGUAGES[0].code, 'hi-IN');
    assert.equal(VOICE_LANGUAGES[0].label, 'Hindi (हिन्दी)');
  });

  test('includes required Indian regional locales', () => {
    const codes = VOICE_LANGUAGES.map((l) => l.code);
    assert.ok(codes.includes('hi-IN'), 'Hindi must be present');
    assert.ok(codes.includes('en-IN'), 'Indian English must be present');
    assert.ok(codes.includes('bn-IN'), 'Bengali must be present');
    assert.ok(codes.includes('ta-IN'), 'Tamil must be present');
    assert.ok(codes.includes('mr-IN'), 'Marathi must be present');
    assert.ok(codes.includes('gu-IN'), 'Gujarati must be present');
    assert.ok(codes.includes('te-IN'), 'Telugu must be present');
    assert.ok(codes.includes('kn-IN'), 'Kannada must be present');
    assert.ok(codes.includes('ml-IN'), 'Malayalam must be present');
    assert.ok(codes.includes('pa-IN'), 'Punjabi must be present');
  });

  test('safe detection of Web Speech API when window is undefined or API is absent', () => {
    const constructor = getSpeechRecognitionConstructor();
    assert.equal(constructor, null);
  });

  test('safe detection returns constructor when available in browser global', () => {
    class MockSpeechRecognition {
      constructor() {
        this.lang = 'hi-IN';
      }
    }

    global.window = { SpeechRecognition: MockSpeechRecognition };
    const detected = getSpeechRecognitionConstructor();
    assert.equal(detected, MockSpeechRecognition);

    delete global.window;
  });

  test('fallback to webkitSpeechRecognition when standard SpeechRecognition is absent', () => {
    class MockWebkitSpeechRecognition {
      constructor() {
        this.lang = 'hi-IN';
      }
    }

    global.window = { webkitSpeechRecognition: MockWebkitSpeechRecognition };
    const detected = getSpeechRecognitionConstructor();
    assert.equal(detected, MockWebkitSpeechRecognition);

    delete global.window;
  });

  test('maps recognition error codes to accessible, citizen-friendly explanations', () => {
    assert.match(mapRecognitionError('not-allowed'), /Microphone permission was denied/i);
    assert.match(mapRecognitionError('service-not-allowed'), /Microphone permission was denied/i);
    assert.match(mapRecognitionError('no-speech'), /No speech was detected/i);
    assert.match(mapRecognitionError('audio-capture'), /No microphone device was detected/i);
    assert.match(mapRecognitionError('network'), /network error/i);
    assert.equal(mapRecognitionError('aborted'), null, 'aborted is intentional stop, not an error banner');
    assert.match(mapRecognitionError('unknown-err'), /Speech recognition failed/i);
  });
});

describe('Web Speech Lifecycle & Deduplication Logic', () => {
  test('session results aggregation distinguishes final from interim without duplication', () => {
    // Simulate events structure passed by Web Speech API
    const mockResults = [
      [{ transcript: 'मुख्य सड़क पर' }],
      [{ transcript: 'गड्ढे हो गए हैं' }],
      [{ transcript: 'और पानी भर गया है' }]
    ];
    mockResults[0].isFinal = true;
    mockResults[1].isFinal = true;
    mockResults[2].isFinal = false; // current interim utterance

    let finalAcc = '';
    let interimAcc = '';

    for (let i = 0; i < mockResults.length; i++) {
      const piece = mockResults[i][0].transcript;
      if (mockResults[i].isFinal) {
        finalAcc += piece + ' ';
      } else {
        interimAcc += piece;
      }
    }

    const sessionFinal = finalAcc.trim();
    const sessionInterim = interimAcc.trim();

    assert.equal(sessionFinal, 'मुख्य सड़क पर गड्ढे हो गए हैं');
    assert.equal(sessionInterim, 'और पानी भर गया है');

    // On session end, combine finalized with any trailing interim
    let fullTranscript = sessionFinal;
    if (sessionInterim) {
      fullTranscript = fullTranscript ? `${fullTranscript} ${sessionInterim}` : sessionInterim;
    }
    fullTranscript = fullTranscript.trim();

    assert.equal(fullTranscript, 'मुख्य सड़क पर गड्ढे हो गए हैं और पानी भर गया है');
    // Verify no words are repeated
    assert.equal(fullTranscript.indexOf('मुख्य सड़क पर'), 0);
    assert.equal(fullTranscript.indexOf('मुख्य सड़क पर', 5), -1);
  });
});

describe('Voice Transcript Narrative Integration Logic', () => {
  test('appends transcript to existing user-typed grievance text with proper single-space delimiter', () => {
    const initialText = 'Pothole on 5th main street near sector 4 market.';
    const spokenText = 'यह समस्या पिछले तीन सप्ताह से है और जलभराव हो रहा है।';
    const result = mergeTranscript(initialText, spokenText, 'append');

    assert.equal(
      result,
      'Pothole on 5th main street near sector 4 market. यह समस्या पिछले तीन सप्ताह से है और जलभराव हो रहा है।'
    );
  });

  test('preserves existing text when spoken text is empty or whitespace only', () => {
    const initialText = 'Existing complaint narrative.';
    const result = mergeTranscript(initialText, '   ', 'append');
    assert.equal(result, 'Existing complaint narrative.');
  });

  test('sets text directly when initial description is empty', () => {
    const spokenHindi = 'सड़क पर भारी जलभराव है और वाहन नहीं निकल पा रहे हैं।';
    const result = mergeTranscript('', spokenHindi, 'append');
    assert.equal(result, spokenHindi);
  });

  test('replaces description when explicitly requested via replace mode', () => {
    const initialText = 'Old draft complaint narrative that citizen wants to replace.';
    const spokenHindi = 'नया विवरण: बिजली का खंभा झुक गया है।';
    const result = mergeTranscript(initialText, spokenHindi, 'replace');
    assert.equal(result, spokenHindi);
  });

  test('trims excess whitespace around recognized speech before inserting', () => {
    const initialText = 'Streetlight broken';
    const spokenText = '   at corner house 42   ';
    const result = mergeTranscript(initialText, spokenText, 'append');
    assert.equal(result, 'Streetlight broken at corner house 42');
  });

  test('does not throw when initial text is null or undefined', () => {
    const spokenHindi = 'कचरा नहीं उठाया गया है।';
    assert.equal(mergeTranscript(null, spokenHindi, 'append'), spokenHindi);
    assert.equal(mergeTranscript(undefined, spokenHindi, 'append'), spokenHindi);
  });
});
