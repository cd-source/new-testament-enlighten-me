const ANTHROPIC_MODELS = (process.env.ANTHROPIC_MODEL
  ? [process.env.ANTHROPIC_MODEL]
  : [
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
    ]);
const FREEPIK_MODEL = process.env.FREEPIK_MODEL || "mystic";
const FREEPIK_BASE_URL = "https://api.freepik.com";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function missingEnv() {
  return ["ANTHROPIC_API_KEY", "FREEPIK_API_KEY"].filter((name) => !process.env[name]);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function writeIllustrationPrompt({ passage, reference }) {
  let lastError = null;

  for (const model of ANTHROPIC_MODELS) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model,
        max_tokens: 420,
        temperature: 0.75,
        system: [
          "You write image-generation prompts for reverent biblical illustrations.",
          "The style is ancient Old and New Testament / biblical, not modern or contemporary.",
          "Use cinematic sacred illustration language: parchment warmth, oil-painting depth, ancient Near Eastern and Judean landscapes, lamplight, robes, sandals, stone, olive trees, desert dawn, mountains, rivers, wilderness, humble faces, divine light.",
          "The image may be a literal biblical scene, or it may be a symbolic/metaphorical visual interpretation of the passage when metaphor better captures the spiritual message.",
          "If using metaphor, keep it grounded in ancient biblical visual language: light and shadow, wilderness and water, seed and harvest, gates and paths, lamps, bread, vessels, storms, stillness, hands, robes, stone, olive branches, and sacred radiance.",
          "Do not include text, typography, captions, logos, watermarks, modern clothing, modern buildings, phones, cameras, neon, sci-fi, fantasy armor, or comic-book style.",
          "Return only the final image prompt. No commentary. No markdown.",
        ].join(" "),
        messages: [
          {
            role: "user",
            content: [
              `Passage: ${passage}`,
              `Reference: ${reference}`,
              "Write one evocative image-generation prompt that captures the tone, spiritual message, and emotional center of this passage.",
              "Choose either a literal biblical illustration or a metaphorical/symbolic biblical image, whichever best communicates the passage.",
              "Make it reverent, luminous, emotionally clear, and ancient-world in atmosphere.",
            ].join("\n"),
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      lastError = new Error(`Anthropic error ${response.status} on ${model}: ${payload?.error?.message || response.statusText}`);
      if ([400, 404].includes(response.status) && String(payload?.error?.message || "").includes("model")) continue;
      throw lastError;
    }

    const text = payload?.content
      ?.map((part) => (part?.type === "text" ? part.text : ""))
      .join(" ");

    const prompt = compact(text);
    if (!prompt) throw new Error("Anthropic returned an empty image prompt.");
    return prompt;
  }

  throw lastError || new Error("No Anthropic Sonnet model was available.");
}

function freepikPath() {
  if (FREEPIK_MODEL === "flux-pro") return "/v1/ai/text-to-image/flux-pro-v1-1";
  return "/v1/ai/mystic";
}

function extractTaskId(payload) {
  return (
    payload?.data?.task_id ||
    payload?.data?.taskId ||
    payload?.task_id ||
    payload?.taskId ||
    payload?.id ||
    payload?.data?.id
  );
}

function extractStatus(payload) {
  return String(payload?.data?.status || payload?.status || "").toUpperCase();
}

function extractImageUrl(payload) {
  const candidates = [
    payload?.data?.generated?.[0],
    payload?.data?.generated?.[0]?.url,
    payload?.data?.images?.[0],
    payload?.data?.images?.[0]?.url,
    payload?.data?.result?.url,
    payload?.data?.url,
    payload?.generated?.[0],
    payload?.generated?.[0]?.url,
    payload?.images?.[0],
    payload?.images?.[0]?.url,
    payload?.result?.url,
    payload?.image_url,
    payload?.url,
  ].filter(Boolean);

  const url = candidates.find((candidate) => typeof candidate === "string" && /^https?:\/\//.test(candidate));
  return url || null;
}

async function startFreepikImage(prompt) {
  const endpoint = `${FREEPIK_BASE_URL}${freepikPath()}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-freepik-api-key": process.env.FREEPIK_API_KEY,
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: "classic_4_3",
      output_format: "jpeg",
      prompt_upsampling: true,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Freepik create error ${response.status}: ${payload?.message || payload?.error || response.statusText}`);
  }

  const taskId = extractTaskId(payload);
  const immediateUrl = extractImageUrl(payload);

  if (!taskId && !immediateUrl) {
    throw new Error("Freepik did not return a task id or image URL.");
  }

  return { taskId, immediateUrl, payload };
}

async function pollFreepikImage(taskId) {
  const endpoint = `${FREEPIK_BASE_URL}${freepikPath()}/${encodeURIComponent(taskId)}`;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt < 3 ? 1500 : 2500));

    const response = await fetch(endpoint, {
      headers: {
        "Content-Type": "application/json",
        "x-freepik-api-key": process.env.FREEPIK_API_KEY,
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Freepik poll error ${response.status}: ${payload?.message || payload?.error || response.statusText}`);
    }

    const imageUrl = extractImageUrl(payload);
    if (imageUrl) return { imageUrl, payload };

    const status = extractStatus(payload);
    if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) {
      throw new Error(`Freepik image generation failed: ${payload?.data?.error || payload?.error || status}`);
    }
  }

  throw new Error("Freepik image generation timed out before an image was ready.");
}

async function imageUrlToDataUrl(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > 4_000_000) return null;

    return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
  } catch (_error) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const missing = missingEnv();
  if (missing.length) {
    return json(res, 500, {
      error: `Missing server environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
    });
  }

  try {
    const body = await readBody(req);
    const passage = compact(body.passage);
    const reference = compact(body.reference);

    if (!passage || !reference) {
      return json(res, 400, { error: "Passage and reference are required." });
    }

    const prompt = await writeIllustrationPrompt({ passage, reference });
    const started = await startFreepikImage(prompt);
    const image = started.immediateUrl
      ? { imageUrl: started.immediateUrl, payload: started.payload }
      : await pollFreepikImage(started.taskId);

    const imageDataUrl = await imageUrlToDataUrl(image.imageUrl);

    return json(res, 200, {
      imageUrl: image.imageUrl,
      imageDataUrl,
      prompt,
      reference,
    });
  } catch (error) {
    console.error(error);
    return json(res, 500, {
      error: error?.message || "Image generation failed.",
    });
  }
};
