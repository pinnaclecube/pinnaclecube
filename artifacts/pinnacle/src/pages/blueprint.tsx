import { AppLayout } from "@/components/layout/AppLayout";
import { useGetBlueprint, useListMilestones, useUpdateMilestone } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AIOutputBanner } from "@/components/disclaimers/AIOutputBanner";
import { useToast } from "@/hooks/use-toast";

export default function EliteBlueprint() {
  const { data: blueprint, isLoading: loadingBlueprint } = useGetBlueprint();
  const { data: milestones, isLoading: loadingMilestones, refetch: refetchMilestones } = useListMilestones();
  const updateMilestone = useUpdateMilestone();
  const { toast } = useToast();

  const handleToggleComplete = async (id: number, currentStatus: boolean) => {
    try {
      await updateMilestone.mutateAsync({
        id,
        data: { completed: !currentStatus }
      });
      refetchMilestones();
      toast({
        title: "Milestone updated",
        description: "Your progress has been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update milestone.",
        variant: "destructive",
      });
    }
  };

  if (loadingBlueprint || loadingMilestones) {
    return (
      <AppLayout>
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-48 w-full mb-8" />
        <Skeleton className="h-64 w-full" />
      </AppLayout>
    );
  }

  if (!blueprint) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-4">No Active Blueprint</h2>
          <p className="text-muted-foreground">You have not yet been assigned an Elite Blueprint.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Elite Blueprint</h1>
        <p className="text-muted-foreground mt-2">Your strategic roadmap to {blueprint.visaTarget.toUpperCase()} approval.</p>
      </div>

      <AIOutputBanner variant="analysis" />

      <Card className="mb-8 border-[#1E2D6B]/20">
        <CardHeader className="bg-[#1E2D6B]/5 border-b border-[#1E2D6B]/10 pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl text-[#1E2D6B]">Strategy Summary</CardTitle>
            <span className="text-sm font-medium px-3 py-1 bg-blue-100 text-blue-800 rounded-full capitalize">
              Status: {blueprint.status.replace('_', ' ')}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-foreground leading-relaxed whitespace-pre-wrap">
            {blueprint.strategySummary}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 pt-6 border-t border-border">
            <div>
              <p className="text-sm text-muted-foreground">Target Filing Date</p>
              <p className="font-medium">{blueprint.targetFilingDate ? new Date(blueprint.targetFilingDate).toLocaleDateString() : 'TBD'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assigned Consultant</p>
              <p className="font-medium">{blueprint.assignedConsultant || 'Pending Assignment'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold mb-6">Action Plan Milestones</h2>
      <div className="space-y-4">
        {milestones?.map((milestone) => (
          <Card key={milestone.id} className={milestone.completed ? 'opacity-60 bg-gray-50' : ''}>
            <CardContent className="p-5 flex gap-4">
              <Checkbox 
                checked={milestone.completed} 
                onCheckedChange={() => handleToggleComplete(milestone.id, milestone.completed)}
                className="mt-1 w-5 h-5"
              />
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${milestone.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {milestone.title}
                </h3>
                {milestone.description && (
                  <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                )}
                {milestone.dueDate && (
                  <p className="text-xs font-medium text-[#1E2D6B] mt-3">
                    Due: {new Date(milestone.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
