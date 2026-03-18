export async function GET() {
    try {
        const models = [
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-flash-latest",
        ];

        for (const model of models) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`;

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: 'Return this exact JSON array with no extra text: ["What is React?", "Explain useState hook", "What is TypeScript?"]' }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    }
                }),
            });

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (response.status === 200) {
                return Response.json({
                    success: true,
                    winner: model,
                    status: response.status,
                    rawText: text,
                });
            } else {
                console.log(`❌ ${model}: ${response.status} - ${data?.error?.message}`);
            }
        }

        return Response.json({ success: false, message: "No working model found" });

    } catch (error) {
        return Response.json({ success: false, error: String(error) });
    }
}