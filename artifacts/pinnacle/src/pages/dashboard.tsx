import { AppLayout } from "@/components/layout/AppLayout";
import { useGetDashboardSummary, useGetProfile } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AIBanner } from "@/components/shared/AIBanner";
import { AlertCircle, FileText, CheckCircle2, BookOpen, Target } from "lucide-react";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: profile, isLoading: loadingProfile } = useGetProfile();

  if (loadingSummary || loadingProfile) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Welcome back, {profile?.name?.split(' ')[0]}</h1>
        <p className="text-muted-foreground mt-2">Here is the current status of your {summary?.visaTarget?.toUpperCase()} application profile.</p>
      </div>

      <AIBanner />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Readiness Score
              <Target className="w-4 h-4 text-[#1E2D6B]" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-foreground">{summary?.readinessScore}%</div>
            <Progress value={summary?.readinessScore} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Evidence Vault
              <FileText className="w-4 h-4 text-[#1E2D6B]" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-foreground">{summary?.totalEvidence} Items</div>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">{summary?.approvedEvidence} Approved</span>
              <span className="text-amber-600 font-medium">{summary?.pendingEvidence} Pending</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Criteria Strength
              <AlertCircle className="w-4 h-4 text-[#1E2D6B]" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-foreground">{summary?.criteriaStrong} Strong</div>
            <div className="flex gap-4 text-sm">
              <span className="text-blue-600 font-medium">{summary?.criteriaDeveloping} Developing</span>
              <span className="text-gray-500 font-medium">{summary?.criteriaWeak} Weak</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#1E2D6B]" />
              Excellence Lab
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-foreground">Enrolled Courses</p>
                <p className="text-sm text-muted-foreground">{summary?.coursesEnrolled} active</p>
              </div>
              <div className="text-2xl font-bold text-[#1E2D6B]">{summary?.coursesCompleted}</div>
            </div>
            <p className="text-sm text-muted-foreground">Continue your learning to strengthen developing criteria.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#1E2D6B]" />
              Elite Blueprint
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.hasBlueprint ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium text-foreground">Milestones</p>
                    <p className="text-sm text-muted-foreground">{summary.milestonesCompleted} of {summary.milestonesTotal} completed</p>
                  </div>
                </div>
                <Progress value={(summary.milestonesCompleted / (summary.milestonesTotal || 1)) * 100} className="h-2" />
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">You have not yet activated an Elite Blueprint.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
