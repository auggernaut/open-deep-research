import { NextResponse } from 'next/server'
import { CONFIG } from '@/lib/config'
import { generateHtml } from '@/lib/documents'
import { extractAndParseJSON } from '@/lib/utils'
import { type Article } from '@/types'

export async function POST(request: Request) {
  try {
    const { query, prompt, model } = await request.json()

    if (!query || !prompt || !model) {
      return NextResponse.json(
        { error: 'query, prompt, and model are required' },
        { status: 400 }
      )
    }

    // 1. Search for results
    const searchResponse = await fetch(`http://localhost:3000/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query }),
    })

    if (!searchResponse.ok) {
      throw new Error('Search failed')
    }

    const searchResults = await searchResponse.json()
    const results = searchResults.webPages.value.slice(0, CONFIG.search.maxSelectableResults)

    // 2. Fetch content for each result
    const contentResults = await Promise.all(
      results.map(async (result: any) => {
        try {
          const contentResponse = await fetch(`http://localhost:3000/api/fetch-content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: result.url }),
          })

          if (!contentResponse.ok) {
            return {
              ...result,
              content: result.snippet,
            }
          }

          const { content } = await contentResponse.json()
          return {
            ...result,
            content: content || result.snippet,
          }
        } catch (error) {
          return {
            ...result,
            content: result.snippet,
          }
        }
      })
    )

    // 3. Generate report
    const reportResponse = await fetch(`http://localhost:3000/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedResults: contentResults.filter((r: Article) => r.content?.trim()),
        sources: results,
        prompt: prompt,
        platformModel: model,
      }),
    })

    if (!reportResponse.ok) {
      const errorData = await reportResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Report generation failed:', {
        status: reportResponse.status,
        statusText: reportResponse.statusText,
        error: errorData
      });
      throw new Error(`Report generation failed: ${JSON.stringify(errorData)}`);
    }

    const reportData = await reportResponse.json()

    // 4. Convert to HTML
    const html = generateHtml(reportData)

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error) {
    console.error('Research API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate research report' },
      { status: 500 }
    )
  }
}