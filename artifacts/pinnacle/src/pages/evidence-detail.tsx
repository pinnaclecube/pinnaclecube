import { AppLayout } from "@/components/layout/AppLayout";
import { useGetEvidence, useDeleteEvidence } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, ExternalLink, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function EvidenceDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { data: evidence, isLoading } = useGetEvidence(id);
  const deleteEvidence = useDeleteEvidence();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this evidence?")) {
      try {
        await deleteEvidence.mutateAsync({ id });
        toast({ title: "Evidence deleted" });
        setLocation("/evidence");
      } catch (e) {
        toast({ title: "Error deleting evidence", variant: "destructive" });
      }
    }
  };

  if (isLoading || !evidence) {
    return (
      <AppLayout>
        <Skeleton className="h-10 w-32 mb-6" />
        <Skeleton className="h-64 w-full" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link href="/evidence" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Vault
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="capitalize">{evidence.evidenceType}</Badge>
            <Badge variant="secondary" className="capitalize">{evidence.status}</Badge>
          </div>
          <h1 className="text-3xl font-bold text-foreground">{evidence.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Artifact Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
            <p className="text-foreground whitespace-pre-wrap">{evidence.description || "No description provided."}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Date Achieved</h3>
              <p className="font-medium">{evidence.dateAchieved ? new Date(evidence.dateAchieved).toLocaleDateString() : "Not specified"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Source URL</h3>
              {evidence.sourceUrl ? (
                <a href={evidence.sourceUrl} target="_blank" rel="noreferrer" className="text-[#1E2D6B] hover:underline flex items-center">
                  View Source <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              ) : (
                <p className="text-foreground">Not provided</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
