import { useState } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ExternalLink, BookOpen, Clock, ChevronRight } from "lucide-react";

type Category = "All" | "EB-1A" | "O-1A" | "EB-2 NIW" | "Strategy";

interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: Exclude<Category, "All">;
  source: string;
  sourceType: "official" | "legal" | "strategy" | "guide";
  readTime: string;
  url: string;
  featured?: boolean;
  tags?: string[];
}

const ARTICLES: Article[] = [
  {
    id: "eb1a-uscis-official",
    title: "EB-1A: Employment-Based First Preference — Official USCIS Guide",
    excerpt:
      "The definitive source on EB-1A eligibility. Covers the legal standard for 'extraordinary ability,' the 10 evidentiary criteria, and how to satisfy them. Directly from the adjudicators who decide your case.",
    category: "EB-1A",
    source: "USCIS.gov",
    sourceType: "official",
    readTime: "15 min",
    url: "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-first-preference-eb-1",
    featured: true,
    tags: ["Must Read", "Official"],
  },
  {
    id: "eb1a-policy-manual",
    title: "USCIS Policy Manual: Extraordinary Ability — The Legal Standard Explained",
    excerpt:
      "The USCIS Policy Manual is the internal guidance document adjudicators use when evaluating petitions. This chapter explains precisely what 'sustained national or international acclaim' means and how officers weigh evidence.",
    category: "EB-1A",
    source: "USCIS Policy Manual",
    sourceType: "official",
    readTime: "25 min",
    url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2",
    tags: ["Official", "Deep Dive"],
  },
  {
    id: "eb1a-nolo-guide",
    title: "Green Card Based on Extraordinary Ability (EB-1A) — Plain-Language Guide",
    excerpt:
      "Nolo's comprehensive breakdown of EB-1A requirements, process, and common pitfalls. Written in plain English for professionals who want to understand the system without a law degree.",
    category: "EB-1A",
    source: "Nolo",
    sourceType: "legal",
    readTime: "12 min",
    url: "https://www.nolo.com/legal-encyclopedia/green-card-extraordinary-ability-eb-1a.html",
    tags: ["Beginner Friendly"],
  },
  {
    id: "eb1a-boundless-guide",
    title: "EB-1A Visa: Everything You Need to Know in 2025",
    excerpt:
      "Boundless covers the full EB-1A picture — who qualifies, how to apply, processing times, common denial reasons, and how to strengthen a borderline case. One of the most thorough free guides available.",
    category: "EB-1A",
    source: "Boundless",
    sourceType: "guide",
    readTime: "18 min",
    url: "https://www.boundless.com/immigration-resources/eb-1a-visa/",
    tags: ["Comprehensive"],
  },
  {
    id: "eb1a-criteria-guide",
    title: "The 10 EB-1A Criteria: How Each One Is Actually Evaluated",
    excerpt:
      "A practitioner-level breakdown of every EB-1A criterion — what evidence satisfies it, how officers weigh it, and which combinations of criteria produce the strongest cases. Includes real examples from approved petitions.",
    category: "EB-1A",
    source: "Murthy Law Firm",
    sourceType: "legal",
    readTime: "20 min",
    url: "https://murthy.com/immigration-info/green-cards/eb1a-extraordinary-ability/",
    tags: ["Practical", "Evidence Strategy"],
  },
  {
    id: "eb1a-tech-professionals",
    title: "EB-1A for Software Engineers and ML Researchers: What Actually Qualifies",
    excerpt:
      "Tech professionals face unique challenges framing their work within USCIS criteria designed for traditional 'talent' fields. This guide breaks down how publications, open-source contributions, and technical leadership map to the 10 criteria.",
    category: "EB-1A",
    source: "ILW.com",
    sourceType: "strategy",
    readTime: "14 min",
    url: "https://www.ilw.com/articles/2024/0101-eb1a-tech.shtm",
    tags: ["Tech Professionals", "Strategy"],
  },
  {
    id: "o1a-uscis-official",
    title: "O-1A Visa: Individuals with Extraordinary Ability — Official USCIS Guide",
    excerpt:
      "The official USCIS overview of the O-1A classification, eligibility criteria, petition requirements, and how it compares to the EB-1A green card. Essential reading before deciding which path to pursue.",
    category: "O-1A",
    source: "USCIS.gov",
    sourceType: "official",
    readTime: "10 min",
    url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement",
    featured: false,
    tags: ["Must Read", "Official"],
  },
  {
    id: "o1a-nolo-guide",
    title: "O-1 Visa for Extraordinary Ability: Requirements and Process",
    excerpt:
      "Nolo's clear, practical breakdown of O-1A requirements — who qualifies, what evidence you need, how the petition process works, and what to expect at the consulate. Includes side-by-side comparison with EB-1A.",
    category: "O-1A",
    source: "Nolo",
    sourceType: "legal",
    readTime: "12 min",
    url: "https://www.nolo.com/legal-encyclopedia/o-1-visa-extraordinary-ability.html",
    tags: ["Beginner Friendly"],
  },
  {
    id: "o1a-vs-eb1a",
    title: "O-1A vs. EB-1A: How to Choose Your Visa Strategy",
    excerpt:
      "Many professionals qualify for both. This comparative analysis breaks down processing times, employer sponsorship requirements, renewal limitations, and strategic sequencing — so you can make an informed decision about which path to pursue first.",
    category: "O-1A",
    source: "Boundless",
    sourceType: "guide",
    readTime: "15 min",
    url: "https://www.boundless.com/immigration-resources/o-1-visa/",
    tags: ["Strategy", "Comparison"],
  },
  {
    id: "o1a-criteria-evidence",
    title: "O-1A Evidence Checklist: What USCIS Actually Wants to See",
    excerpt:
      "A practitioner-level guide to building O-1A evidence that survives RFE scrutiny. Covers all eight evidentiary categories, how to document them properly, and the difference between evidence that's 'good enough' and evidence that's compelling.",
    category: "O-1A",
    source: "Fragomen",
    sourceType: "strategy",
    readTime: "16 min",
    url: "https://www.fragomen.com/insights/o-1a-visa-guide.html",
    tags: ["Evidence Strategy", "Practical"],
  },
  {
    id: "niw-uscis-official",
    title: "EB-2 National Interest Waiver — Official USCIS Guide",
    excerpt:
      "The official USCIS page on EB-2 NIW petitions, covering the three-prong Dhanasar test, who qualifies for a self-petition, and the evidence required to satisfy 'national interest.' The authoritative starting point.",
    category: "EB-2 NIW",
    source: "USCIS.gov",
    sourceType: "official",
    readTime: "12 min",
    url: "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-second-preference-eb-2",
    tags: ["Must Read", "Official"],
  },
  {
    id: "niw-dhanasar-framework",
    title: "The Dhanasar Framework: Understanding All Three NIW Prongs",
    excerpt:
      "The 2016 Dhanasar decision completely reshaped how USCIS evaluates NIW petitions. This expert analysis walks through each prong — substantial merit, national importance, and why you should waive the job offer requirement — with real case examples.",
    category: "EB-2 NIW",
    source: "Nolo",
    sourceType: "legal",
    readTime: "18 min",
    url: "https://www.nolo.com/legal-encyclopedia/national-interest-waiver-eb-2-niw.html",
    tags: ["Deep Dive", "Legal Analysis"],
  },
  {
    id: "strategy-rfe-response",
    title: "What to Do When You Receive an EB-1A RFE: A Strategic Guide",
    excerpt:
      "An RFE is not a denial — but how you respond to it largely determines the outcome. This guide covers the most common RFE types for EB-1A petitions, the evidence USCIS is signaling they need, and how to structure a compelling response.",
    category: "Strategy",
    source: "AILA",
    sourceType: "strategy",
    readTime: "20 min",
    url: "https://www.aila.org/library/rfe-response-eb-1a",
    tags: ["RFE", "Advanced"],
  },
  {
    id: "strategy-building-evidence",
    title: "How to Build an Extraordinary Ability Case Before You Have a Lawyer",
    excerpt:
      "The evidence gathering phase is where most petitions are won or lost — yet most professionals don't start until they've already hired an attorney. This strategic guide explains what to build now, how to document it, and how to position it for maximum impact.",
    category: "Strategy",
    source: "Shusterman Law",
    sourceType: "strategy",
    readTime: "17 min",
    url: "https://shusterman.com/extraordinary-ability-visa-eb1a/",
    tags: ["Strategy", "Must Read"],
  },
  {
    id: "strategy-media-coverage",
    title: "How to Generate Legitimate Media Coverage for Your Immigration Petition",
    excerpt:
      "Published media about you is one of the most impactful EB-1A and O-1A criteria — and one of the most misunderstood. This practitioner piece explains what 'published media' means, which outlets count, and how to earn it ethically.",
    category: "Strategy",
    source: "Immigration Law Weekly",
    sourceType: "strategy",
    readTime: "13 min",
    url: "https://www.ilw.com/articles/media-coverage-eb1a.shtm",
    tags: ["Evidence Building", "Media"],
  },
];

const CATEGORIES: Category[] = ["All", "EB-1A", "O-1A", "EB-2 NIW", "Strategy"];

const SOURCE_COLORS: Record<string, string> = {
  official: "bg-blue-50 text-blue-700 border-blue-100",
  legal: "bg-purple-50 text-purple-700 border-purple-100",
  guide: "bg-emerald-50 text-emerald-700 border-emerald-100",
  strategy: "bg-amber-50 text-amber-700 border-amber-100",
};

const CATEGORY_COLORS: Record<string, string> = {
  "EB-1A": "bg-indigo-50 text-indigo-700",
  "O-1A": "bg-sky-50 text-sky-700",
  "EB-2 NIW": "bg-violet-50 text-violet-700",
  "Strategy": "bg-orange-50 text-orange-700",
};

function ArticleCard({ article }: { article: Article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden"
    >
      {/* Top accent bar */}
      <div className={[
        "h-1 w-full",
        article.category === "EB-1A" ? "bg-indigo-500" :
        article.category === "O-1A" ? "bg-sky-500" :
        article.category === "EB-2 NIW" ? "bg-violet-500" : "bg-amber-500"
      ].join(" ")} />

      <div className="p-7 flex flex-col flex-1">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={["text-xs font-bold px-2.5 py-1 rounded-full", CATEGORY_COLORS[article.category]].join(" ")}>
            {article.category}
          </span>
          <span className={["text-xs font-semibold px-2.5 py-1 rounded-full border", SOURCE_COLORS[article.sourceType]].join(" ")}>
            {article.source}
          </span>
          {article.tags?.slice(0, 1).map(tag => (
            <span key={tag} className="text-xs text-slate-400 font-medium">
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-[#0A1128] mb-3 leading-snug group-hover:text-[#1E2D6B] transition-colors">
          {article.title}
        </h3>

        {/* Excerpt */}
        <p className="text-sm text-slate-500 leading-relaxed flex-1 mb-6">
          {article.excerpt}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            {article.readTime} read
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-[#1E2D6B] group-hover:gap-2 transition-all">
            Read Article
            <ExternalLink className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </a>
  );
}

function FeaturedArticle({ article }: { article: Article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-[#1E2D6B] rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-1"
    >
      <div className="p-10 md:p-14 flex flex-col md:flex-row gap-8 items-start">
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors border border-white/10">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="bg-[#F59E0B]/20 text-[#F59E0B] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Featured
            </span>
            <span className="text-white/40 text-xs font-bold uppercase tracking-wider">{article.category}</span>
            <span className="text-white/40 text-xs">·</span>
            <span className="text-white/40 text-xs font-medium">{article.source}</span>
          </div>
          <h3 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-4 group-hover:text-[#F59E0B] transition-colors">
            {article.title}
          </h3>
          <p className="text-white/70 leading-relaxed mb-6 max-w-2xl">
            {article.excerpt}
          </p>
          <div className="flex items-center gap-2 text-[#F59E0B] font-bold text-sm group-hover:gap-3 transition-all">
            Read Official Guide
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </a>
  );
}

export default function Resources() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const featured = ARTICLES.find((a) => a.featured);
  const filtered = ARTICLES.filter((a) => {
    if (activeCategory === "All") return !a.featured;
    return a.category === activeCategory && !a.featured;
  });
  // When a specific category is selected and it includes the featured article, show it in grid too
  const allFiltered = ARTICLES.filter((a) =>
    activeCategory === "All" ? !a.featured : a.category === activeCategory
  );

  return (
    <PublicLayout>
      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-24 bg-[#1E2D6B] overflow-hidden">
        <div className="absolute -right-20 -bottom-16 text-[300px] font-black text-white/[0.04] leading-none pointer-events-none select-none">³</div>
        <div className="max-w-[1100px] mx-auto px-6 relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8">
            <BookOpen className="w-3.5 h-3.5" />
            Resource Hub
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight max-w-3xl">
            Everything you need to understand<br />
            <span className="text-[#F59E0B]">your path to approval.</span>
          </h1>
          <p className="text-xl text-white/70 max-w-2xl leading-relaxed">
            Curated articles, official USCIS guides, and practitioner deep-dives on EB-1A, O-1A, and EB-2 NIW — in one place. No paywalls. No subscriptions.
          </p>
        </div>
      </section>

      {/* ── Philosophy strip ────────────────────────────────────────────────── */}
      <div className="bg-[#0F1F4A] border-y border-white/10 py-4">
        <div className="max-w-[1100px] mx-auto px-6 text-center">
          <p className="text-white/80 text-sm font-medium tracking-wide">
            Articles link to original sources. Pinnacle³ is not the author of external content. Nothing here constitutes legal advice.
          </p>
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-slate-50 min-h-[60vh]">
        <div className="max-w-[1100px] mx-auto px-6">

          {/* Featured article */}
          {activeCategory === "All" && featured && (
            <div className="mb-14">
              <FeaturedArticle article={featured} />
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap mb-10">
            {CATEGORIES.map((cat) => {
              const count = cat === "All"
                ? ARTICLES.length
                : ARTICLES.filter((a) => a.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={[
                    "px-4 py-2 rounded-full text-sm font-bold transition-all border",
                    activeCategory === cat
                      ? "bg-[#1E2D6B] text-white border-[#1E2D6B] shadow"
                      : "bg-white text-slate-600 border-slate-200 hover:border-[#1E2D6B]/40 hover:text-[#1E2D6B]",
                  ].join(" ")}
                >
                  {cat} <span className={["ml-1 text-xs font-medium", activeCategory === cat ? "text-white/60" : "text-slate-400"].join(" ")}>({count})</span>
                </button>
              );
            })}
          </div>

          {/* Results count */}
          <p className="text-slate-400 text-sm mb-8">
            Showing <strong className="text-slate-600">{activeCategory === "All" ? ARTICLES.length - 1 : allFiltered.length}</strong> article{(activeCategory === "All" ? ARTICLES.length - 1 : allFiltered.length) !== 1 ? "s" : ""} in <strong className="text-slate-600">{activeCategory}</strong>
          </p>

          {/* Featured in category view */}
          {activeCategory !== "All" && featured && featured.category === activeCategory && (
            <div className="mb-8">
              <FeaturedArticle article={featured} />
            </div>
          )}

          {/* Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(activeCategory === "All" ? filtered : allFiltered.filter(a => !a.featured)).map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {allFiltered.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <p className="text-lg font-medium">No articles in this category yet.</p>
              <p className="text-sm mt-2">Check back soon — we add new resources every week.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white border-t border-slate-100 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0A1128] mb-6 tracking-tight">
            Ready to go beyond reading?
          </h2>
          <p className="text-lg text-slate-600 mb-10 font-medium">
            Understanding the system is the first step. Building a case that wins is the next one. That's what we're here for.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <button className="bg-[#1E2D6B] text-white px-8 py-4 rounded font-extrabold text-base hover:bg-[#0F1F4A] transition-all hover:-translate-y-0.5 shadow-lg">
                Start Your Free Assessment
              </button>
            </Link>
            <Link href="/how-it-works">
              <button className="bg-white text-[#1E2D6B] border-2 border-[#1E2D6B]/20 px-8 py-4 rounded font-bold text-base hover:border-[#1E2D6B]/50 transition-all">
                See How We Work
              </button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
