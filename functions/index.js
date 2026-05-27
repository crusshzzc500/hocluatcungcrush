const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "weakTopics", "keyMistakes", "actions", "warning"],
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    weakTopics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" }
        }
      }
    },
    keyMistakes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "diagnosis", "fix"],
        properties: {
          question: { type: "string" },
          diagnosis: { type: "string" },
          fix: { type: "string" }
        }
      }
    },
    actions: {
      type: "array",
      items: { type: "string" }
    },
    warning: { type: "string" }
  }
};

function setCors(req, res) {
  const origin = req.get("origin") || "";
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  const originAllowed = !allowed.length || allowed.includes(origin);
  if (originAllowed) res.set("Access-Control-Allow-Origin", origin || "*");
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function asText(value, maxLength = 600) {
  return String(value || "").trim().slice(0, maxLength);
}

function compactSnapshot(input) {
  if (!input || typeof input !== "object") throw new Error("Missing snapshot");
  const result = input.result && typeof input.result === "object" ? input.result : {};
  const rows = Array.isArray(input.questions) ? input.questions.slice(0, 60) : [];
  if (!rows.length) throw new Error("No question rows");
  return {
    result: {
      correct: Number(result.correct || 0),
      total: Number(result.total || rows.length),
      score: Number(result.score || 0),
      rate: Number(result.rate || 0),
      set: asText(result.set, 40),
      mode: asText(result.mode, 40),
      durationSec: Number(result.durationSec || 0),
      blank: Number(result.blank || 0)
    },
    topics: Array.isArray(input.topics) ? input.topics.slice(0, 12) : [],
    difficulties: Array.isArray(input.difficulties) ? input.difficulties.slice(0, 8) : [],
    questions: rows.map(row => ({
      order: Number(row.order || 0),
      uid: asText(row.uid, 60),
      topic: asText(row.topic, 160),
      chapter: asText(row.chapter, 180),
      difficulty: asText(row.difficulty, 60),
      status: ["correct", "wrong", "blank"].includes(row.status) ? row.status : "wrong",
      question: asText(row.question, 700),
      chosenAnswer: asText(row.chosenAnswer, 500),
      correctAnswer: asText(row.correctAnswer, 500),
      support: asText(row.support, 500),
      explanation: asText(row.explanation, 700)
    }))
  };
}

exports.analyzeWeakness = onRequest(
  {
    region: "asia-southeast1",
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 60,
    memory: "256MiB"
  },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const snapshot = compactSnapshot(req.body && req.body.snapshot);
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
      const model = process.env.OPENAI_MODEL || "gpt-5.5";
      const response = await openai.responses.create({
        model,
        reasoning: { effort: "medium" },
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "weakness_analysis",
            strict: true,
            schema: analysisSchema
          }
        },
        input: [
          {
            role: "system",
            content:
              "Bạn là gia sư ôn thi Luật Hình sự Việt Nam. Phân tích điểm yếu dựa duy nhất trên JSON bài làm, không bịa điều luật hoặc nguồn ngoài. Viết tiếng Việt ngắn gọn, cụ thể, ưu tiên chẩn đoán nhầm lẫn kiến thức và đưa lộ trình ôn ngay được."
          },
          {
            role: "user",
            content:
              "Hãy trả JSON đúng schema. Yêu cầu: headline 1 câu; summary 2-3 câu; weakTopics tối đa 3 mục; keyMistakes tối đa 4 câu sai/bỏ trống đáng chú ý; actions đúng 3-5 bước ôn tập.\n\nDữ liệu bài làm:\n" +
              JSON.stringify(snapshot)
          }
        ]
      });

      const text = response.output_text || "{}";
      const analysis = JSON.parse(text);
      res.status(200).json({ analysis, model });
    } catch (error) {
      console.error("analyzeWeakness failed", error);
      res.status(400).json({
        error: "AI analysis failed",
        message: error.message || "unknown"
      });
    }
  }
);
