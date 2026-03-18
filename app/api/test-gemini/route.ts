export async function GET() {
    try {
        const amount = 10; // change this to test different amounts

        const prompt = `Generate exactly ${amount} interview questions as a JSON array.
Role: Frontend Developer
Level: Junior
Tech stack: React, TypeScript
Type: technical

STRICT RULES:
- Output ONLY a JSON array, nothing else
- No markdown, no backticks, no explanation
- Array must have EXACTLY ${amount} items
- Each item is a string question
- Example format: ["Q1?", "Q2?", "Q3?"]`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                        responseMimeType: "application/json",
                    }
                }),
            }
        );

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

        let parsed: string[] = [];
        try {
            const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            return Response.json({ success: false, error: "Parse failed", rawText });
        }

        return Response.json({
            success: true,
            status: response.status,
            requestedAmount: amount,
            generatedAmount: parsed.length,
            questions: parsed,
        });

    } catch (error) {
        return Response.json({ success: false, error: String(error) });
    }
}