import { AppLayout } from "@/components/layout/AppLayout";
import { useListCourses } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Clock, BookOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Courses() {
  const { data: courses, isLoading } = useListCourses();

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Excellence Lab</h1>
        <p className="text-muted-foreground mt-2">Advanced tactical training for building an undeniable profile.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses?.map((course) => (
            <Card key={course.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-[#1E2D6B] uppercase tracking-wider">{course.category}</span>
                  <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded text-muted-foreground uppercase">{course.visaType}</span>
                </div>
                <CardTitle className="text-xl leading-tight">{course.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground mb-6 line-clamp-3">
                  {course.description}
                </p>
                <div className="flex items-center gap-6 text-sm text-muted-foreground mb-6">
                  <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {course.lessonCount} Lessons</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {Math.round(course.estimatedMinutes / 60)} Hours</span>
                </div>
                
                {course.progressPercent > 0 && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">Progress</span>
                      <span>{course.progressPercent}%</span>
                    </div>
                    <Progress value={course.progressPercent} className="h-1.5" />
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Link href={`/courses/${course.id}`} className="w-full">
                  <Button className="w-full bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                    {course.progressPercent > 0 ? "Continue Learning" : "Start Course"}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
