require("dotenv").config();

const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

const hasAI = Boolean(process.env.OPENAI_API_KEY);
const client = hasAI ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

const SYSTEM_PROMPT = `
You are TripPilot, a friendly travel-planning assistant.
Create practical, age-appropriate travel plans.
Never invent live availability, booking confirmations, prices, visa approvals, or opening hours.
When current information matters, clearly tell the user to verify it.
Prefer realistic pacing: do not pack every day with too many attractions.
Include local transport suggestions, food ideas, safety-aware practical tips, and estimated budget ranges when useful.
Do not encourage dangerous activities or restricted substances.
Keep answers concise but useful.
`;

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function validatePlan(body) {
  const destination = clean(body.destination, 120);
  const startDate = clean(body.startDate, 20);
  const days = Number(body.days);
  const travellers = Number(body.travellers);
  const budget = clean(body.budget, 40);
  const style = clean(body.style, 80);
  const interests = Array.isArray(body.interests)
    ? body.interests.map(x => clean(x, 50)).slice(0, 8)
    : [];

  if (!destination) return { error: "Please enter a destination." };
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    return { error: "Trip length must be between 1 and 30 days." };
  }
  if (!Number.isInteger(travellers) || travellers < 1 || travellers > 20) {
    return { error: "Travellers must be between 1 and 20." };
  }

  return { destination, startDate, days, travellers, budget, style, interests };
}

function demoPlan(data) {
  const interests = data.interests.length ? data.interests.join(", ") : "sightseeing, food and culture";
  const days = Array.from({ length: data.days }, (_, i) => ({
    day: i + 1,
    title: i === 0 ? "Arrival & first impressions" : i === data.days - 1 ? "Highlights & departure" : `Explore ${data.destination}`,
    morning: i === 0
      ? `Arrive, settle in and take a relaxed walk around a central neighbourhood in ${data.destination}.`
      : `Start with a highly rated local attraction connected to ${interests}.`,
    afternoon: `Enjoy a flexible lunch and explore a nearby district, market, museum or landmark.`,
    evening: `Have dinner featuring local cuisine and keep the evening relaxed.`,
    tip: "Verify opening hours and transport times before leaving your accommodation."
  }));

  return {
    mode: "demo",
    summary: `A ${data.days}-day ${data.style || "balanced"} trip to ${data.destination} for ${data.travellers} traveller(s), focused on ${interests}.`,
    budget: data.budget || "Flexible",
    days
  };
}

function demoChat(message) {
  const lower = message.toLowerCase();
  if (lower.includes("budget")) {
    return "For a budget-friendly trip, prioritise public transport, local eateries, free attractions and accommodation near a well-connected area. Set aside a separate buffer for transport and unexpected costs.";
  }
  if (lower.includes("pack")) {
    return "Pack comfortable walking shoes, weather-appropriate layers, basic toiletries, chargers/power bank and copies of important travel documents. Check the destination forecast shortly before departure.";
  }
  if (lower.includes("food")) {
    return "Try a mix of well-known local dishes and neighbourhood spots. If you have allergies or dietary restrictions, confirm ingredients directly with the restaurant.";
  }
  return "I can help with itineraries, budgets, packing lists, neighbourhoods, food ideas and day-by-day plans. Tell me your destination, trip length and travel style.";
}

async function aiText(instructions, input) {
  const response = await client.responses.create({
    model: MODEL,
    instructions,
    input
  });
  return response.output_text;
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    aiConfigured: hasAI,
    mode: hasAI ? "ai" : "demo"
  });
});

app.post("/api/plan", async (req, res, next) => {
  try {
    const data = validatePlan(req.body);
    if (data.error) return res.status(400).json({ error: data.error });

    if (!hasAI) return res.json(demoPlan(data));

    const prompt = `
Create a travel itinerary for:
Destination: ${data.destination}
Start date: ${data.startDate || "not specified"}
Duration: ${data.days} days
Travellers: ${data.travellers}
Budget: ${data.budget || "not specified"}
Travel style: ${data.style || "balanced"}
Interests: ${data.interests.join(", ") || "general sightseeing"}

Return ONLY valid JSON matching this structure:
{
  "summary": "short overview",
  "budget": "budget guidance",
  "days": [
    {
      "day": 1,
      "title": "short title",
      "morning": "plan",
      "afternoon": "plan",
      "evening": "plan",
      "tip": "practical verification/safety tip"
    }
  ]
}
There must be exactly ${data.days} day objects. Do not use markdown fences.
`;

    const raw = await aiText(SYSTEM_PROMPT, prompt);
    const jsonText = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let result;
    try {
      result = JSON.parse(jsonText);
    } catch {
      return res.status(502).json({ error: "The AI returned an unexpected itinerary format. Please try again." });
    }

    result.mode = "ai";
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post("/api/chat", async (req, res, next) => {
  try {
    const message = clean(req.body.message, 2000);
    const history = Array.isArray(req.body.history)
      ? req.body.history.slice(-12).map(item => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: clean(item.content, 2000)
        }))
      : [];

    if (!message) return res.status(400).json({ error: "Please enter a message." });

    if (!hasAI) return res.json({ reply: demoChat(message), mode: "demo" });

    const conversation = [
      ...history,
      { role: "user", content: message }
    ];

    const reply = await aiText(
      SYSTEM_PROMPT + "\nYou are currently in a conversational travel assistant. Answer the user's latest request directly.",
      conversation
    );

    res.json({ reply, mode: "ai" });
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).sendFile(path.join(__dirname, "public", "500.html"));
});

app.listen(PORT, () => {
  console.log(`TripPilot AI running at http://localhost:${PORT}`);
  console.log(`AI mode: ${hasAI ? "enabled" : "demo mode"}`);
});
