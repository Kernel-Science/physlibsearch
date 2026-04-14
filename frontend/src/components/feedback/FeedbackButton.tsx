"use client";

import { useState } from "react";
import {
  Button,
  Modal,
  Label,
  Description,
  TextArea,
  RadioGroup,
  Radio,
  Spinner,
} from "@heroui/react";
import { MessageCircle, Star, Send } from "lucide-react";

interface FeedbackButtonProps {
  tabName: string;
  className?: string;
}

const FEEDBACK_TYPES = [
  { value: "general", label: "General Feedback" },
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "improvement", label: "Improvement Suggestion" },
];

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

export function FeedbackButton({ tabName, className = "" }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedbackType, setFeedbackType] = useState("general");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setRating(0);
    setHoveredRating(0);
    setFeedbackType("general");
    setMessage("");
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleSubmit = async () => {
    if (!message.trim() || rating === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/user-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab_name: tabName,
          rating,
          feedback_type: feedbackType,
          message: message.trim(),
        }),
      });
      if (res.ok) {
        resetForm();
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRating = hoveredRating || rating;

  return (
    <div className={`fixed bottom-6 right-6 z-40 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onPress={() => setIsOpen(true)}
        className="backdrop-blur-md shadow-lg gap-1.5"
      >
        <MessageCircle className="size-4" />
        Feedback
      </Button>

      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />

            <Modal.Header>
              <Modal.Icon>
                <MessageCircle className="size-5" />
              </Modal.Icon>
              <Modal.Heading>Share Your Feedback</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-5">
              {/* Star Rating */}
              <div className="flex flex-col gap-2">
                <Label>How would you rate your experience?</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="p-0.5 rounded transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => setRating(star)}
                      aria-label={`Rate ${star} out of 5`}
                    >
                      <Star
                        className={`size-6 transition-colors ${
                          star <= activeRating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-foreground/30 hover:text-yellow-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {activeRating > 0 && (
                  <Description className="text-xs">{RATING_LABELS[activeRating]}</Description>
                )}
              </div>

              {/* Feedback Type */}
              <RadioGroup
                value={feedbackType}
                onChange={(v) => setFeedbackType(v as string)}
                name="feedback-type"
              >
                <Label>What type of feedback is this?</Label>
                <div className="flex flex-col gap-2 mt-1">
                  {FEEDBACK_TYPES.map(({ value, label }) => (
                    <Radio key={value} value={value}>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      <Radio.Content>
                        <Label>{label}</Label>
                      </Radio.Content>
                    </Radio>
                  ))}
                </div>
              </RadioGroup>

              {/* Message */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="feedback-message">Your Feedback</Label>
                <TextArea
                  id="feedback-message"
                  aria-label="Your feedback message"
                  placeholder="Tell us about your experience..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full resize-none"
                />
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
              <Button
                onPress={handleSubmit}
                isDisabled={!message.trim() || rating === 0 || isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="size-4" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
