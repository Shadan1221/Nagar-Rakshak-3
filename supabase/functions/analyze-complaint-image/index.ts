import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config(); // Load .env file

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Allow large images

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in your environment variables.");
  process.exit(1);
}

app.post("/analyze-image", async (req, res) => {
  try {
    const { imageData, issueType } = req.body;

    // Input validation
    if (!imageData || typeof imageData !== "string") {
      return res.status(400).json({ is_relevant: false, reason: "Image data is missing or invalid." });
    }
    if (!issueType || typeof issueType !== "string") {
      return res.status(400).json({ is_relevant: false, reason: "Issue type is required." });
    }

    const base64ImageData = imageData.replace(/^data:image\/\w+;base64,/, "");

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `
You are an AI assistant for "Nagar Rakshak", a civic issue reporting app.
Analyze the provided image for a complaint about "${issueType}".
Determine if the image is genuinely relevant.
If relevant, provide a concise 2-line description of the problem's severity and genuineness.
Respond ONLY in JSON:
1. For irrelevant images: {"is_relevant": false, "reason": "Image does not appear to be related."}
2. For relevant images: {"is_relevant": true, "description": "YOUR_DESCRIPTION_HERE"}
`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: base64ImageData } },
          ],
        },
      ],
    };

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Google AI API Error:", errorText);
      throw new Error(`AI API request failed with status: ${aiResponse.status}`);
    }

    const result = (await aiResponse.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    if (!result.candidates || result.candidates.length === 0) {
      throw new Error("AI response was empty or blocked. Please upload a clear image.");
    }

    const aiText = result.candidates[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        "AI response did not contain a valid JSON object. Make sure the image is clear."
      );
    }

    const parsedResponse = JSON.parse(jsonMatch[0]);

    return res.json(parsedResponse);
  } catch (error: any) {
    console.error("Error in /analyze-image:", error.message);
    return res.status(500).json({ is_relevant: false, reason: `An error occurred: ${error.message}` });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
