import { AppLayout } from "@/components/layout/AppLayout";
import { useListEvidence, useCreateEvidence, useListCriteria } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const evidenceSchema = z.object({
  criterionId: z.coerce.number().min(1, "Please select a criterion"),
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  evidenceType: z.enum(["publication", "citation", "award", "salary", "membership", "media", "judging", "contribution", "letter", "other"]),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  dateAchieved: z.string().optional(),
});

export default function EvidenceVault() {
  const { data: evidenceList, isLoading, refetch } = useListEvidence();
  const { data: criteria } = useListCriteria();
  const createEvidence = useCreateEvidence();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof evidenceSchema>>({
    resolver: zodResolver(evidenceSchema),
    defaultValues: {
      criterionId: 0,
      title: "",
      description: "",
      evidenceType: "publication",
      sourceUrl: "",
      dateAchieved: "",
    }
  });

  const onSubmit = async (values: z.infer<typeof evidenceSchema>) => {
    try {
      await createEvidence.mutateAsync({ data: values });
      toast({ title: "Evidence added successfully" });
      setOpen(false);
      form.reset();
      refetch();
    } catch (e) {
      toast({ title: "Failed to add evidence", variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Evidence Vault</h1>
          <p className="text-muted-foreground mt-2">Secure repository for your professional artifacts, mapped to USCIS criteria.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
              <Plus className="w-4 h-4 mr-2" /> Add Evidence
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Evidence</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="criterionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>USCIS Criterion</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value ? field.value.toString() : ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a criterion" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {criteria?.map(c => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. NeurIPS 2023 Paper" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="evidenceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="publication">Publication</SelectItem>
                            <SelectItem value="citation">Citation</SelectItem>
                            <SelectItem value="award">Award</SelectItem>
                            <SelectItem value="salary">Salary</SelectItem>
                            <SelectItem value="membership">Membership</SelectItem>
                            <SelectItem value="media">Media</SelectItem>
                            <SelectItem value="judging">Judging</SelectItem>
                            <SelectItem value="contribution">Contribution</SelectItem>
                            <SelectItem value="letter">Letter</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateAchieved"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="sourceUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source URL (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description / Abstract</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 flex justify-end">
                  <Button type="submit" className="bg-[#1E2D6B] hover:bg-[#3D4FA8]" disabled={createEvidence.isPending}>
                    {createEvidence.isPending ? "Adding..." : "Add Evidence"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search evidence..." className="pl-9" />
        </div>
        <Button variant="outline" className="shrink-0">
          <Filter className="w-4 h-4 mr-2" /> Filter
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : evidenceList?.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">No evidence uploaded yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Begin by adding artifacts that substantiate your achievements. We recommend starting with your strongest publications or major awards.
            </p>
            <Button onClick={() => setOpen(true)} className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">Add Your First Item</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {evidenceList?.map((evidence) => (
            <Link key={evidence.id} href={`/evidence/${evidence.id}`}>
              <Card className="hover:border-[#1E2D6B]/50 transition-colors cursor-pointer">
                <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg text-foreground">{evidence.title}</h3>
                      <Badge variant="secondary" className={getStatusColor(evidence.status)}>
                        {evidence.status.charAt(0).toUpperCase() + evidence.status.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{evidence.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="capitalize">{evidence.evidenceType}</span>
                      {evidence.dateAchieved && <span>• Achieved: {new Date(evidence.dateAchieved).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">View Details</Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
