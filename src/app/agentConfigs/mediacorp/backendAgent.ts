import { tool } from '@openai/agents/realtime';
import type { RealtimeItem } from '@openai/agents/realtime';

// ─────────────────────────────────────────────────────────────────────────────
// Backend Agent Integration
//
// Replaces the local researchAgent with a call to an external backend service
// that is significantly more capable: it can access databases, perform web
// searches, authenticate users via OTP, and more.
//
// The chat agent calls `invokeBackendAgent` whenever it needs information or
// actions that go beyond its own knowledge. The backend returns a
// ready-to-speak answer that the chat agent reads back to the user.
// ─────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Session state
//
// sessionUUID is assigned by the backend on the first call and must be
// attached to all subsequent calls within the same voice session so the
// backend can maintain conversational context.
//
// Call resetBackendSession() whenever the voice session disconnects so the
// next connection starts fresh.
// ---------------------------------------------------------------------------
let sessionUUID: string | null = null;

export function resetBackendSession(): void {
  sessionUUID = null;
}

// ---------------------------------------------------------------------------
// Core fetch helper — POSTs to the backend and reads the SSE stream
// ---------------------------------------------------------------------------
async function callBackendAgent(userPrompt: string): Promise<string> {
  const payload: Record<string, any> = { userPrompt };

  // Attach the session UUID on all calls after the first
  if (sessionUUID) {
    payload['sessionUUID'] = sessionUUID;
  }

  const response = await fetch('/api/genie', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.warn('[backendAgent] HTTP error', response.status);
    throw new Error(`Backend returned ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Backend response has no body');
  }

  // Read the SSE stream line-by-line
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let answer: string | null = null;

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    // Keep the last (potentially incomplete) line in the buffer
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;

      const dataStr = line.slice('data:'.length).trim();
      if (!dataStr) continue;

      let event: Record<string, any>;
      try {
        event = JSON.parse(dataStr);
      } catch {
        console.warn('[backendAgent] Non-JSON SSE data:', dataStr);
        continue;
      }

      // Capture the session UUID from the backend on the very first event
      if (!sessionUUID && event['uuid']) {
        sessionUUID = event['uuid'] as string;
        console.info('[backendAgent] session UUID set:', sessionUUID);
      }

      if (event['status'] === 'completed') {
        answer = (event['answer'] as string) ?? null;
        console.info('[backendAgent] completed, answer:', answer);
        break outer;
      }
    }
  }

  if (answer === null) {
    console.warn('[backendAgent] SSE stream ended without a completed event.');
    throw new Error('No completed response from backend agent.');
  }

  return answer;
}

// ---------------------------------------------------------------------------
// Exported tool — called by the realtime chat agent
// ---------------------------------------------------------------------------
export const invokeBackendAgent = tool({
  name: 'invokeBackendAgent',
  description:
    'Consults a capable backend agent that can search the web, access databases, authenticate users and more. Returns a ready-to-speak answer. Use this whenever the question requires current, specific, or uncertain information, or any action beyond general knowledge.',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description:
          "Key information extracted from the user's most recent message. Be specific — include any titles, dates, account details, or preferences the user mentioned.",
      },
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const { relevantContextFromLastUserMessage } = input as {
      relevantContextFromLastUserMessage: string;
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    // Build a structured prompt combining conversation history + latest context
    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];
    const filteredHistory = history.filter((item) => item.type === 'message');

    const userPrompt = [
      '==== Conversation History ====',
      JSON.stringify(filteredHistory, null, 2),
      '',
      '==== Relevant Context From Last User Message ====',
      relevantContextFromLastUserMessage,
    ].join('\n');

    addBreadcrumb?.('[backendAgent] invoking', {
      sessionUUID,
      relevantContextFromLastUserMessage,
    });

    try {
      const answer = await callBackendAgent(userPrompt);
      addBreadcrumb?.('[backendAgent] response', { answer });
      return { nextResponse: answer };
    } catch (err) {
      console.error('[backendAgent] error:', err);
      addBreadcrumb?.('[backendAgent] error', { error: String(err) });
      return { error: 'Something went wrong reaching the backend agent.' };
    }
  },
});
