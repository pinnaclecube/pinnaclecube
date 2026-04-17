import { AppLayout } from "@/components/layout/AppLayout";
import { useListCriteria } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CriteriaExhibit() {
  const { data: criteria, isLoading } = useListCriteria();

  const getStrengthColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'strong': return 'bg-green-100 text-green-800 border-green-200';
      case 'developing': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'weak': return 'bg-red-100 text-red-800 border-red-200';
      case 'none': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Criteria Exhibit</h1>
        <p className="text-muted-foreground mt-2">USCIS eligibility categories mapped to your professional profile.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {criteria?.map((criterion) => (
            <Card key={criterion.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="text-xs font-mono text-muted-foreground mb-1">{criterion.uscisCode}</p>
                    <CardTitle className="text-lg leading-tight">{criterion.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className={`shrink-0 capitalize ${getStrengthColor(criterion.strengthLevel)}`}>
                    {criterion.strengthLevel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {criterion.description}
                  </p>
                  <div className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-md border border-border">
                    <span className="font-medium">Evidence Count</span>
                    <span className="font-bold">{criterion.evidenceCount} / {criterion.requiredMinimum} required</span>
                  </div>
                </div>
                <Link href={`/criteria/${criterion.id}`} className="w-full mt-auto">
                  <Button variant="outline" className="w-full justify-between group">
                    Examine Criterion
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
