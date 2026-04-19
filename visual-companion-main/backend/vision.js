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

async function analyzeImage(imageBuffer, mimeType, prompt) {
  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: dataUrl, detail: "auto" } },
      { type: "text", text: prompt }
    ]}],
  });
  return response.choices?.[0]?.message?.content?.trim() || "No description available.";
}

async function describeScene(buf, mime) {
  return analyzeImage(buf, mime, "Describe this scene in 2-3 clear sentences for a visually impaired user.");
}
async function readText(buf, mime) {
  return analyzeImage(buf, mime, "Extract and read all visible text from this image.");
}
async function describePerson(buf, mime) {
  return analyzeImage(buf, mime, "Describe any people visible in this image for a visually impaired user.");
}
async function fullAnalysis(buf, mime) {
  return analyzeImage(buf, mime, "Give a comprehensive description of this image including scene, people, objects, and any text.");
}

module.exports = { analyzeImage, describeScene, readText, describePerson, fullAnalysis };