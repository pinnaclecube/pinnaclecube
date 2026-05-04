import { Link } from "wouter";
import { Logo } from "@/components/ui/logo";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CheckCircle, Mail, ArrowRight } from "lucide-react";

export default function PaymentSuccess() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg text-center">
          <div className="mb-8 flex justify-center">
            <Logo href="/" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
            <div className="flex justify-center mb-6">
              <div className="w-18 h-18 rounded-full bg-green-100 flex items-center justify-center p-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>

            <h1 className="text-2xl font-extrabold text-[#0A1128] mb-3">
              Payment confirmed!
            </h1>
            <p className="text-slate-600 leading-relaxed mb-8">
              Thank you for joining Pinnacle³. Your account is being set up — this only takes a moment.
            </p>

            <div className="bg-[#f0f4ff] border border-[#c7d2fe] rounded-xl p-5 mb-8 text-left">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#1E2D6B] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#1E2D6B] text-sm mb-1">Check your email</p>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    We're sending your login credentials to the email you used at checkout.
                    You'll receive a temporary password — use it to sign in and set a permanent one.
                  </p>
                </div>
              </div>
            </div>

            <Link href="/login">
              <button className="w-full bg-[#1E2D6B] hover:bg-[#0F1F4A] text-white h-12 rounded-lg font-bold text-base transition-colors flex items-center justify-center gap-2">
                Go to Sign In <ArrowRight className="w-4 h-4" />
              </button>
            </Link>

            <p className="text-xs text-slate-400 mt-6 leading-relaxed">
              Didn't receive an email within a few minutes? Check your spam folder or{" "}
              <a href="mailto:support@pinnaclecube.com" className="text-[#1E2D6B] hover:underline">
                contact support
              </a>
              .
            </p>
          </div>

          <p className="text-xs text-slate-400 mt-8 leading-relaxed">
            Pinnacle³ is an advisory coaching service, not a law firm. Nothing on this platform constitutes legal advice.
          </p>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
