const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 3600;

function buildPrompt(topic, questionCount, grade) {
    return `Jsi tvůrce vzdělávacích únikových her pro české školy. Vygeneruj přesně ${questionCount} otázek na téma: "${topic}"${grade ? ` pro ${grade}` : ''}.

PRAVIDLA:
- Otázky musí být vzdělávací, zábavné a vhodné pro žáky
- Používej různé typy odpovědí: "c" (výběr z možností), "n" (číslo), "t" (text)
- U typu "c" vždy uveď přesně 4 možnosti
- U typu "c" je "c" index správné odpovědi (0-3)
- U typu "n" je "c" správné číslo
- U typu "t" je "c" správný text (jedno slovo nebo krátká fráze)
- Vzorec "f" a nápověda "h" jsou nepovinné, ale alespoň u poloviny otázek je uveď
- Všechny texty piš česky

Odpověz POUZE validním JSON polem (bez markdown, bez vysvětlení):
[
  {
    "t": "Název otázky",
    "d": "Podrobné zadání úlohy pro žáky",
    "f": "Vzorec nebo klíčová informace (nepovinné)",
    "h": "Nápověda pro žáky (nepovinné)",
    "y": "c",
    "o": ["Možnost A", "Možnost B", "Možnost C", "Možnost D"],
    "c": 0
  }
]`;
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateLimitKey = `rate:${ip}`;

        if (env.RATE_LIMIT) {
            const current = parseInt(await env.RATE_LIMIT.get(rateLimitKey) || '0');
            if (current >= RATE_LIMIT_MAX) {
                return new Response(JSON.stringify({ error: 'Příliš mnoho požadavků. Zkuste to za chvíli.' }), {
                    status: 429,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                });
            }
            await env.RATE_LIMIT.put(rateLimitKey, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({ error: 'Neplatný požadavek' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        const { topic, questionCount = 4, grade = '' } = body;

        if (!topic || topic.length > 200) {
            return new Response(JSON.stringify({ error: 'Zadejte téma (max 200 znaků)' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        const count = Math.min(5, Math.max(3, parseInt(questionCount) || 4));
        const prompt = buildPrompt(topic, count, grade);

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API klíč není nakonfigurován' }), {
                status: 500,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        try {
            const models = [
                'gemini-2.0-flash',
                'gemini-2.0-flash-lite',
                'gemini-1.5-flash',
            ];
            const model = env.GEMINI_MODEL || models[0];

            const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 4096,
                            responseMimeType: 'application/json',
                        },
                    }),
                }
            );

            if (!geminiRes.ok) {
                const errText = await geminiRes.text();
                console.error('Gemini error:', geminiRes.status, errText);
                let detail = '';
                try {
                    const errJson = JSON.parse(errText);
                    detail = errJson.error?.message || '';
                } catch {}
                return new Response(JSON.stringify({
                    error: `AI služba vrátila chybu (${geminiRes.status}). ${detail}`.trim()
                }), {
                    status: 502,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                });
            }

            const geminiData = await geminiRes.json();
            const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                return new Response(JSON.stringify({ error: 'AI nevrátila odpověď. Zkuste to znovu.' }), {
                    status: 502,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                });
            }

            const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const questions = JSON.parse(jsonStr);

            if (!Array.isArray(questions) || questions.length === 0) {
                return new Response(JSON.stringify({ error: 'AI vygenerovala neplatná data. Zkuste to znovu.' }), {
                    status: 502,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                });
            }

            const validated = questions.slice(0, 5).map(q => {
                const out = {
                    t: String(q.t || '').slice(0, 200),
                    d: String(q.d || '').slice(0, 1000),
                    y: ['c', 'n', 't'].includes(q.y) ? q.y : 'c',
                    c: q.c,
                };
                if (q.f) out.f = String(q.f).slice(0, 200);
                if (q.h) out.h = String(q.h).slice(0, 200);
                if (out.y === 'c') {
                    out.o = Array.isArray(q.o) ? q.o.slice(0, 4).map(o => String(o).slice(0, 200)) : ['A', 'B', 'C', 'D'];
                    out.c = typeof q.c === 'number' && q.c >= 0 && q.c <= 3 ? q.c : 0;
                }
                return out;
            });

            return new Response(JSON.stringify({ questions: validated }), {
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        } catch (err) {
            console.error('Worker error:', err);
            return new Response(JSON.stringify({ error: 'Chyba při generování. Zkuste to znovu.' }), {
                status: 500,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }
    },
};
