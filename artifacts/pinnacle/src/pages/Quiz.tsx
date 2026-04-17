import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { LegalFooterBar } from "@/components/disclaimers/LegalFooterBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronRight } from "lucide-react";

const QUESTIONS = [
  {
    id: "publications",
    question: "Have you authored peer-reviewed publications?",
    options: ["Yes — 5 or more", "Yes — 1 to 4", "No, but I've written technical content", "No publications"],
  },
  {
    id: "awards",
    question: "Have you received nationally or internationally recognized awards?",
    options: ["Yes — national/international", "Yes — regional or institutional", "No formal awards", "Not sure"],
  },
  {
    id: "judging",
    question: "Have you served as a reviewer, judge, or committee member in your field?",
    options: ["Yes — multiple times", "Yes — once or twice", "No, but I've been invited", "No"],
  },
  {
    id: "media",
    question: "Has your work been covered in major media outlets or trade publications?",
    options: ["Yes — multiple outlets", "Yes — once or twice", "Only within my organization", "No media coverage"],
  },
  {
    id: "role",
    question: "Do you hold or have you held a leadership/critical role at a distinguished organization?",
    options: ["Yes — senior leadership", "Yes — lead on major project", "Mid-level with significant ownership", "No leadership role"],
  },
  {
    id: "salary",
    question: "Is your compensation significantly above the median in your field?",
    options: ["Yes, top 10%", "Yes, above average", "Around median", "Below median"],
  },
];

function computeScore(answers: Record<string, number>): { score: number; recommendation: string; visaPath: string } {
  const total = Object.values(answers).reduce((sum, v) => sum + (3 - v), 0);
  const maxPossible = QUESTIONS.length * 3;
  const pct = Math.round((total / maxPossible) * 100);

  if (pct >= 70) {
    return {
      score: pct,
      recommendation: "Your profile shows strong potential for EB-1A (Extraordinary Ability). You have multiple qualifying criteria with solid evidence.",
      visaPath: "eb1a",
    };
  } else if (pct >= 45) {
    return {
      score: pct,
      recommendation: "Your profile is a strong candidate for EB-2 NIW (National Interest Waiver). Your contributions appear nationally significant.",
      visaPath: "eb2niw",
    };
  } else {
    return {
      score: pct,
      recommendation: "Your profile needs further development before a strong petition is possible. The Excellence Lab can help you strengthen your credentials.",
      visaPath: "eb2niw",
    };
  }
}

export default function Quiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; recommendation: string; visaPath: string } | null>(null);

  const question = QUESTIONS[step];
  const progress = (step / QUESTIONS.length) * 100;

  const handleAnswer = (idx: number) => {
    const newAnswers = { ...answers, [question.id]: idx };
    setAnswers(newAnswers);
    if (step < QUESTIONS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setResult(computeScore(newAnswers));
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-2xl">
          {!submitted ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Visa Readiness Quiz</h1>
                <p className="text-muted-foreground">6 quick questions to assess your EB-1A / NIW potential</p>
              </div>
              <div className="mb-6">
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>Question {step + 1} of {QUESTIONS.length}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
              <Card>
                <CardContent className="pt-8 pb-6">
                  <h2 className="text-xl font-semibold text-foreground mb-6">{question.question}</h2>
                  <div className="space-y-3">
                    {question.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleAnswer(i)}
                        className="w-full text-left px-5 py-4 rounded-lg border border-border hover:border-[#1E2D6B] hover:bg-[#1E2D6B]/5 transition-all text-foreground font-medium"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Your Readiness Assessment</h1>
                <p className="text-muted-foreground">Based on your answers</p>
              </div>
              <Card className="mb-8">
                <CardContent className="pt-8 pb-6">
                  <div className="w-32 h-32 rounded-full border-8 border-gray-100 flex items-center justify-center mx-auto mb-6 relative">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-[#1E2D6B]">{result?.score}%</div>
                      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Readiness</div>
                    </div>
                  </div>
                  <p className="text-lg text-foreground leading-relaxed mb-6">{result?.recommendation}</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/register">
                      <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                        Create Free Account <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                    <Link href="/instant-profile-insight/start">
                      <Button variant="outline">Get Detailed AI Analysis</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                This quiz is for general guidance only and does not constitute legal advice. Results are AI-generated estimates based on limited information.
              </p>
            </div>
          )}
        </div>
      </main>
      <LegalFooterBar />
    </div>
  );
}
