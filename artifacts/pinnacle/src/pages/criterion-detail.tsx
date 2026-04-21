import { AppLayout } from "@/components/layout/AppLayout";
import { useGetCriterion } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useParams, Link } from "wouter";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CriterionDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { data: criterion, isLoading } = useGetCriterion(id);

  if (isLoading || !criterion) {
    return (
      <AppLayout>
        <Skeleton className="h-10 w-32 mb-6" />
        <Skeleton className="h-64 w-full" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link href="/criteria" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Criteria
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <p className="text-sm font-mono font-bold text-[#1E2D6B]">{criterion.uscisCode}</p>
          <Badge variant="outline" className="capitalize">{criterion.strengthLevel} Profile</Badge>
        </div>
        <h1 className="text-3xl font-bold text-foreground">{criterion.name}</h1>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>USCIS Definition</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground leading-relaxed">
            {criterion.description}
          </p>
        </CardContent>
      </Card>

      {criterion.tips && (
        <Card className="mb-8 border-[#1E2D6B]/30 bg-blue-50/20">
          <CardHeader>
            <CardTitle className="text-lg text-[#1E2D6B]">Strategic Counsel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">{criterion.tips}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Associated Evidence</h2>
        <div className="text-sm">
          <span className="font-bold">{criterion.evidenceCount}</span> mapped / <span className="text-muted-foreground">{criterion.requiredMinimum} required</span>
        </div>
      </div>

      {criterion.evidence && criterion.evidence.length > 0 ? (
        <div className="space-y-3">
          {criterion.evidence.map(ev => (
             <Card key={ev.id}>
               <CardContent className="p-4 flex justify-between items-center">
                 <div>
                   <h4 className="font-bold">{ev.title}</h4>
                   <p className="text-sm text-muted-foreground">{ev.status}</p>
                 </div>
                 <Link href={`/evidence/${ev.id}`}>
                   <Button variant="ghost" size="sm">View Details</Button>
                 </Link>
               </CardContent>
             </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No evidence has been mapped to this criterion yet.</p>
            <Link href="/evidence">
              <Button variant="outline">Go to Evidence Engine</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}
