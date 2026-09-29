import Anthropic from '@anthropic-ai/sdk'

/**
 * Resolved name written into API responses so the frontend can surface
 * which backend actually generated a piece of text.
 */
export type AiProviderName = 'anthropic' | 'gemini' | 'openrouter' | 'local-template'

/**
 * Minimal result returned by every provider implementation.
 */
export interface AiTextResult {
  text: string
  provider: AiProviderName
}

/**
 * Read the active provider from the environment.
 * Falls back to 'anthropic' so local development works once an API key is set.
 */
function activeProvider(): AiProviderName {
  const raw = (process.env.AI_PROVIDER ?? 'anthropic').toLowerCase().trim()
  if (raw === 'gemini') return 'gemini'
  if (raw === 'openrouter') return 'openrouter'
  return 'anthropic'
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function callAnthropic(prompt: string): Promise<AiTextResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const client = new Anthropic({ apiKey })
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5'

  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text' || !block.text.trim()) {
    throw new Error('Anthropic returned an empty response')
  }

  return { text: block.text.trim(), provider: 'anthropic' }
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<AiTextResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => response.statusText)
    throw new Error(`Gemini request failed (${response.status}): ${body}`)
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) throw new Error('Gemini returned an empty response')

  return { text, provider: 'gemini' }
}

// ─── OpenRouter ──────────────────────────────────────────────────────────────

async function callOpenRouter(prompt: string): Promise<AiTextResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

  const model = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat-v3-0324:free'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.APP_URL ?? 'http://localhost:3000',
      'X-Title': '0.5 Show',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => response.statusText)
    throw new Error(`OpenRouter request failed (${response.status}): ${body}`)
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('OpenRouter returned an empty response')

  return { text, provider: 'openrouter' }
}

// ─── Public interface ─────────────────────────────────────────────────────────

/**
 * Generate text using whichever provider is configured via AI_PROVIDER.
 *
 * Throws if the API call fails — callers are responsible for catching and
 * returning an appropriate fallback.
 */
export async function generateText(prompt: string): Promise<AiTextResult> {
  const provider = activeProvider()
  switch (provider) {
    case 'gemini':
      return callGemini(prompt)
    case 'openrouter':
      return callOpenRouter(prompt)
    case 'anthropic':
    default:
      return callAnthropic(prompt)
  }
}

/**
 * Which provider is currently configured (useful for health checks / logging).
 */
export function configuredProvider(): AiProviderName {
  return activeProvider()
}
