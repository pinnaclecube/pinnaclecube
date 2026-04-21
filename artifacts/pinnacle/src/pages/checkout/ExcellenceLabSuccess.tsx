import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, BookOpen, ClipboardList } from "lucide-react";

export default function ExcellenceLabSuccess() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Purchase Successful!</h1>
          <p className="text-muted-foreground mb-2 leading-relaxed">
            Welcome to Excellence Lab. Your access has been activated.
          </p>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Before diving in, complete your <strong>Readiness Intake</strong> so we can tailor your experience and assess your eligibility profile.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard/readiness-intake">
              <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                <ClipboardList className="w-4 h-4 mr-2" /> Complete Readiness Intake
              </Button>
            </Link>
            <Link href="/courses">
              <Button variant="outline">
                <BookOpen className="w-4 h-4 mr-2" /> Start Learning
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
