import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Server-side proxy for the Genie backend agent.
//
// The client (backendAgent.ts) sends the userPrompt and optional sessionUUID.
// This route injects the real GENIE_CHATBOT_URL and MEDIACORP_AGENT_UUID from
// server-side environment variables, forwards the request, and streams the SSE
// response back to the client so the session UUID capture and completion
// detection can still happen in backendAgent.ts.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const GENIE_CHATBOT_URL = process.env.GENIE_CHATBOT_URL;
  const MEDIACORP_AGENT_UUID = process.env.MEDIACORP_AGENT_UUID;

  if (!GENIE_CHATBOT_URL || !MEDIACORP_AGENT_UUID) {
    console.error('[/api/genie] GENIE_CHATBOT_URL or MEDIACORP_AGENT_UUID is not set.');
    return NextResponse.json(
      { error: 'Backend agent is not configured.' },
      { status: 500 },
    );
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { userPrompt, sessionUUID } = body;

  if (!userPrompt || typeof userPrompt !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid userPrompt.' }, { status: 400 });
  }

  const payload: Record<string, any> = {
    audioIDs: [],
    customFields: {},
    documentIDs: [],
    imageIDs: [],
    userPrompt,
    uuid: MEDIACORP_AGENT_UUID,
  };

  if (sessionUUID) {
    payload['sessionUUID'] = sessionUUID;
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(GENIE_CHATBOT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[/api/genie] Failed to reach backend:', err);
    return NextResponse.json({ error: 'Could not reach backend agent.' }, { status: 502 });
  }

  if (!backendResponse.ok) {
    console.error('[/api/genie] Backend error:', backendResponse.status);
    return NextResponse.json(
      { error: `Backend returned ${backendResponse.status}` },
      { status: 502 },
    );
  }

  // Stream the SSE response straight back to the client unchanged so that
  // backendAgent.ts can handle session UUID capture and completion detection.
  return new NextResponse(backendResponse.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
