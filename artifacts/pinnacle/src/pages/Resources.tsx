import { useState } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { BookOpen, Clock, ChevronRight } from "lucide-react";
import { ARTICLES, Article, ArticleCategory } from "@/data/articles";

type FilterCategory = "All" | ArticleCategory;

const CATEGORIES: FilterCategory[] = ["All", "EB-1A", "O-1A", "EB-2 NIW", "Strategy"];

const CATEGORY_COLORS: Record<string, string> = {
  "EB-1A": "bg-indigo-50 text-indigo-700",
  "O-1A": "bg-sky-50 text-sky-700",
  "EB-2 NIW": "bg-violet-50 text-violet-700",
  "Strategy": "bg-orange-50 text-orange-700",
};

const CATEGORY_BAR: Record<string, string> = {
  "EB-1A": "bg-indigo-500",
  "O-1A": "bg-sky-500",
  "EB-2 NIW": "bg-violet-500",
  "Strategy": "bg-amber-500",
};

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link href={`/resources/${article.id}`}>
      <div className="group flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden cursor-pointer h-full">
        <div className={["h-1 w-full", CATEGORY_BAR[article.category]].join(" ")} />
        <div className="p-7 flex flex-col flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={["text-xs font-bold px-2.5 py-1 rounded-full", CATEGORY_COLORS[article.category]].join(" ")}>
              {article.category}
            </span>
            {article.tags?.slice(0, 1).map((tag) => (
              <span key={tag} className="text-xs text-slate-400 font-medium">
                {tag}
              </span>
            ))}
          </div>
          <h3 className="text-lg font-bold text-[#0A1128] mb-3 leading-snug group-hover:text-[#1E2D6B] transition-colors flex-1">
            {article.title}
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-6 line-clamp-3">
            {article.excerpt}
          </p>
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              {article.readTime} read
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-[#1E2D6B] group-hover:gap-2 transition-all">
              Read Article
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FeaturedArticle({ article }: { article: Article }) {
  return (
    <Link href={`/resources/${article.id}`}>
      <div className="group block bg-[#1E2D6B] rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-1 cursor-pointer">
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
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-4 group-hover:text-[#F59E0B] transition-colors">
              {article.title}
            </h3>
            <p className="text-white/70 leading-relaxed mb-6 max-w-2xl">
              {article.excerpt}
            </p>
            <div className="flex items-center gap-2 text-[#F59E0B] font-bold text-sm group-hover:gap-3 transition-all">
              Read Full Article
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Resources() {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("All");

  const featured = ARTICLES.find((a) => a.featured);
  const gridArticles = ARTICLES.filter((a) => {
    if (activeCategory === "All") return !a.featured;
    return a.category === activeCategory && !a.featured;
  });
  const featuredInCategory =
    activeCategory !== "All" && featured && featured.category === activeCategory;

  const totalForCategory =
    activeCategory === "All"
      ? ARTICLES.length
      : ARTICLES.filter((a) => a.category === activeCategory).length;

  return (
    <PublicLayout>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
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
            In-depth guides on EB-1A, O-1A, and EB-2 NIW — researched, written, and published by the Pinnacle³ team. No paywalls. No subscriptions.
          </p>
        </div>
      </section>

      {/* ── Disclaimer strip ─────────────────────────────────────────────────── */}
      <div className="bg-[#0F1F4A] border-y border-white/10 py-4">
        <div className="max-w-[1100px] mx-auto px-6 text-center">
          <p className="text-white/80 text-sm font-medium tracking-wide">
            All articles are written by the Pinnacle³ research team in our own words. Nothing here constitutes legal advice. References to official sources are provided at the end of each article.
          </p>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-slate-50 min-h-[60vh]">
        <div className="max-w-[1100px] mx-auto px-6">

          {/* Featured article */}
          {activeCategory === "All" && featured && (
            <div className="mb-14">
              <FeaturedArticle article={featured} />
            </div>
          )}

          {/* Featured appears in category filter too */}
          {featuredInCategory && featured && (
            <div className="mb-10">
              <FeaturedArticle article={featured} />
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap mb-10">
            {CATEGORIES.map((cat) => {
              const count =
                cat === "All"
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
                  {cat}{" "}
                  <span
                    className={[
                      "ml-1 text-xs font-medium",
                      activeCategory === cat ? "text-white/60" : "text-slate-400",
                    ].join(" ")}
                  >
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-slate-400 text-sm mb-8">
            Showing{" "}
            <strong className="text-slate-600">
              {activeCategory === "All" ? ARTICLES.length - 1 : totalForCategory}
            </strong>{" "}
            article
            {(activeCategory === "All" ? ARTICLES.length - 1 : totalForCategory) !== 1 ? "s" : ""}{" "}
            in <strong className="text-slate-600">{activeCategory}</strong>
          </p>

          {/* Article grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gridArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {gridArticles.length === 0 && !featuredInCategory && (
            <div className="text-center py-20 text-slate-400">
              <p className="text-lg font-medium">No articles in this category yet.</p>
              <p className="text-sm mt-2">Check back soon — we add new resources regularly.</p>
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
            Understanding the system is the first step. Building a case that wins is the next one.
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
