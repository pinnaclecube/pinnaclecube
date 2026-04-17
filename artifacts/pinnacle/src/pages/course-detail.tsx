import { AppLayout } from "@/components/layout/AppLayout";
import { useGetCourse, useUpdateCourseProgress } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useParams, Link } from "wouter";
import { ArrowLeft, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

export default function CourseDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { data: course, isLoading, refetch } = useGetCourse(id);
  const updateProgress = useUpdateCourseProgress();
  const { toast } = useToast();

  const handleLessonToggle = async (lessonId: number, currentComplete: boolean) => {
    try {
      await updateProgress.mutateAsync({
        data: { lessonId, completed: !currentComplete }
      });
      refetch();
    } catch (error) {
      toast({ title: "Error updating progress", variant: "destructive" });
    }
  };

  if (isLoading || !course) {
    return (
      <AppLayout>
        <Skeleton className="h-10 w-32 mb-6" />
        <Skeleton className="h-64 w-full mb-8" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link href="/courses" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Excellence Lab
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-bold text-[#1E2D6B] uppercase tracking-wider">{course.category}</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-4">{course.title}</h1>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">{course.description}</p>
      </div>

      <div className="mb-8 bg-gray-50 border border-border rounded-lg p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1 w-full">
          <div className="flex justify-between text-sm font-medium mb-2">
            <span>Overall Progress</span>
            <span>{course.progressPercent}%</span>
          </div>
          <Progress value={course.progressPercent} className="h-3" />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6">Curriculum</h2>
      <div className="space-y-4">
        {course.lessons?.map((lesson, idx) => (
          <Card key={lesson.id} className={lesson.completed ? 'bg-gray-50' : ''}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  <Checkbox 
                    checked={lesson.completed}
                    onCheckedChange={() => handleLessonToggle(lesson.id, lesson.completed)}
                    className="w-6 h-6 rounded-full"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-bold text-muted-foreground">Module {idx + 1}</span>
                    <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md flex items-center">
                      <PlayCircle className="w-3 h-3 mr-1" /> {lesson.estimatedMinutes} min
                    </span>
                  </div>
                  <h3 className={`text-xl font-bold mb-3 ${lesson.completed ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {lesson.title}
                  </h3>
                  <div className="text-muted-foreground prose prose-sm max-w-none">
                    {lesson.content}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
