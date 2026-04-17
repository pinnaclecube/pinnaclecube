import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function ExcellenceLabCancel() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Purchase Cancelled</h1>
          <p className="text-muted-foreground mb-8">
            No worries — your payment was not processed. You can try again whenever you're ready.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/excellence-lab/checkout">
              <Button className="bg-[#1E2D6B] hover:bg-[#3D4FA8]">Try Again</Button>
            </Link>
            <Link href="/excellence-lab">
              <Button variant="outline">Learn More</Button>
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
