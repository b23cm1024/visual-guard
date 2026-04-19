"use strict";
const OpenAI = require("openai");

const PROVIDER = (process.env.AI_PROVIDER || "openai").toLowerCase();

let client;
if (PROVIDER === "nvidia") {
  client = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });
} else {
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const MODEL = PROVIDER === "nvidia"
  ? "meta/llama-3.2-11b-vision-instruct"
  : "gpt-4o";

/* ===============================
   CORE PROMPT — ACCESSIBILITY-FIRST
   Designed for visually impaired users.
   Gives precise, actionable, simple descriptions.
=============================== */
const ACCESSIBILITY_SYSTEM_PROMPT = `You are an AI assistant for a visually impaired person. Your job is to describe what you see clearly and simply so they can navigate their daily life safely.

STRICT RULES:
1. MAXIMUM 1-2 short sentences. Never exceed 30 words total.
2. Start with the MOST IMPORTANT thing first.
3. Use simple everyday words only.
4. Use spatial words: "in front of you", "to your left", "nearby".
5. If there is a SAFETY HAZARD, start with "CAUTION:" first.
6. Never say "I see an image" — speak as if you are the user's eyes.
7. Do NOT list every object. Only mention what matters for the user to act.`;

async function analyzeImage(imageBuffer, mimeType, prompt) {
  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 80,
    messages: [
      { role: "system", content: ACCESSIBILITY_SYSTEM_PROMPT },
      { role: "user", content: [
        { type: "image_url", image_url: { url: dataUrl, detail: "auto" } },
        { type: "text", text: prompt }
      ]}
    ],
  });
  return response.choices?.[0]?.message?.content?.trim() || "No description available.";
}

async function describeScene(buf, mime) {
  return analyzeImage(buf, mime,
    "Describe what is in front of me right now. Focus on: people, objects I can interact with, obstacles, and any text or signs. Keep it short and useful for daily tasks."
  );
}

async function readText(buf, mime) {
  return analyzeImage(buf, mime, "Read all visible text. Tell me what it says and where it is.");
}

async function describePerson(buf, mime) {
  return analyzeImage(buf, mime,
    "Describe the person in front of me: what they look like, what they are wearing, and what they are doing."
  );
}

async function detectHazards(buf, mime) {
  return analyzeImage(buf, mime,
    "Look for ANY safety hazards: stairs, vehicles, wet surfaces, fire, sharp objects, moving objects, uneven ground, or anything dangerous. If there is a hazard, say CAUTION first. If everything looks safe, say 'Area looks clear and safe.'"
  );
}

async function fullAnalysis(buf, mime) {
  return analyzeImage(buf, mime,
    "Give a complete but short description: who is here, what objects are nearby, any text or signs, and any safety concerns. Prioritize what I need to know to act safely."
  );
}

module.exports = { analyzeImage, describeScene, readText, describePerson, detectHazards, fullAnalysis };