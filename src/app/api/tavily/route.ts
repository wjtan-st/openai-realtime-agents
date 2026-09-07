import { NextRequest, NextResponse } from 'next/server';
import { tavily } from '@tavily/core';

// Server-side proxy for Tavily search.
// The API key never leaves the server; the client only calls this route.
export async function POST(req: NextRequest) {
  const { query, max_results = 5 } = await req.json();

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid query.' }, { status: 400 });
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.error('TAVILY_API_KEY is not set.');
    return NextResponse.json({ error: 'Search service is not configured.' }, { status: 500 });
  }

  try {
    const client = tavily({ apiKey });

    const response = await client.search(query, {
      searchDepth: 'advanced',
      maxResults: max_results,
      includeAnswer: false,
      includeRawContent: true,
    });

    const results = (response.results ?? []).map((r: any) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      raw_content: r.rawContent ?? r.content ?? '',
    }));

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('Tavily search error:', err);
    return NextResponse.json({ error: err?.message ?? 'Search failed.' }, { status: 500 });
  }
}
