"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import { deleteFeedbackByInterviewId } from "@/lib/actions/general.action";

interface RetakeButtonProps {
    interviewId: string;
    userId: string;
    feedbackId: string;
}

const RetakeButton = ({ interviewId, userId, feedbackId }: RetakeButtonProps) => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleRetake = async () => {
        setLoading(true);
        try {
            // ✅ Delete existing feedback first
            await deleteFeedbackByInterviewId({ interviewId, userId });
            console.log("✅ Feedback deleted, redirecting to interview...");
            // ✅ Redirect to interview page
            router.push(`/interview/${interviewId}`);
        } catch (error) {
            console.error("❌ Error deleting feedback:", error);
            router.push(`/interview/${interviewId}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            className="btn-primary flex-1"
            onClick={handleRetake}
            disabled={loading}
        >
            <p className="text-sm font-semibold text-black text-center">
                {loading ? "Loading..." : "Retake Interview"}
            </p>
        </Button>
    );
};

export default RetakeButton;