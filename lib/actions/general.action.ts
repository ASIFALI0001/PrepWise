"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

// ================= CREATE FEEDBACK =================
export async function createFeedback(params: CreateFeedbackParams) {
    const { interviewId, userId, transcript, feedbackId } = params;

    try {
        if (!interviewId || !userId || !transcript) {
            throw new Error("Missing required fields in createFeedback");
        }

        const formattedTranscript = transcript
            .map(
                (sentence: { role: string; content: string }) =>
                    `- ${sentence.role}: ${sentence.content}\n`
            )
            .join("");

        const { object } = await generateObject({
            model: google("gemini-2.0-flash"),  // ✅ updated model
            schema: feedbackSchema,
            prompt: `
You are a strict AI interviewer evaluating a candidate based on their interview transcript.

Transcript:
${formattedTranscript}

Please evaluate the candidate and provide scores (0-100) for each category:
- Communication Skills: clarity, articulation, listening
- Technical Knowledge: accuracy, depth of knowledge
- Problem Solving: analytical thinking, approach to problems
- Cultural Fit: values, teamwork, attitude
- Confidence and Clarity: confidence, clear responses

Also provide:
- Overall total score (0-100)
- Key strengths
- Areas for improvement
- Final assessment summary
`,
        });

        const feedback = {
            interviewId,
            userId,
            totalScore: object.totalScore ?? 0,
            categoryScores: object.categoryScores ?? {},
            strengths: object.strengths ?? [],
            areasForImprovement: object.areasForImprovement ?? [],
            finalAssessment: object.finalAssessment ?? "",
            createdAt: new Date().toISOString(),
        };

        const feedbackRef = feedbackId
            ? db.collection("feedback").doc(feedbackId)
            : db.collection("feedback").doc();

        await feedbackRef.set(feedback);

        return { success: true, feedbackId: feedbackRef.id };
    } catch (error) {
        console.error("Error saving feedback:", error);
        return { success: false };
    }
}

// ================= GET INTERVIEW =================
export async function getInterviewById(
    id: string
): Promise<Interview | null> {
    if (!id) return null;

    try {
        const interview = await db.collection("interviews").doc(id).get();

        if (!interview.exists) return null;

        return { id: interview.id, ...interview.data() } as Interview;
    } catch (error) {
        console.error("Error fetching interview:", error);
        return null;
    }
}

// ================= GET FEEDBACK =================
export async function getFeedbackByInterviewId(
    params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
    const { interviewId, userId } = params;

    if (!interviewId || !userId) return null;

    try {
        const querySnapshot = await db
            .collection("feedback")
            .where("interviewId", "==", interviewId)
            .where("userId", "==", userId)
            .limit(1)
            .get();

        if (querySnapshot.empty) return null;

        const feedbackDoc = querySnapshot.docs[0];

        return {
            id: feedbackDoc.id,
            ...feedbackDoc.data(),
        } as Feedback;
    } catch (error) {
        console.error("Error fetching feedback:", error);
        return null;
    }
}

// ================= GET LATEST INTERVIEWS =================
export async function getLatestInterviews(
    params: GetLatestInterviewsParams
): Promise<Interview[]> {
    const { userId, limit = 20 } = params;

    if (!userId) return [];

    try {
        const snapshot = await db
            .collection("interviews")
            .limit(limit * 3)
            .get();

        const filtered = snapshot.docs
            .map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }))
            .filter(
                (interview: any) =>
                    interview.finalized === true &&
                    interview.userId !== userId
            )
            .sort(
                (a: any, b: any) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
            )
            .slice(0, limit);

        return filtered as Interview[];
    } catch (error) {
        console.error("Error fetching latest interviews:", error);
        return [];
    }
}

// ================= GET USER INTERVIEWS =================
export async function getInterviewsByUserId(
    userId: string
): Promise<Interview[]> {
    if (!userId) return [];

    try {
        const interviews = await db
            .collection("interviews")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .get();

        return interviews.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Interview[];
    } catch (error) {
        console.error("Error fetching user interviews:", error);
        return [];
    }
}