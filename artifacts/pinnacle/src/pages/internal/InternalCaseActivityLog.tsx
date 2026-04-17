import { Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function InternalCaseActivityLog() {
  const { user_id } = useParams() as { user_id: string };
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1E2D6B] text-white px-8 py-4">
        <Link href={`/internal/case/${user_id}`} className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Case
        </Link>
      </header>
      <main className="px-8 py-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Activity Log</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Activity log for client #{user_id} — full implementation coming soon.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
