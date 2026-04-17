import { AppLayout } from "@/components/layout/AppLayout";
import { useGetReadiness } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export default function WhereYouStand() {
  const { data: readiness, isLoading } = useGetReadiness();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Where You Stand</h1>
        <p className="text-muted-foreground mt-2">Comprehensive readiness evaluation for your {readiness?.visaTarget?.toUpperCase()} application.</p>
      </div>

      <Card className="mb-8 border-[#1E2D6B]/20 bg-blue-50/10">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-48 h-48 rounded-full border-8 border-gray-100 flex items-center justify-center relative shrink-0">
              <div 
                className="absolute inset-0 rounded-full border-8 border-[#1E2D6B]"
                style={{ 
                  clipPath: `polygon(0 0, 100% 0, 100% ${readiness?.overallScore}%, 0 ${readiness?.overallScore}%)`,
                  transform: 'rotate(-90deg)'
                }}
              />
              <div className="text-center relative z-10">
                <div className="text-5xl font-bold text-[#1E2D6B]">{readiness?.overallScore}%</div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">Readiness</div>
              </div>
            </div>
            
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-4">Strategic Recommendation</h2>
              <p className="text-lg text-foreground leading-relaxed mb-6">
                {readiness?.recommendation}
              </p>
              
              <div className="flex items-center gap-4">
                <span className={`px-4 py-2 rounded-md text-sm font-bold ${readiness?.readyToFile ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                  {readiness?.readyToFile ? 'Ready to File' : 'Further Development Required'}
                </span>
                <Link href="/blueprint">
                  <Button variant="outline">View Elite Blueprint</Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold mb-6">Criteria Breakdown</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {readiness?.criteriaScores?.map((score) => (
          <Card key={score.criterionId} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">{score.criterionName}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Evidence Strength</span>
                  <span className="font-medium">{score.score}%</span>
                </div>
                <Progress value={score.score} className="h-2" />
                <p className="text-sm text-muted-foreground mt-3">
                  {score.evidenceCount} / {score.requiredCount} pieces of substantial evidence
                </p>
              </div>
              <Link href={`/criteria/${score.criterionId}`} className="w-full mt-auto">
                <Button variant="outline" className="w-full justify-between group">
                  Review Criterion
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
