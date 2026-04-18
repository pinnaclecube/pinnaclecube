import { useRoute, Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ARTICLES, ArticleSection } from "@/data/articles";
import { ChevronLeft, ChevronRight, BookOpen, Clock, ExternalLink } from "lucide-react";

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

function renderSection(section: ArticleSection, index: number) {
  switch (section.type) {
    case "h2":
      return (
        <h2 key={index} className="text-2xl font-extrabold text-[#0A1128] mt-12 mb-4 leading-tight">
          {section.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={index} className="text-lg font-bold text-[#1E2D6B] mt-8 mb-3">
          {section.text}
        </h3>
      );
    case "paragraph":
      return (
        <p key={index} className="text-[17px] text-slate-700 leading-relaxed mb-6">
          {section.text}
        </p>
      );
    case "bullets":
      return (
        <ul key={index} className="mb-6 space-y-3 pl-1">
          {section.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-[16px] text-slate-700 leading-relaxed">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      );
    case "numbered":
      return (
        <ol key={index} className="mb-6 space-y-3 pl-1 list-none">
          {section.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-4 text-[16px] text-slate-700 leading-relaxed">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-[#1E2D6B] text-white text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <div key={index} className="my-8 flex gap-4 bg-indigo-50 border-l-4 border-[#1E2D6B] rounded-r-xl px-6 py-5">
          <span className="text-[#1E2D6B] font-black text-xl leading-none mt-0.5">✦</span>
          <p className="text-[16px] text-[#0F1F4A] font-semibold leading-relaxed">
            {section.text}
          </p>
        </div>
      );
    case "divider":
      return <hr key={index} className="my-10 border-slate-200" />;
    default:
      return null;
  }
}

export default function ArticleDetail() {
  const [, params] = useRoute("/resources/:id");
  const articleId = params?.id;
  const article = ARTICLES.find((a) => a.id === articleId);

  if (!article) {
    return (
      <PublicLayout>
        <div className="pt-40 pb-32 text-center max-w-xl mx-auto px-6">
          <h1 className="text-3xl font-extrabold text-[#0A1128] mb-4">Article Not Found</h1>
          <p className="text-slate-500 mb-8">This article doesn't exist or may have been moved.</p>
          <Link href="/resources">
            <button className="bg-[#1E2D6B] text-white px-6 py-3 rounded font-bold hover:bg-[#0F1F4A] transition-colors">
              ← Back to Resources
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const related = ARTICLES.filter((a) => article.relatedIds.includes(a.id)).slice(0, 3);

  return (
    <PublicLayout>
      {/* ── Category accent bar ─────────────────────────────────────────────── */}
      <div className={["h-1 w-full fixed top-0 left-0 z-[60]", CATEGORY_BAR[article.category]].join(" ")} />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="pt-36 pb-14 md:pt-44 md:pb-16 bg-[#0A1128]">
        <div className="max-w-[760px] mx-auto px-6">
          <Link href="/resources">
            <span className="inline-flex items-center gap-1.5 text-white/50 hover:text-white/80 text-sm font-medium transition-colors mb-8 cursor-pointer group">
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Resource Hub
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className={["text-xs font-bold px-3 py-1 rounded-full", CATEGORY_COLORS[article.category]].join(" ")}>
              {article.category}
            </span>
            {article.tags?.map((tag) => (
              <span key={tag} className="text-xs text-white/40 font-medium bg-white/5 px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-6">
            {article.title}
          </h1>

          <p className="text-lg text-white/60 leading-relaxed mb-8">
            {article.excerpt}
          </p>

          <div className="flex items-center gap-3 text-white/40 text-sm border-t border-white/10 pt-6">
            <BookOpen className="w-4 h-4" />
            <span>Pinnacle³ Research Team</span>
            <span className="text-white/20">·</span>
            <Clock className="w-4 h-4" />
            <span>{article.readTime} read</span>
          </div>
        </div>
      </section>

      {/* ── Article body ─────────────────────────────────────────────────────── */}
      <section className="bg-white py-14">
        <div className="max-w-[760px] mx-auto px-6">
          <article>
            {article.content.map((section, index) => renderSection(section, index))}
          </article>

          {/* ── References ────────────────────────────────────────────────────── */}
          {article.references.length > 0 && (
            <div className="mt-16 pt-10 border-t border-slate-200">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">
                References & Further Reading
              </h2>
              <ul className="space-y-3">
                {article.references.map((ref, i) => (
                  <li key={i}>
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2 text-sm text-[#1E2D6B] hover:text-[#F59E0B] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-300 group-hover:text-[#F59E0B] transition-colors" />
                      {ref.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-slate-400 leading-relaxed">
                This article is written by the Pinnacle³ research team in our own words and represents our educational interpretation of publicly available information. Nothing in this article constitutes legal advice. Always consult a licensed immigration attorney for guidance specific to your case.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Related articles ─────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="bg-slate-50 border-t border-slate-100 py-16">
          <div className="max-w-[1100px] mx-auto px-6">
            <h2 className="text-2xl font-extrabold text-[#0A1128] mb-8">Continue Reading</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {related.map((rel) => (
                <Link key={rel.id} href={`/resources/${rel.id}`}>
                  <div className="group bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full flex flex-col">
                    <div className={["h-0.5 w-10 rounded mb-5", CATEGORY_BAR[rel.category]].join(" ")} />
                    <span className={["text-xs font-bold px-2.5 py-1 rounded-full w-fit mb-3", CATEGORY_COLORS[rel.category]].join(" ")}>
                      {rel.category}
                    </span>
                    <h3 className="text-base font-bold text-[#0A1128] leading-snug mb-3 group-hover:text-[#1E2D6B] transition-colors flex-1">
                      {rel.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-3">
                      <Clock className="w-3 h-3" />
                      {rel.readTime}
                      <ChevronRight className="w-3.5 h-3.5 ml-auto text-[#1E2D6B] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#1E2D6B] text-center">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-white mb-4">
            Ready to build your case?
          </h2>
          <p className="text-white/70 mb-8 text-lg">
            Knowledge is the first step. Execution is what gets approved.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <button className="bg-[#F59E0B] text-[#0A1128] px-8 py-4 rounded font-extrabold text-base hover:bg-amber-400 transition-all">
                Start Free Assessment
              </button>
            </Link>
            <Link href="/resources">
              <button className="bg-white/10 text-white border border-white/20 px-8 py-4 rounded font-bold text-base hover:bg-white/20 transition-all">
                ← Back to All Articles
              </button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
