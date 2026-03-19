# Prompt 005 -- AI Service Writer (Multilingual Voice to 3C)

## Priority: CRITICAL (core differentiator -- no competitor has this)
## Estimated time: 45-60 minutes
## Depends on: Prompt 004 (RO lines must exist)

---

## What To Do

1. Read .truckzen/TASKS/CC_RULES.md first.
3. Read .truckzen/TASKS/BRAND_GUIDE.md for all UI styling rules (colors, fonts, spacing, components).
2. Read .truckzen/DONE/CURRENT_STATUS.md to confirm Prompt 004 is done.

## Context

Most heavy-duty mechanics in the US speak different native languages: English, Russian, Uzbek, Spanish. Writing professional repair notes in English is a barrier. The AI Service Writer solves this.

The mechanic taps a microphone button, speaks in their own language, and AI generates professional English Cause and Correction for the official record. The tech also sees the result in their language.

Each mechanic's preferred language is set in their user profile by the Office Admin.

## Build These

### 1. API Route: src/app/api/ai/service-writer/route.ts

POST endpoint that:
- Receives: { text: string, language: string, line_id: string, field: 'cause' | 'correction' }
- text = what the mechanic said (transcribed from voice, or typed)
- language = the mechanic's language code ('en', 'ru', 'uz', 'es')
- Calls the Anthropic Claude API with this system prompt:

```
You are an AI Service Writer for a semi truck repair shop. A technician has described what they found or what they did in their own language. Your job is to:

1. Translate their input to professional English suitable for an official repair order
2. Write it in standard automotive repair terminology
3. Keep it concise but complete
4. Format: 1-3 sentences, no bullet points, professional tone

The technician speaks: {language_name}
They are describing the: {field} (either what they found wrong, or what they did to fix it)

Respond with ONLY a JSON object:
{
  "english": "Professional English text for the official record",
  "original_display": "The same content in the technician's language for their review"
}
```

- Uses model: claude-sonnet-4-6 (this is the current model string -- do NOT use old format like claude-sonnet-4-20250514)
- Parses the response JSON
- Updates the repair_order_line with the cause or correction in English
- Also stores the original language text in cause_original_language / correction_original_language fields
- Logs the API call to ai_usage_log table (tokens, cost, feature='service_writer')
- Returns: { english, original_display, tokens_used }

**Environment variable needed:** ANTHROPIC_API_KEY (already should be in Vercel env or .env.local)

If ANTHROPIC_API_KEY is not set, the endpoint should return a clear error: "AI Service Writer is not configured. Add ANTHROPIC_API_KEY to environment variables."

### 2. Voice Input Component: src/components/VoiceInput.tsx

A button component that:
- Shows a microphone icon button
- On click: starts browser Speech Recognition API (Web Speech API)
- While recording: button pulses/glows, shows "Listening..." text
- On speech end: shows the transcribed text in a preview area
- User can edit the transcription before submitting
- "Send to AI" button that calls the /api/ai/service-writer endpoint
- Shows loading spinner while AI processes
- On response: shows both the English result and the original language version
- "Accept" button that saves the result to the RO line
- "Try Again" button that clears and lets them re-record

**Speech Recognition notes:**
- Use window.webkitSpeechRecognition || window.SpeechRecognition
- Set lang based on mechanic's language: 'en-US', 'ru-RU', 'uz-UZ', 'es-ES'
- continuous = false, interimResults = true
- If Speech API is not available (some browsers), show a text input fallback with placeholder "Type what you found..."

### 3. Integrate into RO Line Card

Update the ROLineCard.tsx component (from Prompt 004):
- Add the VoiceInput component next to the Cause and Correction text fields
- When the mechanic expands a complaint line, they see:
  - Complaint text (read-only -- this is what the customer reported)
  - Cause field: text area + microphone button (VoiceInput)
  - Correction field: text area + microphone button (VoiceInput)
- After AI fills in cause/correction, both the English text and original language text are visible
- English text is in the main field (this is the official record)
- Original language text is shown below in a lighter/smaller style with a label like "Original (Russian):"

### 4. User Language Setting

Check if the users table has a `language` or `preferred_language` column. If not, add it:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';
```

The VoiceInput component reads the current user's language to:
- Set the Speech Recognition language
- Send the correct language code to the AI endpoint

### 5. Install Anthropic SDK

```bash
npm install @anthropic-ai/sdk
```

Create a shared client: src/lib/anthropic.ts
```typescript
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}
```

## UI Rules
- Microphone button: circular, prominent, uses a recognizable mic icon
- Recording state: pulsing animation (CSS only, no libraries)
- AI processing state: subtle loading spinner
- Result display: clear distinction between English (primary) and original language (secondary)
- Error states: clear messages if mic permission denied, Speech API unavailable, or AI fails
- No emojis anywhere

## Verification

- npm run build passes clean
- The /api/ai/service-writer endpoint responds correctly (test with curl if needed)
- VoiceInput component renders on RO line cards
- Browser microphone permission prompt appears on first use
- Text fallback works when Speech API is unavailable
- AI generates proper English cause/correction from test input
- Original language text is stored and displayed
- ai_usage_log records are created for each API call

## After Task
Update .truckzen/DONE/ files per CC_RULES.md. Git commit and push.
