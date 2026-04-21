import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AIOutputBanner } from "@/components/disclaimers/AIOutputBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  ChevronRight,
  ClipboardList,
  Lightbulb,
  Map,
  Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface StrongArea {
  criterion: string;
  description: string;
  strength: "strong" | "moderate";
}

interface RecommendedArea {
  criterion: string;
  gap: string;
  action: string;
  priority: "high" | "medium" | "low";
}

interface RoadmapPhase {
  phase: number;
  title: string;
  duration: string;
  focus: string;
  actions: string[];
}

interface Analysis {
  sufficientData: boolean;
  reason?: string;
  visaLabel?: string;
  overallReadiness?: "strong" | "moderate" | "developing";
  summary?: string;
  strongAreas?: StrongArea[];
  recommendedAreas?: RecommendedArea[];
  roadmap?: RoadmapPhase[];
}

const READINESS_CONFIG = {
  strong: { label: "Strong Profile", color: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
  moderate: { label: "Developing Profile", color: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  developing: { label: "Early Stage", color: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-400" },
};

const PRIORITY_CONFIG = {
  high: { label: "High Priority", color: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { label: "Low", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function WhereYouStand() {
  const { token } = useAuth();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/intake/analysis", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load analysis");
        }
        const data = await res.json();
        setAnalysis(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analysis");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [token]);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Where You Stand</h1>
        <p className="text-muted-foreground mt-2">
          AI-powered readiness analysis based on your intake profile.
        </p>
      </div>

      <AIOutputBanner variant="analysis" />

      {loading && <AnalysisSkeleton />}

      {!loading && error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && analysis && !analysis.sufficientData && (
        <InsufficientDataBanner reason={analysis.reason} />
      )}

      {!loading && !error && analysis?.sufficientData && (
        <FullAnalysis analysis={analysis} />
      )}
    </AppLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InsufficientDataBanner({ reason }: { reason?: string }) {
  return (
    <div className="space-y-6">
      <Card className="border-[#1E2D6B]/20 bg-blue-50/30">
        <CardContent className="pt-8 pb-8">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-14 h-14 rounded-full bg-[#1E2D6B]/10 flex items-center justify-center mx-auto mb-4">
              <Info className="w-7 h-7 text-[#1E2D6B]" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-3">Not Enough Data Yet</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              {reason ?? "Complete your readiness intake so we can generate a personalized AI analysis of your strengths and roadmap."}
            </p>
            <Link href="/dashboard/readiness-intake">
              <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                Complete Your Intake <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FullAnalysis({ analysis }: { analysis: Analysis }) {
  const readinessKey = analysis.overallReadiness ?? "developing";
  const rc = READINESS_CONFIG[readinessKey];

  return (
    <div className="space-y-8">
      {/* Hero summary card */}
      <Card className="border-[#1E2D6B]/20 bg-gradient-to-br from-[#1E2D6B]/5 to-white">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold border ${rc.color}`}>
                  <span className={`w-2 h-2 rounded-full ${rc.dot}`} />
                  {rc.label}
                </span>
                {analysis.visaLabel && (
                  <span className="text-sm text-muted-foreground font-medium">{analysis.visaLabel}</span>
                )}
              </div>
              <p className="text-foreground leading-relaxed text-base">{analysis.summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strong areas */}
      {analysis.strongAreas && analysis.strongAreas.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-700" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Your Strong Areas</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.strongAreas.map((area, i) => (
              <Card key={i} className="border-green-200 bg-green-50/30">
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-foreground">{area.criterion}</CardTitle>
                    <Badge
                      variant="outline"
                      className={area.strength === "strong"
                        ? "bg-green-100 text-green-800 border-green-200 shrink-0"
                        : "bg-amber-100 text-amber-800 border-amber-200 shrink-0"}
                    >
                      {area.strength === "strong" ? "Strong" : "Moderate"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{area.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Recommended areas */}
      {analysis.recommendedAreas && analysis.recommendedAreas.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-amber-700" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Recommended Focus Areas</h2>
          </div>
          <div className="space-y-3">
            {analysis.recommendedAreas.map((area, i) => {
              const pc = PRIORITY_CONFIG[area.priority];
              return (
                <Card key={i} className="border-border">
                  <CardContent className="pt-4 pb-4 px-5">
                    <div className="flex items-start gap-4">
                      <div className="w-7 h-7 rounded-full bg-[#1E2D6B]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-[#1E2D6B]">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-foreground">{area.criterion}</span>
                          <Badge variant="outline" className={`text-xs ${pc.color}`}>
                            {pc.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{area.gap}</p>
                        <div className="flex items-start gap-2 bg-[#1E2D6B]/5 rounded-md px-3 py-2">
                          <ArrowRight className="w-3.5 h-3.5 text-[#1E2D6B] mt-0.5 shrink-0" />
                          <p className="text-sm text-[#1E2D6B] font-medium">{area.action}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Visual roadmap */}
      {analysis.roadmap && analysis.roadmap.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#1E2D6B]/10 flex items-center justify-center">
              <Map className="w-4 h-4 text-[#1E2D6B]" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Your Roadmap to Filing</h2>
          </div>
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-7 top-10 bottom-10 w-0.5 bg-gradient-to-b from-[#1E2D6B]/30 to-[#1E2D6B]/5 hidden md:block" />
            <div className="space-y-4">
              {analysis.roadmap.map((phase, i) => (
                <div key={phase.phase} className="relative flex gap-4">
                  {/* Phase bubble */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 z-10 shadow-sm ${
                    i === 0 ? "bg-[#1E2D6B] text-white"
                    : i === analysis.roadmap!.length - 1 ? "bg-green-600 text-white"
                    : "bg-white border-2 border-[#1E2D6B]/30 text-[#1E2D6B]"
                  }`}>
                    <span className="text-lg font-bold">{phase.phase}</span>
                  </div>
                  {/* Phase content */}
                  <Card className="flex-1">
                    <CardContent className="pt-4 pb-4 px-5">
                      <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-foreground">{phase.title}</h3>
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                          {phase.duration}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{phase.focus}</p>
                      <ul className="space-y-1.5">
                        {phase.actions.map((action, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <TrendingUp className="w-3.5 h-3.5 text-[#1E2D6B] mt-0.5 shrink-0" />
                            <span className="text-foreground">{action}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <Card className="border-[#1E2D6B]/20 bg-[#1E2D6B]/5">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-[#1E2D6B]" />
              <div>
                <p className="font-semibold text-foreground">Ready to start building your case?</p>
                <p className="text-sm text-muted-foreground">Upload evidence, track criteria, and get AI-powered gap analysis.</p>
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link href="/evidence-vault/checkout">
                <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                  Get Evidence Engine <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <Link href="/elite-blueprint">
                <Button variant="outline">Learn about Elite Blueprint</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pb-4">
        This analysis is AI-generated for advisory purposes only and does not constitute legal advice. Results are based on self-reported intake data and are not a guarantee of visa eligibility.
      </p>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
