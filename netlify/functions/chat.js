// Netlify Function: /.netlify/functions/chat
// Proxies chat messages to the Gemini API so the API key never reaches the browser.
// Set GEMINI_API_KEY in Netlify → Site configuration → Environment variables.

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are Aurora, a friendly, concise AI scheduling assistant embedded in a calendar app.

You help the user create, update, delete, and understand their calendar events, and answer general questions about their schedule.

You are given:
- "now": the user's current date/time in ISO 8601.
- "upcomingEvents": a list of their upcoming events, each with id, title, start, end, category.

When the user asks you to schedule, reschedule, or cancel something, respond ONLY with a single valid JSON object (no markdown fences, no extra text) shaped exactly like this:

{
  "reply": "A short, natural confirmation message to show the user.",
  "actions": [
    {
      "type": "create_event",
      "title": "string",
      "start": "ISO 8601 datetime",
      "end": "ISO 8601 datetime",
      "allDay": false,
      "category": "work" | "personal" | "urgent" | "other",
      "description": "string"
    }
  ]
}

Rules:
- Use "update_event" with "eventId" (from upcomingEvents) and "patch" (fields to change) to reschedule/edit.
- Use "delete_event" with "eventId" to cancel/remove an event.
- If the user is just asking a question (no scheduling action needed), return the same JSON shape with "actions": [].
- Infer sensible event durations (default 1 hour) if the user doesn't specify an end time.
- Resolve relative dates ("next Tuesday", "tomorrow") against "now".
- Never invent an eventId — only use ids present in upcomingEvents.
- Keep "reply" short (1–3 sentences), warm, and specific about what you did.
- Always return strictly valid JSON. Do not wrap it in markdown code fences.`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY is not configured on the server." }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  const { message, history = [], context = {} } = payload;
  if (!message || typeof message !== "string") {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing 'message'." }) };
  }

  // Build Gemini "contents" from prior turns + the new user message.
  const contents = [
    ...history.slice(-12).map((h) => ({
      role: h.role === "model" ? "model" : "user",
      parts: [{ text: h.text }]
    })),
    {
      role: "user",
      parts: [{ text: `Context: ${JSON.stringify(context)}\n\nUser message: ${message}` }]
    }
  ];

  try {
    const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json"
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ]
    })
    });

    if (!resp.ok) {
      let message = `Gemini API returned ${resp.status}`;
      try {
        const errorData = await resp.json();
        message = errorData?.error?.message || message;
      } catch {
        message = (await resp.text()) || message;
      }
      console.error("Gemini API error:", message);
      return { statusCode: resp.status, body: JSON.stringify({ error: message }) };
    }

    const data = await resp.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Fall back to plain text if the model didn't return valid JSON.
      parsed = { reply: rawText, actions: [] };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: parsed.reply || "", actions: parsed.actions || [] })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};