import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CheckCircle2, Clock, Mail } from "lucide-react";

export default function EliteBlueprintSubmitted() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-4">Application Submitted</h1>
          <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
            Thank you for applying to the Elite Blueprint program. Our team will review your application and reach out within 48 hours.
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-4 text-left bg-gray-50 rounded-lg p-4 border border-border">
              <div className="w-10 h-10 rounded-lg bg-[#1E2D6B]/10 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-[#1E2D6B]" />
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">Check your email</p>
                <p className="text-xs text-muted-foreground mt-0.5">We'll send a confirmation and next steps to the address you provided.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-left bg-gray-50 rounded-lg p-4 border border-border">
              <div className="w-10 h-10 rounded-lg bg-[#1E2D6B]/10 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-[#1E2D6B]" />
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">48-hour review</p>
                <p className="text-xs text-muted-foreground mt-0.5">Our team personally reviews every application. You'll hear from us within 2 business days.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">
                Create Your Free Account
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground mt-8">
            Pinnacle³ is an advisory coaching service, not a law firm. This is not legal advice.
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
