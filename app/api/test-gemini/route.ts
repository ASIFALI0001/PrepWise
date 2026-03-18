export async function GET() {
    try {
        console.log("🔑 API Key exists:", !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: 'Return this exact JSON array: ["Question 1", "Question 2", "Question 3"]' }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    }
                }),
            }
        );

        const data = await response.json();
        console.log("Gemini response:", JSON.stringify(data, null, 2));

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        return Response.json({
            success: true,
            rawText: text,
            status: response.status,
            hasApiKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: String(error)
        });
    }
}