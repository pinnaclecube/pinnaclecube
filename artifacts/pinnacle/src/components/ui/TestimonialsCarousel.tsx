import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Testimonial {
  initials: string;
  quote: string;
  highlight: string;
  name: string;
  role: string;
  company: string;
  result: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    initials: "SK",
    quote:
      "I had been told by two separate attorneys that I wasn't ready to file. Pinnacle³ spent three months helping me understand exactly what 'ready' actually meant — and then helped me get there.",
    highlight: "EB-1A approved in 14 days.",
    name: "S. Kumar",
    role: "Principal Research Scientist",
    company: "Top-5 Tech Company",
    result: "EB-1A Approved",
  },
  {
    initials: "AR",
    quote:
      "Pinnacle³ didn't just help me file a petition — they helped me understand my own professional value. The strategic rigor was on par with engineering standards at the best companies in the world.",
    highlight: "Approved in 11 days.",
    name: "A. Rahman",
    role: "Staff ML Engineer",
    company: "FAANG Company",
    result: "EB-1A Approved",
  },
  {
    initials: "TC",
    quote:
      "I spent six months collecting documents with no idea whether they were the right ones. Pinnacle³ gave me a framework that turned complete disorganized chaos into a clear, compelling case.",
    highlight: "NIW approved on first submission.",
    name: "T. Chen",
    role: "Senior Product Director",
    company: "Series B Startup",
    result: "EB-2 NIW Approved",
  },
  {
    initials: "PM",
    quote:
      "The Excellence Lab completely changed how I thought about presenting my own work. I went from thinking 'I don't have enough' to realizing 'I have more than I ever thought I did.'",
    highlight: "O-1A approved in 3 weeks.",
    name: "P. Mehta",
    role: "Research Lead",
    company: "National Research Lab",
    result: "O-1A Approved",
  },
  {
    initials: "LH",
    quote:
      "My immigration attorney spent our first meeting telling me how organized my evidence was. She said she had never seen a client arrive that prepared. That preparation came entirely from the Evidence Vault.",
    highlight: "EB-1A approved without an RFE.",
    name: "L. Huang",
    role: "Applied AI Researcher",
    company: "Research Institute → Big Tech",
    result: "EB-1A Approved",
  },
];

interface Props {
  variant?: "full" | "compact";
  intervalMs?: number;
}

export function TestimonialsCarousel({ variant = "full", intervalMs = 6000 }: Props) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (idx: number) => {
      setVisible(false);
      setTimeout(() => {
        setActive(idx);
        setVisible(true);
      }, 250);
    },
    []
  );

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % TESTIMONIALS.length;
        setVisible(false);
        setTimeout(() => setVisible(true), 250);
        return next;
      });
    }, intervalMs);
  }, [intervalMs]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const prev = () => {
    goTo((active - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
    startTimer();
  };

  const next = () => {
    goTo((active + 1) % TESTIMONIALS.length);
    startTimer();
  };

  const t = TESTIMONIALS[active];

  if (variant === "compact") {
    return (
      <div className="space-y-4">
        <div
          className="transition-opacity duration-250"
          style={{ opacity: visible ? 1 : 0 }}
        >
          <div className="text-3xl text-[#F59E0B] mb-3 leading-none font-serif">❝</div>
          <p className="text-xl font-bold text-white leading-snug mb-1">
            {t.quote}
          </p>
          {t.highlight && (
            <p className="text-[#F59E0B] font-bold mt-2">{t.highlight}</p>
          )}
          <p className="text-white/50 text-sm mt-3 font-medium">
            {t.role} · {t.result}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i); startTimer(); }}
              aria-label={`Testimonial ${i + 1}`}
              className={[
                "rounded-full transition-all duration-300",
                i === active
                  ? "w-6 h-1.5 bg-[#F59E0B]"
                  : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60",
              ].join(" ")}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="py-24 md:py-32 bg-[#1E2D6B] relative overflow-hidden">
      <div className="absolute -left-20 top-0 text-[300px] font-black text-white/[0.03] leading-none pointer-events-none select-none">
        ³
      </div>

      <div className="max-w-[1100px] mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            What our clients say
          </h2>
          <p className="text-white/50 text-lg">
            Real professionals. Real approvals.
          </p>
        </div>

        <div className="relative">
          {/* Arrows */}
          <button
            onClick={prev}
            aria-label="Previous"
            className="hidden md:flex absolute -left-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/20 items-center justify-center text-white/60 hover:text-white hover:border-white/50 transition-colors z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            aria-label="Next"
            className="hidden md:flex absolute -right-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/20 items-center justify-center text-white/60 hover:text-white hover:border-white/50 transition-colors z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Slide */}
          <div
            className="text-center transition-opacity duration-250"
            style={{ opacity: visible ? 1 : 0 }}
          >
            <div className="text-5xl text-[#F59E0B] mb-8 leading-none">❝</div>
            <blockquote className="text-2xl md:text-3xl font-bold text-white leading-tight max-w-4xl mx-auto mb-4">
              {t.quote}{" "}
              <span className="text-[#F59E0B]">{t.highlight}</span>
            </blockquote>

            <div className="flex flex-col items-center mt-12">
              <div className="w-14 h-14 bg-white/10 rounded-full mb-4 flex items-center justify-center text-white font-bold text-lg border border-white/20">
                {t.initials}
              </div>
              <div className="text-[#F59E0B] font-bold text-lg tracking-wide">{t.role}</div>
              <div className="text-white/40 font-medium mt-0.5 text-sm">{t.company}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 bg-white/10 text-white/80 text-xs font-bold px-3 py-1 rounded-full border border-white/10">
                ✓ {t.result}
              </div>
            </div>
          </div>

          {/* Dots */}
          <div className="flex items-center justify-center gap-3 mt-12">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => { goTo(i); startTimer(); }}
                aria-label={`Testimonial ${i + 1}`}
                className={[
                  "rounded-full transition-all duration-300",
                  i === active
                    ? "w-8 h-2 bg-[#F59E0B]"
                    : "w-2 h-2 bg-white/30 hover:bg-white/60",
                ].join(" ")}
              />
            ))}
          </div>

          {/* Slide counter */}
          <div className="text-center mt-6 text-white/30 text-xs font-bold tracking-widest uppercase">
            {String(active + 1).padStart(2, "0")} / {String(TESTIMONIALS.length).padStart(2, "0")}
          </div>
        </div>
      </div>
    </section>
  );
}
