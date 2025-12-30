export const runtime = 'edge';
import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// Endpoint: POST /api/wardrobe/auto-tag
// Body: { imageUrl: string }
// Returns: { category?, colors?, pattern?, material?, brand?, fitStyle? }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageUrl } = body;
    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });
    }

    // Prompt instructing the model to return JSON with clothing tags
    const prompt =
      'For the clothing item in the image, identify the category (e.g., shirt, pants, jacket, dress, shoes, etc.), primary colors (simple color names), pattern (if any, else null), material (approximate: cotton, denim, leather, knit, etc.), visible brand (if confidently identifiable, else null), and fit style (loose, fitted, oversized). Respond strictly as JSON with keys: category, colors, pattern, material, brand, fitStyle.';

    const messages = [
      { role: 'system', content: 'You are an assistant that extracts clothing attributes from images and replies with JSON.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages,
        max_tokens: 200,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    let result: any = {};
    if (content) {
      try {
        result = JSON.parse(content.trim());
      } catch {
        result = {};
      }
    }
    // Return whatever keys were parsed; if parsing failed, return empty object
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({});
  }
}
