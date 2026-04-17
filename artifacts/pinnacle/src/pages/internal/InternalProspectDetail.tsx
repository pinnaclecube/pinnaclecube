import { Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function InternalProspectDetail() {
  const { id } = useParams() as { id: string };
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1E2D6B] text-white px-8 py-4">
        <Link href="/internal/prospects" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> All Prospects
        </Link>
      </header>
      <main className="px-8 py-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Prospect #{id}</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Prospect detail view — full implementation coming soon.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
