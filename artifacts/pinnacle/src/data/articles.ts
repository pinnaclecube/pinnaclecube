export type ArticleCategory = "EB-1A" | "O-1A" | "EB-2 NIW" | "Strategy";
export type SourceType = "official" | "legal" | "strategy" | "guide";

export interface ArticleSection {
  type: "paragraph" | "h2" | "h3" | "bullets" | "numbered" | "callout" | "divider";
  text?: string;
  items?: string[];
}

export interface ArticleReference {
  label: string;
  url: string;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: ArticleCategory;
  sourceType: SourceType;
  readTime: string;
  featured?: boolean;
  tags?: string[];
  content: ArticleSection[];
  references: ArticleReference[];
  relatedIds: string[];
}

export const ARTICLES: Article[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // EB-1A
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "eb1a-extraordinary-ability-standard",
    title: "What 'Extraordinary Ability' Actually Means Under U.S. Immigration Law",
    excerpt:
      "The phrase sounds lofty, but USCIS gives it a precise legal definition. This guide unpacks what 'extraordinary ability' means, how the evidentiary criteria map to real career achievements, and what adjudicators are actually looking for.",
    category: "EB-1A",
    sourceType: "official",
    readTime: "12 min",
    featured: true,
    tags: ["Must Read", "Foundational"],
    content: [
      {
        type: "paragraph",
        text: "When most professionals hear 'extraordinary ability,' they picture Nobel laureates and Olympic champions. The legal standard is far more accessible — but it still requires a careful, strategic presentation of your career. Understanding the definition is the single most important step you can take before building your case.",
      },
      {
        type: "h2",
        text: "The Legal Definition",
      },
      {
        type: "paragraph",
        text: "Under the Immigration and Nationality Act (INA § 203(b)(1)(A)), extraordinary ability means a level of expertise indicating that you are one of that small percentage who has risen to the very top of your field. USCIS operationalizes this through regulations at 8 C.F.R. § 204.5(h), which set out two pathways to meet the standard.",
      },
      {
        type: "h3",
        text: "Pathway 1: A Major Prize",
      },
      {
        type: "paragraph",
        text: "If you have received a one-time achievement that is internationally recognized as a major prize in your field — such as the Nobel Prize, a Pulitzer, an Olympic medal, or an Oscar — that single award satisfies the standard on its own. This pathway applies to a small number of petitioners.",
      },
      {
        type: "h3",
        text: "Pathway 2: Meeting Three of Ten Criteria",
      },
      {
        type: "paragraph",
        text: "The vast majority of successful EB-1A petitioners use the second pathway: demonstrating evidence in at least three of the following ten regulatory categories. Meeting three or more criteria does not automatically confer approval — it establishes a threshold that then triggers a final 'totality of the evidence' review.",
      },
      {
        type: "bullets",
        items: [
          "Receipt of nationally or internationally recognized prizes or awards for excellence in your field",
          "Membership in associations requiring outstanding achievement, as judged by recognized national or international experts",
          "Published material about you in professional, major trade, or major media publications",
          "Judging the work of others, either individually or on a panel",
          "Original scientific, scholarly, artistic, athletic, or business-related contributions of major significance",
          "Authorship of scholarly articles in professional journals or major media",
          "Display of your work at artistic exhibitions or showcases",
          "A leading or critical role in a distinguished organization",
          "High remuneration for services relative to others in the field",
          "Commercial successes in the performing arts",
        ],
      },
      {
        type: "h2",
        text: "The Two-Step Adjudication Framework",
      },
      {
        type: "paragraph",
        text: "Since a 2010 AAO decision (commonly called the Kazarian decision), USCIS has applied a two-step analysis to every EB-1A petition. First, the officer counts whether you have submitted qualifying evidence in at least three categories. Second, they step back and conduct a 'final merits determination' — weighing all the evidence together to decide whether it demonstrates sustained national or international acclaim.",
      },
      {
        type: "callout",
        text: "Meeting three criteria is necessary but not sufficient. Many petitions that clear step one are still denied at step two. The quality and framing of your evidence matters as much as the category count.",
      },
      {
        type: "h2",
        text: "What 'Sustained National or International Acclaim' Looks Like",
      },
      {
        type: "paragraph",
        text: "USCIS looks for evidence that your recognition has persisted over time and extends beyond your immediate employer or local community. A single industry award is weaker than a pattern of recognition across multiple organizations over several years. Consistent citations to your published work, repeated invitations to speak or judge, and press coverage in publications outside your own institution all signal sustainability and breadth.",
      },
      {
        type: "h2",
        text: "Common Misunderstandings",
      },
      {
        type: "bullets",
        items: [
          "You do not need to be the best in the world — you need to be among a small percentage at the top of your field.",
          "The criteria are not pass/fail boxes to check. Weak evidence in three categories is less persuasive than strong evidence in two.",
          "USCIS evaluates your field as you define it. A specialist in NLP at AI companies can define their field more narrowly than 'computer science,' making top-of-field easier to demonstrate.",
          "Self-petitioning is allowed — no employer sponsor or job offer is required.",
        ],
      },
      {
        type: "h2",
        text: "A Note on Self-Petitioning",
      },
      {
        type: "paragraph",
        text: "One of the most important features of the EB-1A category is that you can file the I-140 petition yourself, without a sponsoring employer. This makes it particularly powerful for senior professionals who are between employers, considering a career change, or working on their own. Your petition must still include a statement of intention to continue working in your field in the United States, but you are not bound to a specific employer.",
      },
    ],
    references: [
      { label: "INA § 203(b)(1)(A) — EB-1A Statutory Definition", url: "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-first-preference-eb-1" },
      { label: "8 C.F.R. § 204.5(h) — Regulatory Criteria", url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-204/section-204.5" },
      { label: "USCIS Policy Manual Vol. 6, Part F, Ch. 2 — Extraordinary Ability", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2" },
      { label: "Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010)", url: "https://casetext.com/case/kazarian-v-us-citizenship" },
    ],
    relatedIds: ["eb1a-ten-criteria-breakdown", "eb1a-policy-manual-guide", "eb1a-tech-professionals"],
  },

  {
    id: "eb1a-ten-criteria-breakdown",
    title: "The 10 EB-1A Criteria: A Practical Breakdown for Senior Professionals",
    excerpt:
      "Not all criteria are created equal — and not all professionals will qualify for the same ones. This article walks through every criterion with practical guidance on what evidence satisfies it, what doesn't, and how USCIS actually evaluates each one.",
    category: "EB-1A",
    sourceType: "legal",
    readTime: "18 min",
    tags: ["Evidence Strategy", "Deep Dive"],
    content: [
      {
        type: "paragraph",
        text: "The ten regulatory criteria for EB-1A are designed to capture extraordinary ability across every professional field — from classical musicians to semiconductor engineers. But the language of the regulations is often abstract, and what constitutes 'qualifying evidence' under each criterion is shaped by years of USCIS adjudications, AAO decisions, and federal court rulings. Here is what you actually need to know.",
      },
      {
        type: "h2",
        text: "Criterion 1: Awards and Prizes",
      },
      {
        type: "paragraph",
        text: "This criterion covers prizes or awards specifically for excellence in your field, recognized at the national or international level. The key words are 'excellence' (not just participation) and 'recognized' (not just internally meaningful). A 'Best Paper Award' at a major IEEE or NeurIPS conference likely qualifies. A company-internal 'Employee of the Quarter' award almost certainly does not. USCIS evaluates the prestige and selectivity of the awarding body, so documentation should include how competitive the award is and who has received it historically.",
      },
      {
        type: "h2",
        text: "Criterion 2: Membership in Exclusive Associations",
      },
      {
        type: "paragraph",
        text: "The association must require outstanding achievement as a prerequisite for admission, as judged by recognized experts in the field. This rules out associations that anyone can join by paying a fee. Fellowship status in IEEE, ACM, the American Academy of Arts and Sciences, or equivalent bodies typically qualifies. Senior member status in some organizations qualifies with additional documentation of the selection process.",
      },
      {
        type: "h2",
        text: "Criterion 3: Published Media Coverage",
      },
      {
        type: "paragraph",
        text: "This criterion covers published material about you — not by you — in professional or major trade publications, or major media. A profile in Wired, a feature in the MIT Technology Review, or a story in a major newspaper about your research or work qualifies. Blog posts citing you do not. Press releases you commissioned yourself do not. The article must be about your work specifically, not merely mention you in passing.",
      },
      {
        type: "callout",
        text: "Tip: Many professionals have media coverage they've forgotten about. Search your name in Google News, your institution's press archive, and trade publications in your field before concluding you don't have this criterion.",
      },
      {
        type: "h2",
        text: "Criterion 4: Judging the Work of Others",
      },
      {
        type: "paragraph",
        text: "This is one of the most accessible criteria for academics and technical professionals. Peer reviewing papers for journals or conferences, serving on dissertation committees, judging hackathons or pitch competitions at a recognized level, or evaluating grant proposals — all potentially qualify. The key is that the judging role must be recognized as such (an invitation letter or editorial acknowledgment helps), and the body you judged for must be reputable.",
      },
      {
        type: "h2",
        text: "Criterion 5: Original Contributions of Major Significance",
      },
      {
        type: "paragraph",
        text: "This is the most frequently cited criterion — and the most frequently misunderstood. The contribution must be original and must have had major significance in the field. 'Major significance' means your work has influenced others: your papers are widely cited, your open-source project is used by thousands, your patent is licensed commercially, or your methodology has been adopted by others. Simply having done novel work is not enough; you need evidence that the field recognized and built upon it.",
      },
      {
        type: "h2",
        text: "Criterion 6: Scholarly Articles",
      },
      {
        type: "paragraph",
        text: "Publishing peer-reviewed articles in recognized journals or conference proceedings qualifies for this criterion. USCIS does not require a minimum number — a small body of highly cited work in top-tier venues is more persuasive than dozens of papers in obscure outlets. Include your citation counts, h-index, and evidence of where papers were published relative to the field's most respected publications.",
      },
      {
        type: "h2",
        text: "Criterion 7: Display of Work at Artistic Exhibitions",
      },
      {
        type: "paragraph",
        text: "This criterion is primarily designed for visual artists, sculptors, photographers, and similar creative professionals. It is rarely applicable to scientists, engineers, or business professionals. Do not force this criterion where it doesn't fit.",
      },
      {
        type: "h2",
        text: "Criterion 8: Leading or Critical Role in Distinguished Organizations",
      },
      {
        type: "paragraph",
        text: "This criterion requires evidence of two things: that you have held a leading or critical role, and that the organization is 'distinguished.' Distinguished usually means the organization has an established reputation in its field — a top-10 university, a FAANG company, a recognized research lab, a well-known nonprofit. The role must be leadership (Director, VP, Principal, Lead) or otherwise critical (the person responsible for a significant project or product). Supporting evidence should show what the organization is known for and why your role within it was essential.",
      },
      {
        type: "h2",
        text: "Criterion 9: High Remuneration",
      },
      {
        type: "paragraph",
        text: "If your total compensation is significantly higher than others in your field at comparable career stages, this criterion can be documented with offer letters, pay stubs, W-2s, or employer declarations. You'll also need comparative salary data — Bureau of Labor Statistics figures, industry surveys, or compensation databases. This criterion is particularly strong for senior technical professionals at major technology companies.",
      },
      {
        type: "h2",
        text: "Criterion 10: Commercial Success in the Performing Arts",
      },
      {
        type: "paragraph",
        text: "This criterion applies to performing artists. Box office receipts, streaming numbers, record sales, or concert ticket revenue can document it. It is not applicable to most STEM or business professionals.",
      },
      {
        type: "h2",
        text: "Choosing Your Three",
      },
      {
        type: "paragraph",
        text: "Most STEM and business professionals build their cases around criteria 1 (awards), 4 (judging), 5 (original contributions), 6 (scholarly articles), 8 (critical role), and 9 (high salary). A strong petition typically leads with three to five criteria where the evidence is robust and unambiguous, then addresses any additional criteria where evidence is available but less strong. Never include a criterion if your evidence is marginal — it can do more harm than good.",
      },
    ],
    references: [
      { label: "8 C.F.R. § 204.5(h)(3) — The Ten Criteria", url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-204/section-204.5" },
      { label: "USCIS Policy Manual Vol. 6, Part F, Ch. 2", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2" },
      { label: "AAO Non-Precedent Decisions on EB-1A Criteria", url: "https://www.uscis.gov/administrative-appeals/aao-decisions/non-precedent-decisions" },
    ],
    relatedIds: ["eb1a-extraordinary-ability-standard", "eb1a-building-evidence-before-lawyer", "eb1a-policy-manual-guide"],
  },

  {
    id: "eb1a-policy-manual-guide",
    title: "Inside the Adjudicator's Playbook: How USCIS Actually Evaluates EB-1A Petitions",
    excerpt:
      "USCIS publishes the internal guidance officers use to evaluate petitions. Understanding that document is a strategic advantage. This article decodes the Policy Manual language that most applicants never read.",
    category: "EB-1A",
    sourceType: "official",
    readTime: "15 min",
    tags: ["Official", "Advanced"],
    content: [
      {
        type: "paragraph",
        text: "The USCIS Policy Manual is not a document most professionals read — but it is the document that determines the outcome of their petition. It is the internal instruction guide that adjudicators follow when evaluating every I-140 petition. Understanding it gives you a direct window into how your case will be reviewed.",
      },
      {
        type: "h2",
        text: "What the Policy Manual Is",
      },
      {
        type: "paragraph",
        text: "The USCIS Policy Manual is a publicly available, continuously updated online document that consolidates the agency's immigration policies. Volume 6, Part F, Chapter 2 governs the evaluation of EB-1A petitions. It is binding guidance for USCIS officers. When an adjudicator in Nebraska or Texas opens your petition, this is the framework they use.",
      },
      {
        type: "h2",
        text: "The Totality of Evidence Standard",
      },
      {
        type: "paragraph",
        text: "The Policy Manual explicitly instructs officers to evaluate the totality of the evidence — not just whether individual criteria are technically met. This means a petition with strong, compelling evidence in three criteria is more likely to succeed than a petition with thin, marginal evidence in six criteria. Officers are told to ask whether the sum of the evidence, taken together, reflects sustained acclaim at the national or international level.",
      },
      {
        type: "callout",
        text: "The Manual specifically warns officers against counting criteria like checklist items. Meeting the numerical threshold is necessary but not the endpoint of the analysis.",
      },
      {
        type: "h2",
        text: "How Officers Evaluate 'National or International Acclaim'",
      },
      {
        type: "paragraph",
        text: "The Manual acknowledges that most fields lack a single well-known prize like the Nobel. For these fields, officers must look at the totality of recognition — including citations, invitations, press coverage, judging roles, and leadership positions — and assess whether they collectively paint a picture of someone who has risen to the top of their field. The evidence does not need to be global; for highly specialized fields, national recognition within a niche can satisfy the standard.",
      },
      {
        type: "h2",
        text: "Comparable Evidence",
      },
      {
        type: "paragraph",
        text: "The regulations allow petitioners to submit 'comparable evidence' if the standard criteria don't readily apply to their occupation. The Policy Manual instructs officers to consider this evidence if the petitioner explains why the listed criteria do not readily apply to their field and how the submitted evidence is truly comparable. This is an underused tool for professionals in emerging fields like AI safety, synthetic biology, or Web3 who may have significant recognition that doesn't map cleanly onto the ten traditional criteria.",
      },
      {
        type: "h2",
        text: "What Makes a Petition Letter Effective",
      },
      {
        type: "paragraph",
        text: "The Policy Manual gives officers latitude in evaluating the explanatory petition letter (often called the support letter or cover letter). The letter should connect each piece of evidence to the applicable criterion and explain, in plain language, why the evidence reflects extraordinary ability. Officers are not immigration experts in your specific field — you need to explain why a particular journal is prestigious, why a specific award is selective, or why your citation count is exceptional relative to your peers.",
      },
      {
        type: "h2",
        text: "Requests for Evidence: What Triggers Them",
      },
      {
        type: "paragraph",
        text: "The Policy Manual outlines when officers should issue a Request for Evidence (RFE) versus deny outright. An RFE typically follows when the officer believes additional documentation could make the case approvable — it is an opportunity, not a verdict. Common triggers include: criteria where the evidence is ambiguous, fields where the officer may not have enough context to evaluate prestige, and petitions where the petition letter doesn't adequately bridge evidence to criterion. A well-prepared initial petition reduces the RFE risk significantly.",
      },
    ],
    references: [
      { label: "USCIS Policy Manual Vol. 6, Part F, Ch. 2 — EB-1A", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2" },
      { label: "USCIS Policy Manual Vol. 1, Part E — Evidence Standards", url: "https://www.uscis.gov/policy-manual/volume-1-part-e" },
      { label: "Kazarian v. USCIS — Two-Step Framework", url: "https://casetext.com/case/kazarian-v-us-citizenship" },
    ],
    relatedIds: ["eb1a-extraordinary-ability-standard", "eb1a-ten-criteria-breakdown", "strategy-rfe-response"],
  },

  {
    id: "eb1a-plain-language-guide",
    title: "EB-1A Green Card: A Plain-Language Guide for Senior Professionals",
    excerpt:
      "No law degree required. This guide explains the EB-1A process from I-140 filing through green card approval, in the straightforward language you'd want from a trusted advisor.",
    category: "EB-1A",
    sourceType: "guide",
    readTime: "14 min",
    tags: ["Beginner Friendly", "Process"],
    content: [
      {
        type: "paragraph",
        text: "If you've spent years building an exceptional career and are now wondering whether you might qualify for a green card through the EB-1A extraordinary ability category, this guide is for you. We'll walk through the full process in plain language — no legal jargon, no assumptions about what you already know.",
      },
      {
        type: "h2",
        text: "What EB-1A Is — and Isn't",
      },
      {
        type: "paragraph",
        text: "EB-1A is one of the most desirable U.S. green card pathways for senior professionals. It sits in the first employment-based preference category (EB-1), which means shorter wait times than EB-2 or EB-3 categories — sometimes dramatically shorter for Indian and Chinese nationals who face long backlogs in lower preference categories. Most importantly, it does not require employer sponsorship: you can file the I-140 petition yourself, known as self-petitioning. You are not tied to a specific job or employer.",
      },
      {
        type: "h2",
        text: "Step 1: Determining Eligibility",
      },
      {
        type: "paragraph",
        text: "The first question is whether you can meet at least three of the ten regulatory criteria. This requires an honest, document-backed assessment of your career accomplishments. Many senior professionals are surprised to discover they qualify — particularly on criteria like judging (peer review counts), original contributions (high-impact publications or patents), and salary (which is particularly strong for senior engineers at major tech companies).",
      },
      {
        type: "h2",
        text: "Step 2: Gathering Evidence",
      },
      {
        type: "paragraph",
        text: "Evidence gathering is the most time-intensive phase of building an EB-1A petition. You will need primary documents — the actual awards, membership certificates, publication records, pay stubs — as well as supporting context, such as documentation of how selective an award is or how prestigious a journal is. Recommendation letters from prominent figures in your field also play an important role, even though they are not listed as a standalone criterion.",
      },
      {
        type: "h2",
        text: "Step 3: Drafting the Petition Letter",
      },
      {
        type: "paragraph",
        text: "The petition letter (sometimes called the support letter or cover memo) is often the most important document in the package. It synthesizes your evidence, explains why each criterion is met, and makes the case that — taken together — your evidence reflects extraordinary ability at the national or international level. A strong petition letter reads like a well-argued brief: specific, evidence-backed, and persuasive.",
      },
      {
        type: "h2",
        text: "Step 4: Filing the I-140",
      },
      {
        type: "paragraph",
        text: "The I-140 (Immigrant Petition for Alien Workers) is the central petition form for EB-1A. It is filed with USCIS, along with the full evidence package and a filing fee. Premium processing (currently $2,805) guarantees a response — either an approval, an RFE, or a denial — within 15 business days. Without premium processing, processing times vary but have historically ranged from a few weeks to several months.",
      },
      {
        type: "h2",
        text: "Step 5: After the I-140 Is Approved",
      },
      {
        type: "paragraph",
        text: "An approved I-140 does not itself grant a green card — it establishes your priority date and confirms your eligibility for the EB-1 category. The next step depends on your current status. If you are already in the U.S. on a valid visa and a green card number is immediately available (which is often the case for EB-1 for nationals of most countries), you can file for Adjustment of Status (I-485) concurrently with or after the I-140. If you are outside the U.S., you go through consular processing.",
      },
      {
        type: "callout",
        text: "For Indian and Chinese nationals, EB-1 priority dates are generally much closer to 'current' than EB-2 or EB-3 dates. This alone makes EB-1A worth pursuing seriously if you can qualify.",
      },
      {
        type: "h2",
        text: "How Long Does It Take?",
      },
      {
        type: "paragraph",
        text: "With premium processing on the I-140, you can have a decision in 15 business days. Adjustment of Status processing currently takes 8–24 months for most applicants, depending on the service center and current backlogs. Some applicants file a concurrent I-140 and I-485, which can allow you to apply for work authorization (EAD) and advance parole while you wait — removing the dependency on maintaining a nonimmigrant status.",
      },
    ],
    references: [
      { label: "USCIS — Form I-140, Immigrant Petition for Alien Workers", url: "https://www.uscis.gov/i-140" },
      { label: "USCIS — Visa Bulletin (Current Priority Dates)", url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" },
      { label: "USCIS — EB-1 First Preference Overview", url: "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-first-preference-eb-1" },
    ],
    relatedIds: ["eb1a-extraordinary-ability-standard", "eb1a-ten-criteria-breakdown", "eb1a-building-evidence-before-lawyer"],
  },

  {
    id: "eb1a-building-evidence-before-lawyer",
    title: "Building Your EB-1A Evidence Before You Hire Anyone",
    excerpt:
      "Most professionals don't start gathering evidence until they've already hired an attorney. That's a strategic mistake. The work you do now — before any filing — can make or break your petition.",
    category: "EB-1A",
    sourceType: "strategy",
    readTime: "16 min",
    tags: ["Strategy", "Must Read", "Evidence Building"],
    content: [
      {
        type: "paragraph",
        text: "Here's something that surprises most professionals when they first engage with the EB-1A process: an attorney can't make your career more impressive. They can only package what already exists. The strength of your petition is determined almost entirely by the quality and volume of evidence you have accumulated — much of it before you ever walked into a lawyer's office.",
      },
      {
        type: "h2",
        text: "Start With an Honest Audit",
      },
      {
        type: "paragraph",
        text: "Before doing anything else, take two hours and make a list of every possible evidence item you might have across all ten criteria. Don't edit yourself — just inventory. You are looking for: awards and prizes you've received (including competitive fellowships and grants), organizations you are a member of (and the selection criteria for those memberships), any press coverage about your work, any judging, reviewing, or evaluation roles you've held, and any evidence that your work has had impact beyond your immediate team or organization.",
      },
      {
        type: "h2",
        text: "The Paper Trail That Doesn't Exist Yet",
      },
      {
        type: "paragraph",
        text: "Many professionals have accomplishments that are real but undocumented in a form USCIS will accept. A verbal invitation to review papers for a conference needs to become an email invitation and an editorial acknowledgment. A salary that is genuinely exceptional needs pay stubs and comparison data. Recognition that exists within your industry but hasn't been written up by press needs to generate some press. Identifying these gaps early gives you time to close them.",
      },
      {
        type: "h2",
        text: "What You Can Do Today (That Takes Months to Show Up)",
      },
      {
        type: "bullets",
        items: [
          "Say yes to peer review requests for top-tier conferences and journals — and save the invitation emails",
          "Apply for fellowship or senior member status in professional organizations like IEEE, ACM, or equivalent bodies in your field",
          "Write a thoughtful LinkedIn post about a significant project — it can surface interest from trade press",
          "Accept speaking invitations at recognized venues and ask for speaker acknowledgment in writing",
          "Ask collaborators at other institutions or companies to cite your work or reference your contributions in their publications",
          "Document your compensation with pay stubs and any equity or bonus data that can be compared against industry benchmarks",
        ],
      },
      {
        type: "h2",
        text: "Recommendation Letters: Don't Wait Until Filing",
      },
      {
        type: "paragraph",
        text: "Recommendation letters are not one of the ten criteria, but they are one of the most powerful persuasive tools in the entire petition. A letter from a recognized expert in your field explaining the significance of your contributions can be the difference between an approval and an RFE. The challenge is that strong letter-writers need to be cultivated over time — they can't be asked cold two weeks before you want to file. Start identifying potential writers now: academics who have cited your work, senior leaders at other organizations who have witnessed your impact, former managers or collaborators with strong credentials.",
      },
      {
        type: "callout",
        text: "The best recommendation letters are from people who know your work specifically and can speak to your field's standards — not just from famous people who barely know you.",
      },
      {
        type: "h2",
        text: "What to Do About Media Coverage",
      },
      {
        type: "paragraph",
        text: "If you currently have no press coverage, you are not alone — and you have options. Many professionals secure legitimate media coverage through thoughtful outreach: pitching a perspective piece to a trade publication, being available as a source for journalists covering your field, or having your institution's PR team surface your work to relevant reporters. This takes months, not weeks, which is why starting early matters so much.",
      },
      {
        type: "h2",
        text: "When You Are Ready to Engage an Attorney or Advisor",
      },
      {
        type: "paragraph",
        text: "When you have done the inventory work and have a reasonable body of evidence assembled, you are in a far stronger position to evaluate your case with a professional. You will be able to have an informed conversation about which criteria are strongest, what gaps remain, and whether filing now or waiting six months to close specific gaps is the better strategy. The professionals who get the best outcomes are those who treat evidence-building as a long-term project — not a sprint in the months before filing.",
      },
    ],
    references: [
      { label: "USCIS Policy Manual — EB-1A Evidence Standards", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2" },
      { label: "8 C.F.R. § 204.5(h) — Regulatory Criteria for Extraordinary Ability", url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-204/section-204.5" },
    ],
    relatedIds: ["eb1a-ten-criteria-breakdown", "strategy-media-coverage", "eb1a-extraordinary-ability-standard"],
  },

  {
    id: "eb1a-tech-professionals",
    title: "EB-1A for Software Engineers, ML Researchers, and Tech Leaders",
    excerpt:
      "Tech professionals often underestimate their own qualifications — and sometimes struggle to map their work onto criteria written for traditional 'talent' fields. This guide is specifically for you.",
    category: "EB-1A",
    sourceType: "strategy",
    readTime: "15 min",
    tags: ["Tech Professionals", "Strategy"],
    content: [
      {
        type: "paragraph",
        text: "The EB-1A criteria were written with academics and performing artists in mind — but they have been successfully applied to thousands of tech professionals over the past decade. The challenge isn't that engineers and researchers don't qualify; it's that they often fail to frame their work in the language USCIS is looking for. This guide is specifically for software engineers, machine learning researchers, engineering managers, and technical leaders at technology companies.",
      },
      {
        type: "h2",
        text: "Defining Your Field Strategically",
      },
      {
        type: "paragraph",
        text: "One of the most powerful strategic decisions you'll make is how to define your field. 'Computer science' or 'software engineering' is a very broad field — being at the top of it is nearly impossible to demonstrate. But 'natural language processing' or 'distributed systems reliability at hyperscale' is a much narrower specialty. Defining your field more narrowly makes it more realistic to be in 'that small percentage who has risen to the very top.' This is entirely legal and is routinely accepted by USCIS — as long as the field definition is legitimate and consistent throughout your petition.",
      },
      {
        type: "h2",
        text: "How Standard Tech Accomplishments Map to Criteria",
      },
      {
        type: "h3",
        text: "Conference Papers and Workshop Publications",
      },
      {
        type: "paragraph",
        text: "Publications at top-tier venues like NeurIPS, ICML, CVPR, ICLR, OSDI, SOSP, or CCS can satisfy both Criterion 6 (scholarly articles) and Criterion 5 (original contributions of major significance) if they have been well-cited. In ML and AI research, acceptance rates of 15–25% at top venues are themselves evidence of selectivity. Google Scholar citation counts, semantic scholar data, and field-specific h-index comparisons are all valid supporting evidence.",
      },
      {
        type: "h3",
        text: "Open-Source Contributions",
      },
      {
        type: "paragraph",
        text: "Open-source projects with significant adoption — GitHub stars, forks, downstream dependencies, or documented industry use — can support Criterion 5 (original contributions). The key is demonstrating impact: not just that you built something, but that others use it at scale. Stars alone are weak; documented production use at other companies, citations in papers, or press coverage about the project are much stronger.",
      },
      {
        type: "h3",
        text: "Program Committee Membership",
      },
      {
        type: "paragraph",
        text: "Serving on the program committee of a recognized conference, or peer reviewing for major journals and conferences, satisfies Criterion 4 (judging). Save every invitation email and every acknowledgment in conference proceedings or journal editorial notes. For highly competitive venues, USCIS will also want to see evidence that the reviewing role is selective — not everyone who submits a paper is invited to review.",
      },
      {
        type: "h3",
        text: "Compensation at Top Tech Companies",
      },
      {
        type: "paragraph",
        text: "Senior engineers and researchers at FAANG and comparable companies often have total compensation significantly above the national median for their occupation. Criterion 9 (high salary) is one of the most straightforward criteria to document — offer letters, W-2s, and Levels.fyi or Radford data showing how your compensation compares to the field can make this criterion very strong.",
      },
      {
        type: "h3",
        text: "Press Coverage",
      },
      {
        type: "paragraph",
        text: "Features in Wired, MIT Technology Review, The Verge, TechCrunch, VentureBeat, or industry newsletters about your work — not your company's work generally, but your specific contributions — satisfy Criterion 3. If a reporter has quoted you as an expert, that is supportive context but does not fully satisfy this criterion alone. The piece needs to be substantially about you or your work.",
      },
      {
        type: "h2",
        text: "Engineering Managers and Technical Leaders",
      },
      {
        type: "paragraph",
        text: "Engineering managers, VPs of Engineering, and CTOs can build strong cases around Criterion 8 (critical role in a distinguished organization) by documenting that they led teams, products, or infrastructure that are consequential to the organization's success. The organization itself must be distinguished — a top-tier tech company, a leading research lab, or a well-known startup in its space. The leader's role must be shown as genuinely critical, not just senior in title.",
      },
      {
        type: "callout",
        text: "Many tech professionals have stronger cases than they realize — and many are sitting on evidence they haven't thought to document. An honest inventory is the most important first step.",
      },
    ],
    references: [
      { label: "USCIS Policy Manual Vol. 6, Part F, Ch. 2 — Extraordinary Ability", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2" },
      { label: "8 C.F.R. § 204.5(h)(3) — Regulatory Criteria", url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-204/section-204.5" },
      { label: "Levels.fyi — Compensation Data for Tech Professionals", url: "https://www.levels.fyi" },
    ],
    relatedIds: ["eb1a-ten-criteria-breakdown", "eb1a-building-evidence-before-lawyer", "o1a-vs-eb1a"],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // O-1A
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "o1a-complete-guide",
    title: "O-1A Visa: Your Complete Guide to Extraordinary Ability Work Authorization",
    excerpt:
      "The O-1A is the fastest path to U.S. work authorization for professionals with extraordinary ability. This guide covers eligibility, evidence, the petition process, and how it fits into a long-term green card strategy.",
    category: "O-1A",
    sourceType: "official",
    readTime: "14 min",
    tags: ["Must Read", "Foundational"],
    content: [
      {
        type: "paragraph",
        text: "The O-1A visa is a nonimmigrant work authorization category for individuals with extraordinary ability in science, business, education, or athletics. Unlike H-1B, it does not require a lottery. Unlike EB-1A, it does not grant permanent residence. But it is often the fastest route to legally working in the United States for senior professionals with a strong record — and it can serve as a bridge to the EB-1A green card.",
      },
      {
        type: "h2",
        text: "Who Should Consider the O-1A",
      },
      {
        type: "bullets",
        items: [
          "H-1B lottery losers who still want to work in the U.S.",
          "F-1 OPT holders whose authorization is expiring and who need an alternative to H-1B",
          "Professionals considering EB-1A who want to validate their case with a lower-stakes filing first",
          "Executives or researchers at companies willing to sponsor a petition",
          "International professionals who want to begin working in the U.S. while pursuing a green card in parallel",
        ],
      },
      {
        type: "h2",
        text: "O-1A vs. O-1B",
      },
      {
        type: "paragraph",
        text: "The O-1A category applies to extraordinary ability in science, education, business, and athletics. The O-1B category applies to the arts, motion picture, and television industries. If you are a software engineer, researcher, professor, executive, or entrepreneur, you are in O-1A territory. The criteria and standards differ somewhat between the two categories.",
      },
      {
        type: "h2",
        text: "The Eight O-1A Criteria",
      },
      {
        type: "paragraph",
        text: "The O-1A has eight evidentiary criteria (versus the EB-1A's ten). Petitioners must meet at least three of them, or demonstrate receipt of a major internationally recognized award. The criteria overlap significantly with EB-1A but are not identical:",
      },
      {
        type: "bullets",
        items: [
          "National or international awards for excellence in your field",
          "Membership in associations requiring outstanding achievement",
          "Published material in professional or major media about you",
          "Participation as a judge of the work of others in your field",
          "Original scientific, scholarly, or business-related contributions of major significance",
          "Authorship of scholarly articles in professional journals or major media",
          "Employed in a critical or essential capacity for distinguished organizations",
          "High remuneration relative to others in the field",
        ],
      },
      {
        type: "h2",
        text: "Who Files the O-1A Petition",
      },
      {
        type: "paragraph",
        text: "Unlike the EB-1A, you cannot self-petition for an O-1A. A U.S. employer, agent, or a U.S.-based agent acting on behalf of a foreign employer must file the I-129 petition on your behalf. Most commonly, your employer files it. The employer must also demonstrate that a genuine job opportunity exists for you in the U.S.",
      },
      {
        type: "h2",
        text: "The Advisory Opinion: A Unique O-1A Requirement",
      },
      {
        type: "paragraph",
        text: "O-1A petitions typically require a written advisory opinion from an appropriate peer group, labor organization, or management organization in your field. This is an organization that represents people in your occupation and can speak to your extraordinary ability. In practice, many petitioners obtain a letter from a recognized expert or professional association. The advisory opinion requirement is unique to O-1 (it does not exist for EB-1A) and can add complexity to the process.",
      },
      {
        type: "h2",
        text: "Initial Period and Extensions",
      },
      {
        type: "paragraph",
        text: "The O-1A is initially granted for the period of time needed to accomplish the event or activity, up to three years. It can then be extended in one-year increments, indefinitely, as long as you continue to work in the approved capacity. Many professionals have maintained O-1A status for five, seven, or ten years while their green card applications were pending.",
      },
      {
        type: "callout",
        text: "The O-1A does not have a dual intent doctrine in the same way H-1B does — though USCIS has generally accepted it as consistent with pursuing a green card in parallel. Consult with an attorney on your specific situation.",
      },
    ],
    references: [
      { label: "USCIS — O-1 Visa: Individuals with Extraordinary Ability or Achievement", url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement" },
      { label: "8 C.F.R. § 214.2(o) — O Nonimmigrant Regulations", url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/section-214.2" },
      { label: "USCIS Policy Manual Vol. 2, Part M — O Nonimmigrants", url: "https://www.uscis.gov/policy-manual/volume-2-part-m" },
    ],
    relatedIds: ["o1a-criteria-evidence", "o1a-vs-eb1a", "eb1a-extraordinary-ability-standard"],
  },

  {
    id: "o1a-criteria-evidence",
    title: "O-1A Evidence: What USCIS Actually Wants to See for Each Criterion",
    excerpt:
      "The O-1A shares most of its criteria with the EB-1A — but evidence that works for one doesn't always work for the other. This guide walks through what specifically satisfies each O-1A criterion.",
    category: "O-1A",
    sourceType: "strategy",
    readTime: "16 min",
    tags: ["Evidence Strategy", "Practical"],
    content: [
      {
        type: "paragraph",
        text: "The O-1A and EB-1A share much of their legal DNA, but O-1A adjudications have some notable differences — including the advisory opinion requirement and the fact that a U.S. employer is filing on your behalf. This article focuses specifically on what evidence works for each O-1A criterion, drawn from successful petitions and AAO decisions.",
      },
      {
        type: "h2",
        text: "National or International Awards",
      },
      {
        type: "paragraph",
        text: "The same standard applies as in EB-1A: the award must be for excellence (not just participation), nationally or internationally recognized, and judged by experts. Competitive fellowships — NSF CAREER, Sloan Research Fellowship, MacArthur Fellowship — are strong examples. Patent awards, innovation prizes, and competitive grants from major foundations also qualify with proper documentation of selectivity.",
      },
      {
        type: "h2",
        text: "Membership in Exclusive Associations",
      },
      {
        type: "paragraph",
        text: "Associations must require outstanding achievement as judged by recognized experts. IEEE Fellow, ACM Fellow, NAS membership, and similar designations are clear examples. The petition should include the association's membership requirements and selection process, and documentation confirming your specific membership status.",
      },
      {
        type: "h2",
        text: "Published Media Coverage",
      },
      {
        type: "paragraph",
        text: "The same rule as EB-1A: the coverage must be about you, not just by you or merely mentioning you. The publication must be a professional or major trade or major media outlet. For tech professionals, outlets like Wired, MIT Technology Review, TechCrunch, or IEEE Spectrum are appropriate. Include the full article, the publication's about page showing its readership and industry standing, and if possible, circulation or traffic data.",
      },
      {
        type: "h2",
        text: "Judging the Work of Others",
      },
      {
        type: "paragraph",
        text: "This is one of the most accessible criteria and should be documented meticulously. Include: the original invitation from the conference, journal, or committee; any editorial acknowledgment that you reviewed for them; and if possible, a statement from the organizer confirming the selectivity of reviewers. For program committee roles, include the conference's overall statistics (how many papers submitted, accepted percentage) to demonstrate the prestige of the venue.",
      },
      {
        type: "h2",
        text: "Original Contributions of Major Significance",
      },
      {
        type: "paragraph",
        text: "For the O-1A, USCIS looks for the same core elements as EB-1A: the contribution must be original, and its significance must be demonstrable through evidence — citations, adoption by others, influence on subsequent work, or recognition in press. For business professionals, this can include launching a product that achieved meaningful market adoption, developing a methodology used across the industry, or building a system that materially changed how a company or sector operates.",
      },
      {
        type: "h2",
        text: "Scholarly Articles",
      },
      {
        type: "paragraph",
        text: "Peer-reviewed publications in recognized journals or conference proceedings satisfy this criterion. The emphasis should be on quality and impact rather than volume. Include citation counts and context about the publication venue's selectivity and standing in the field.",
      },
      {
        type: "h2",
        text: "Critical or Essential Role at Distinguished Organizations",
      },
      {
        type: "paragraph",
        text: "For the O-1A, this criterion is particularly relevant because your employer is filing the petition. They must explain in the petition why your role is critical or essential. An employment letter that describes your title and duties is not enough — it needs to explain why your specific expertise is indispensable to the organization and why the position could not be filled by a person of ordinary skill. The organization itself must be distinguished in its field.",
      },
      {
        type: "h2",
        text: "High Remuneration",
      },
      {
        type: "paragraph",
        text: "Document your compensation fully: base salary, bonus, equity, benefits. Then provide comparison data showing how your package compares to the field. Levels.fyi, Radford compensation surveys, Bureau of Labor Statistics Occupational Employment Statistics, and industry-specific surveys are all valid sources. The comparison should be to others at a similar career stage in similar roles — not to the national median for a broad occupation.",
      },
      {
        type: "callout",
        text: "For O-1A, the petition letter drafted by your employer is often the weakest link. The letter must explain not just what you do, but why it constitutes extraordinary ability. Generic employment letters rarely accomplish this.",
      },
    ],
    references: [
      { label: "USCIS — O-1A Criteria Regulations", url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement" },
      { label: "USCIS Policy Manual Vol. 2, Part M — O Nonimmigrants", url: "https://www.uscis.gov/policy-manual/volume-2-part-m" },
      { label: "8 C.F.R. § 214.2(o)(3)(iii) — O-1A Criteria", url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/section-214.2" },
    ],
    relatedIds: ["o1a-complete-guide", "o1a-vs-eb1a", "eb1a-ten-criteria-breakdown"],
  },

  {
    id: "o1a-vs-eb1a",
    title: "O-1A vs. EB-1A: Choosing the Right Visa Strategy for Your Situation",
    excerpt:
      "Both require 'extraordinary ability.' Both evaluate similar criteria. But they serve different purposes and suit different circumstances. This comparison helps you decide which to pursue — and when.",
    category: "O-1A",
    sourceType: "guide",
    readTime: "13 min",
    tags: ["Strategy", "Comparison"],
    content: [
      {
        type: "paragraph",
        text: "The O-1A and EB-1A share a legal DNA: both require extraordinary ability in science, business, education, or athletics, and both evaluate evidence through overlapping criteria. But they are fundamentally different instruments — one grants temporary work authorization, the other grants permanent residence. Choosing between them (or deciding to pursue both) requires understanding what each does and doesn't offer.",
      },
      {
        type: "h2",
        text: "The Key Differences at a Glance",
      },
      {
        type: "bullets",
        items: [
          "O-1A = temporary work visa (nonimmigrant). EB-1A = permanent green card (immigrant petition).",
          "O-1A requires a U.S. employer or agent to sponsor you. EB-1A allows self-petitioning.",
          "O-1A can be approved quickly and extended indefinitely in 1-year increments. EB-1A eventually leads to a green card but takes longer overall.",
          "O-1A does not have a cap or lottery. H-1B has an annual cap with a lottery; EB-1A has no lottery but has a visa number queue.",
          "The evidentiary standards are similar but not identical — evidence that works for one may require adaptation for the other.",
        ],
      },
      {
        type: "h2",
        text: "When to Prioritize the O-1A",
      },
      {
        type: "paragraph",
        text: "The O-1A makes more sense when you need U.S. work authorization quickly and you have a willing employer. If your H-1B lottery didn't come through, if your OPT is expiring, or if you want to start a role at a U.S. company while pursuing a green card in parallel, the O-1A is often the fastest path. It is also useful as a test run — if your O-1A is approved, it is strong evidence that you have a credible EB-1A case.",
      },
      {
        type: "h2",
        text: "When to Prioritize the EB-1A",
      },
      {
        type: "paragraph",
        text: "The EB-1A is the right choice when your goal is permanent residence, you already have valid work authorization, and you don't want to depend on any single employer's willingness to sponsor you. It is also the right choice if you are between jobs or anticipate a career transition, since the self-petition feature means your green card is not tied to your employment relationship.",
      },
      {
        type: "h2",
        text: "The Sequential Strategy: O-1A as a Steppingstone",
      },
      {
        type: "paragraph",
        text: "Many professionals use the O-1A as a bridge while their EB-1A petition is being built or pending. This sequence is common: get to the U.S. on O-1A, spend one to two years building additional EB-1A evidence (more publications, more judging roles, press coverage), then file a strong EB-1A petition. An approved O-1A is not automatic evidence that the EB-1A will be approved — the standards are similar but not identical — but it does demonstrate that USCIS has found your evidence persuasive at least once.",
      },
      {
        type: "h2",
        text: "The Parallel Strategy: Filing Both at Once",
      },
      {
        type: "paragraph",
        text: "Some professionals file an O-1A petition and an EB-1A I-140 simultaneously. This is legal and strategically reasonable if your evidence is strong enough for both. The risk is that a denial on one can create complications for the other, though this is generally manageable with a well-prepared petition. If premium processing is used on both, you can have a decision on both within a few weeks.",
      },
      {
        type: "h2",
        text: "Wait Times and Backlogs",
      },
      {
        type: "paragraph",
        text: "For nationals of most countries, EB-1 priority dates are current or nearly current, meaning there is no meaningful wait time between an approved I-140 and being able to apply for a green card. For Indian nationals, EB-1 wait times have historically been much shorter than EB-2 or EB-3, though they have grown in recent years due to high demand. Checking the monthly Visa Bulletin for your country of birth is essential.",
      },
      {
        type: "callout",
        text: "For Indian or Chinese nationals experiencing long EB-2 or EB-3 backlogs: the EB-1A is often dramatically faster and is well worth the investment of building a strong petition.",
      },
    ],
    references: [
      { label: "USCIS — O-1A Visa Overview", url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement" },
      { label: "USCIS — EB-1 First Preference Overview", url: "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-first-preference-eb-1" },
      { label: "U.S. Department of State — Visa Bulletin", url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" },
    ],
    relatedIds: ["o1a-complete-guide", "eb1a-extraordinary-ability-standard", "eb1a-plain-language-guide"],
  },

  {
    id: "o1a-for-entrepreneurs",
    title: "O-1A for Founders and Entrepreneurs: What Works and What Doesn't",
    excerpt:
      "Entrepreneurs face unique challenges with the O-1A: they need an employer to sponsor them, but they want to run their own company. This guide explains the agent model, what evidence works for founders, and how to structure the petition.",
    category: "O-1A",
    sourceType: "strategy",
    readTime: "14 min",
    tags: ["Founders", "Strategy"],
    content: [
      {
        type: "paragraph",
        text: "The O-1A is one of the most popular visa categories for founders and startup entrepreneurs — but it requires navigating a structural challenge: the O-1A cannot be self-petitioned. An employer or authorized agent must file on your behalf. For someone who wants to run their own company in the U.S., this creates a chicken-and-egg problem. Here's how successful founders resolve it.",
      },
      {
        type: "h2",
        text: "The Agent Model",
      },
      {
        type: "paragraph",
        text: "USCIS allows an 'agent' — a person or entity authorized to act on behalf of multiple employers — to file the O-1A petition. For entrepreneurs, a common structure is to work with an O-1A agent or sponsorship service that files the petition on behalf of the petitioner, while the entrepreneur is employed by or consulting for the sponsor or their own startup. Some immigration attorneys serve as agents directly; others work with third-party agent companies.",
      },
      {
        type: "h2",
        text: "Can You Sponsor Your Own O-1A?",
      },
      {
        type: "paragraph",
        text: "If you have incorporated a U.S. company, that company can potentially petition for you — but you must demonstrate that an independent employer-employee relationship exists. For founders who are also the sole officer and director, USCIS will scrutinize whether someone truly exercises control over your work. The stronger your board, the more investors are involved, and the more the company operates independently of you as a sole actor, the more credible the employer-employee relationship becomes.",
      },
      {
        type: "h2",
        text: "Evidence That Works for Founders",
      },
      {
        type: "bullets",
        items: [
          "Revenue, user growth, or funding rounds that demonstrate commercial success (Criterion 5 — original contributions of major significance)",
          "Press coverage in recognized tech or business media about you or your company (Criterion 3 — published media)",
          "Invitations to speak at recognized conferences, accelerator demo days, or investor events (Criterion 1, with evidence of prestige)",
          "Judging roles at hackathons, pitch competitions, or startup competitions with recognized sponsorship (Criterion 4)",
          "Significant venture capital funding, especially from well-known funds — as evidence of high remuneration or business impact",
          "Membership in selective accelerator programs (YC, Techstars, a16z Future Founders) — though these must be carefully framed, as membership alone may not satisfy Criterion 2",
        ],
      },
      {
        type: "h2",
        text: "The Critical Role Criterion for Founders",
      },
      {
        type: "paragraph",
        text: "Criterion 7 for O-1A (critical or essential role at a distinguished organization) can be a natural fit for founders — but requires careful framing. The organization must be 'distinguished,' which for startups usually means demonstrable traction: significant funding, press recognition, industry awards, or notable customers. A pre-revenue, pre-launch startup with no external recognition is unlikely to qualify as 'distinguished.'",
      },
      {
        type: "callout",
        text: "The most common mistake founders make: building their entire case around their own startup without enough external validation. USCIS wants to see that the field — not just you — recognizes your extraordinary ability.",
      },
      {
        type: "h2",
        text: "Timing Your O-1A as a Founder",
      },
      {
        type: "paragraph",
        text: "The ideal time to file an O-1A as a founder is after you have sufficient external validation: a meaningful funding round, press coverage in recognized outlets, industry awards, or recognized program participation. Filing too early, before you have that external recognition, increases the risk of denial and may actually harm your subsequent EB-1A petition if USCIS later reviews the denial.",
      },
    ],
    references: [
      { label: "USCIS — O-1 Visa: Petitioners and Agents", url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement" },
      { label: "8 C.F.R. § 214.2(o)(2)(iv) — Agent as Petitioner", url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/section-214.2" },
      { label: "USCIS Policy Manual Vol. 2, Part M — O Nonimmigrant Classification", url: "https://www.uscis.gov/policy-manual/volume-2-part-m" },
    ],
    relatedIds: ["o1a-complete-guide", "o1a-vs-eb1a", "o1a-criteria-evidence"],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // EB-2 NIW
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "niw-complete-overview",
    title: "EB-2 National Interest Waiver: The Complete Self-Petition Guide",
    excerpt:
      "The NIW allows highly qualified professionals to obtain a green card without employer sponsorship by demonstrating that their work serves the national interest of the United States. Here's what that actually means.",
    category: "EB-2 NIW",
    sourceType: "official",
    readTime: "16 min",
    tags: ["Must Read", "Foundational"],
    content: [
      {
        type: "paragraph",
        text: "The EB-2 National Interest Waiver is one of the most misunderstood green card categories. Many professionals dismiss it as reserved for academics or government researchers. In reality, it is available to a broad range of professionals in science, technology, business, law, education, and the arts — as long as they can demonstrate that their work is in the national interest of the United States and that it would be beneficial to waive the normal requirement of a job offer.",
      },
      {
        type: "h2",
        text: "What EB-2 NIW Requires: The Dhanasar Framework",
      },
      {
        type: "paragraph",
        text: "In 2016, the USCIS Administrative Appeals Office issued a landmark decision in Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016), which established the current three-part test for NIW petitions. This replaced the older National Interest Waiver standard and opened the category to a significantly broader range of professionals.",
      },
      {
        type: "h3",
        text: "Prong 1: Substantial Merit and National Importance",
      },
      {
        type: "paragraph",
        text: "The proposed endeavor must have both substantial merit and national importance. Merit means the work has genuine professional or business value — not just personal benefit. National importance means the scope and potential impact of the endeavor is beyond a local or regional level. Improving public health, advancing STEM research, strengthening national security, growing the economy, or solving a significant societal challenge can all qualify. Critically, the AAO in Dhanasar stated that even commercial endeavors can have national importance if the impact is broadly shared.",
      },
      {
        type: "h3",
        text: "Prong 2: Well-Positioned to Advance the Endeavor",
      },
      {
        type: "paragraph",
        text: "The petitioner must be well-positioned to advance the proposed endeavor. This is where your credentials, expertise, track record, and institutional resources matter. Evidence includes: advanced degrees or exceptional expertise, publications in the field, past successes in similar work, letters from experts confirming your qualifications, and institutional support (grants, appointments, affiliations) that show you have the resources to succeed.",
      },
      {
        type: "h3",
        text: "Prong 3: On Balance, Beneficial to Waive the Job Offer",
      },
      {
        type: "paragraph",
        text: "The final prong asks whether waiving the normal job offer and labor certification requirement is in the national interest. This is usually satisfied when: (a) there is a clear national interest in your endeavor, (b) your contributions would be difficult to replicate if you pursued them under the constraints of a specific employer, or (c) the field you work in benefits from having flexible, independent professionals rather than employer-bound workers.",
      },
      {
        type: "h2",
        text: "Who Typically Qualifies for NIW",
      },
      {
        type: "bullets",
        items: [
          "Researchers and academics in STEM fields, especially those with external funding or significant publications",
          "Physicians who commit to serving in underserved or medically underserved areas",
          "Engineers and technologists working on critical infrastructure, national security, or advanced manufacturing",
          "Entrepreneurs whose companies create jobs, advance technology, or solve significant public problems",
          "Educators and social scientists working on nationally significant challenges",
          "Business professionals whose work contributes significantly to U.S. economic growth or competitiveness",
        ],
      },
      {
        type: "h2",
        text: "NIW vs. EB-1A: How to Choose",
      },
      {
        type: "paragraph",
        text: "Both NIW and EB-1A allow self-petitioning. The EB-1A has a higher evidentiary burden (extraordinary ability) but does not require demonstrating national importance — it is purely about the level of your recognition. The NIW has a more accessible evidentiary threshold but requires a substantive argument about national interest. Professionals who are very prominent in their fields but work in relatively niche areas may find EB-1A stronger. Professionals whose work has clear societal impact but who are not yet internationally acclaimed may find NIW more accessible.",
      },
      {
        type: "callout",
        text: "It is entirely possible to file both an EB-1A I-140 and an EB-2 NIW I-140 simultaneously. If one is approved, the other can be abandoned. Many professionals do this to maximize their chances.",
      },
    ],
    references: [
      { label: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)", url: "https://www.uscis.gov/sites/default/files/err/B5%20-%20Members%20of%20the%20Professions%20Holding%20Advanced%20Degrees%20or%20Aliens%20of%20Exceptional%20Ability/Decisions_Issued_in_2016/DEC012016_01B5203.pdf" },
      { label: "USCIS — EB-2 National Interest Waiver", url: "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-second-preference-eb-2" },
      { label: "USCIS Policy Manual Vol. 6, Part F, Ch. 5 — NIW", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-5" },
    ],
    relatedIds: ["niw-dhanasar-framework", "eb1a-extraordinary-ability-standard", "eb1a-plain-language-guide"],
  },

  {
    id: "niw-dhanasar-framework",
    title: "The Dhanasar Framework Explained: How USCIS Evaluates NIW Petitions Today",
    excerpt:
      "The 2016 Dhanasar decision rewrote the rules for National Interest Waivers. This deep-dive explains what the three-part test means in practice, with real examples of how each prong is satisfied.",
    category: "EB-2 NIW",
    sourceType: "legal",
    readTime: "17 min",
    tags: ["Deep Dive", "Legal Analysis"],
    content: [
      {
        type: "paragraph",
        text: "Before 2016, the NIW standard was frustratingly vague — and frustratingly narrow. The test that preceded Dhanasar (established in Matter of New York State Dep't of Transportation, 1998) required petitioners to show intrinsic merit, national in scope, and why waiving the job offer requirement served the national interest better than the existing labor market system. In practice, this restricted successful petitions to a narrow set of professions.",
      },
      {
        type: "paragraph",
        text: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016), replaced this framework with a more flexible and nuanced three-part test that has expanded the NIW category considerably. Here is what each prong means in practice.",
      },
      {
        type: "h2",
        text: "Prong 1 In Practice: Establishing Substantial Merit and National Importance",
      },
      {
        type: "paragraph",
        text: "Substantial merit is the easier half of this prong. USCIS recognizes merit in areas as diverse as scientific research, medicine, technology, education, business, and the arts. The work does not need to be life-saving or uniquely consequential — it needs to have genuine professional or social value.",
      },
      {
        type: "paragraph",
        text: "National importance is trickier. Dhanasar emphasized that the potential impact must extend beyond a local area or region and must have broad implications for the field or the nation. The AAO specifically noted that even entrepreneurial endeavors — building companies, creating jobs, developing products — can satisfy this prong if the impact is significant and broadly shared.",
      },
      {
        type: "bullets",
        items: [
          "Research that could advance treatment of a widespread disease → strong national importance",
          "Software infrastructure used by millions of Americans → strong national importance",
          "Local restaurant operations → insufficient scope",
          "A teaching career at a nationally recognized institution addressing educational equity → potentially sufficient with strong framing",
        ],
      },
      {
        type: "h2",
        text: "Prong 2 In Practice: Demonstrating You Are Well-Positioned",
      },
      {
        type: "paragraph",
        text: "This prong is about your qualifications relative to the endeavor — not about your general eminence. Dhanasar introduced a useful formulation: the question is not whether you are extraordinary in general, but whether you are the right person to advance this specific endeavor. This means your petition letter must connect your background, credentials, and track record directly to the proposed work.",
      },
      {
        type: "paragraph",
        text: "Evidence that strengthens Prong 2: advanced degrees directly relevant to the proposed work; publications, patents, or industry recognition in the specific area; letters from established experts in the field confirming your qualifications; past grants or institutional support; a track record of past success in similar endeavors; specific resources or access (lab access, industry partnerships, institutional affiliation) that position you to succeed.",
      },
      {
        type: "h2",
        text: "Prong 3 In Practice: Making the Case for Waiving the Job Offer",
      },
      {
        type: "paragraph",
        text: "This prong is often called the 'balance of equities' prong. The Dhanasar decision identified two key ways to satisfy it:",
      },
      {
        type: "numbered",
        items: [
          "The urgency or importance of the national benefit is so great that the U.S. cannot wait for the normal labor certification process, OR",
          "The petitioner's unique ability makes them so well-suited to advance the national interest that requiring a specific job offer would unduly constrain their ability to do so.",
        ],
      },
      {
        type: "paragraph",
        text: "For researchers, the argument is often that their work is best served by academic or self-directed independence — not tied to a specific employer. For entrepreneurs, the argument is that their work requires flexibility to build and pivot, not the constraints of a particular job offer. For freelance professionals, it may be that their ability to serve multiple clients or organizations is itself what makes their work nationally beneficial.",
      },
      {
        type: "h2",
        text: "Common Mistakes in NIW Petitions",
      },
      {
        type: "bullets",
        items: [
          "Treating Prong 1 as satisfied by simply naming a broadly important field (AI, climate, healthcare) without specific evidence of the proposed endeavor's national impact",
          "Failing to connect your specific background to the proposed work in Prong 2 — general excellence without specific fit",
          "Writing a generic Prong 3 argument that doesn't explain why the waiver — specifically — benefits the U.S.",
          "Not including a detailed description of the proposed endeavor. USCIS needs to know what you plan to do, not just your field.",
        ],
      },
      {
        type: "callout",
        text: "The petition letter in an NIW petition is arguably more important than in an EB-1A petition. The Dhanasar test is fundamentally an argument that must be made — not merely demonstrated through documents.",
      },
    ],
    references: [
      { label: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016) — Full Decision", url: "https://www.uscis.gov/sites/default/files/err/B5%20-%20Members%20of%20the%20Professions%20Holding%20Advanced%20Degrees%20or%20Aliens%20of%20Exceptional%20Ability/Decisions_Issued_in_2016/DEC012016_01B5203.pdf" },
      { label: "USCIS Policy Manual Vol. 6, Part F, Ch. 5 — National Interest Waiver", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-5" },
      { label: "Matter of NYSDOT, 22 I&N Dec. 215 (AAO 1998) — Prior Standard", url: "https://www.uscis.gov/administrative-appeals/aao-decisions" },
    ],
    relatedIds: ["niw-complete-overview", "eb1a-extraordinary-ability-standard", "eb1a-plain-language-guide"],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Strategy
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "strategy-rfe-response",
    title: "Receiving an EB-1A or O-1A RFE: What It Means and How to Respond",
    excerpt:
      "A Request for Evidence is not a denial — but how you respond to it will largely determine the outcome. This guide explains what triggers RFEs, how to interpret them, and how to build a response that wins.",
    category: "Strategy",
    sourceType: "strategy",
    readTime: "18 min",
    tags: ["RFE", "Advanced"],
    content: [
      {
        type: "paragraph",
        text: "Receiving a Request for Evidence is stressful. But it is worth understanding that an RFE is, in most cases, an officer telling you: 'I think this case might be approvable, but I need more information.' A well-crafted response to an RFE succeeds more often than it fails. A poorly crafted one confirms the officer's doubts.",
      },
      {
        type: "h2",
        text: "Why RFEs Are Issued",
      },
      {
        type: "paragraph",
        text: "USCIS is required to issue an RFE (rather than deny outright) when it believes that additional evidence or explanation could make the petition approvable. Under current guidance, officers should not deny a petition without first giving the petitioner a chance to address any evidentiary gaps — unless the petition is facially insufficient. In practice, an RFE usually means one of three things: a criterion is technically met but the evidence is thin; the officer is not familiar with the field and needs more context; or the overall weight of evidence is insufficient and the officer wants to see more before deciding.",
      },
      {
        type: "h2",
        text: "Reading the RFE Carefully",
      },
      {
        type: "paragraph",
        text: "Before drafting a response, read the RFE slowly and parse it precisely. RFEs are legal documents. They will specify: (1) which criteria or aspects of the petition are at issue; (2) what specific evidence or explanation the officer is requesting; and (3) the deadline for response (typically 87 days, though the RFE will specify). Do not respond to what you think the officer meant — respond to what they actually said. Officers sometimes cite misunderstandings of the evidence that you can directly address with clarification and re-documentation.",
      },
      {
        type: "h2",
        text: "The Response Strategy: Don't Just Add More of the Same",
      },
      {
        type: "paragraph",
        text: "The most common mistake in RFE responses is treating it as an opportunity to send more documents of the same type. If the officer said your contribution evidence was insufficient, sending five more papers without explaining why they demonstrate major significance will not help. Your response must directly address the officer's stated concern with new arguments, new evidence, and new expert opinion.",
      },
      {
        type: "h2",
        text: "What a Strong RFE Response Includes",
      },
      {
        type: "bullets",
        items: [
          "A cover letter that organizes the response and explicitly addresses each RFE point by point",
          "New primary evidence you did not include in the original petition — awards letters, judging invitations, salary data",
          "Updated recommendation letters that speak directly to the issues the officer raised",
          "Expert declarations from recognized leaders in your field explaining the significance of your work in terms an adjudicator can understand",
          "Published secondary sources that corroborate your claims about the prestige of venues, the selectivity of awards, or the impact of your contributions",
          "Statistical or comparative context: how many papers are published per year in your field, what percent of authors have your citation count, etc.",
        ],
      },
      {
        type: "h2",
        text: "The Role of Expert Declarations",
      },
      {
        type: "paragraph",
        text: "Expert declarations are often the single most powerful tool in an RFE response. An expert declaration is a sworn statement from a recognized authority in your field who explains, in concrete terms, why your work is significant and why you qualify as extraordinary. The most effective declarations are specific (they reference your actual work, not just your general credentials), comparative (they explain how your achievements compare to peers), and credentialed (the declarant themselves is a recognized expert whose opinion carries weight).",
      },
      {
        type: "h2",
        text: "Responding to a 'Totality of Evidence' RFE",
      },
      {
        type: "paragraph",
        text: "Sometimes an RFE is not about specific criteria but about the overall weight of evidence — the officer is saying that even though you may technically meet three criteria, the sum of your evidence does not persuade them of sustained national acclaim. This type of RFE is the hardest to respond to because it requires a qualitative argument, not just more documents. The response needs to make a coherent narrative case: here is what I have accomplished, here is what the field thinks of it, and here is why that adds up to the legal standard.",
      },
      {
        type: "callout",
        text: "The deadline on an RFE is firm — missing it results in an automatic denial. Build your timeline backward from the due date and give yourself at least three weeks to draft, review, and finalize the response.",
      },
    ],
    references: [
      { label: "USCIS — Requests for Evidence (RFE) Policy", url: "https://www.uscis.gov/policy-manual/volume-1-part-e-chapter-6" },
      { label: "USCIS Policy Manual Vol. 6, Part F, Ch. 2 — Final Merits Determination", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2" },
      { label: "8 C.F.R. § 103.2(b)(8) — RFE Regulations", url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-103/section-103.2" },
    ],
    relatedIds: ["eb1a-policy-manual-guide", "eb1a-ten-criteria-breakdown", "strategy-media-coverage"],
  },

  {
    id: "strategy-media-coverage",
    title: "How to Earn Legitimate Press Coverage That Strengthens Your Visa Petition",
    excerpt:
      "Published media about you is one of the most powerful EB-1A and O-1A criteria — and one of the most misunderstood. This guide explains what counts, what doesn't, and how to earn it ethically and strategically.",
    category: "Strategy",
    sourceType: "strategy",
    readTime: "14 min",
    tags: ["Evidence Building", "Media"],
    content: [
      {
        type: "paragraph",
        text: "Criterion 3 for both EB-1A and O-1A covers published material about you in professional or major trade publications, or major media. It is one of the most impactful criteria — a feature in a widely read outlet is compelling evidence of recognition — and it is one of the most frequently misunderstood.",
      },
      {
        type: "h2",
        text: "What Actually Counts",
      },
      {
        type: "paragraph",
        text: "The article, story, or report must be about you or your work specifically. A quote in a broader story doesn't satisfy the criterion by itself (though it is useful supplemental context). The outlet must be a professional publication, a major trade publication, or major media — not your company blog, not a Medium post you wrote, and not an article in a publication created specifically for visa applicants.",
      },
      {
        type: "bullets",
        items: [
          "Feature profiles in outlets like Wired, MIT Technology Review, The Atlantic, IEEE Spectrum, Nature, Science — strong",
          "Industry profiles in respected trade publications (VentureBeat, TechCrunch, Forbes, Fast Company) — strong with documentation of outlet's standing",
          "University press releases or institutional news articles — generally insufficient as standalone evidence",
          "Blog posts, Medium articles, or posts on forums — insufficient",
          "Interviews or podcasts — not covered by this criterion (though useful elsewhere)",
          "Conference proceedings or journals — this evidence belongs under scholarly articles (Criterion 6), not media coverage",
        ],
      },
      {
        type: "h2",
        text: "How Press Coverage Is Evaluated",
      },
      {
        type: "paragraph",
        text: "Along with the article itself, your petition must include documentation of the publication's standing. This means: the publication's own about page or media kit describing its readership, circulation, or industry standing; third-party sources (Alexa rankings, SimilarWeb traffic data, journalism industry data) that confirm the outlet's prominence; and if the publication is a niche trade journal, expert letters confirming its prestige within the field.",
      },
      {
        type: "h2",
        text: "Earned Media vs. Paid Media",
      },
      {
        type: "paragraph",
        text: "Media coverage that you or your PR firm paid for — advertorials, sponsored content, paid placements — does not satisfy this criterion. USCIS specifically looks for editorial coverage, meaning the publication independently decided your work was newsworthy enough to cover. This distinction matters a great deal, and USCIS officers are increasingly attentive to it.",
      },
      {
        type: "h2",
        text: "How to Generate Genuine Media Coverage",
      },
      {
        type: "paragraph",
        text: "Legitimate press coverage is earned, not bought. But 'earned' doesn't mean passive. Proactive steps that lead to genuine coverage include: writing thoughtful perspective pieces for trade publications (these are editorial, not paid); being available and responsive to journalists who cover your field (reporters need expert sources); having your institution's communications office proactively pitch your work to relevant outlets; presenting at conferences where journalists attend; and publishing research in journals that routinely get press coverage.",
      },
      {
        type: "callout",
        text: "A single well-placed feature in a recognized outlet is worth more than ten mentions in low-profile publications. Quality matters far more than quantity for this criterion.",
      },
      {
        type: "h2",
        text: "What to Do If You Have No Press Coverage",
      },
      {
        type: "paragraph",
        text: "If you have no press coverage yet and are building your petition, this is one of the most time-sensitive things to work on — because good press takes months to develop. Identify two or three outlets that are realistic targets for your specific field and work. Reach out to their editors with a clear pitch: what are you working on, why is it significant, and why now? Even one piece of genuine coverage in a respected publication can meaningfully strengthen a petition.",
      },
    ],
    references: [
      { label: "8 C.F.R. § 204.5(h)(3)(iii) — Published Material Criterion", url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-204/section-204.5" },
      { label: "USCIS Policy Manual Vol. 6, Part F — Evidentiary Standards", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2" },
      { label: "AAO Non-Precedent Decisions on Media Criterion", url: "https://www.uscis.gov/administrative-appeals/aao-decisions/non-precedent-decisions" },
    ],
    relatedIds: ["eb1a-building-evidence-before-lawyer", "eb1a-ten-criteria-breakdown", "strategy-rfe-response"],
  },

  {
    id: "strategy-recommendation-letters",
    title: "How to Secure Recommendation Letters That Actually Win EB-1A Cases",
    excerpt:
      "Recommendation letters are not a checkbox — they are often the most persuasive documents in an extraordinary ability petition. This guide explains what makes a letter powerful, and how to cultivate the writers who can deliver it.",
    category: "Strategy",
    sourceType: "strategy",
    readTime: "15 min",
    tags: ["Evidence Building", "Must Read"],
    content: [
      {
        type: "paragraph",
        text: "Recommendation letters are not listed among the ten EB-1A criteria. But they are consistently described by practitioners as one of the most important components of a successful petition. This is because the letter writers do something that no document can do on its own: they translate technical achievements into plain-language persuasion that a non-expert adjudicator can understand and evaluate.",
      },
      {
        type: "h2",
        text: "Why Letters Matter So Much",
      },
      {
        type: "paragraph",
        text: "An adjudicator evaluating your EB-1A petition may have no expertise in your field. They need to understand: why your citation count is exceptional, why the journal you published in is prestigious, why the award you received is competitive. Your petition letter explains this — but a letter from a recognized, credentialed expert in your field carries far more authority. When a Nobel laureate or a leading professor says your work is extraordinary, that is a form of evidence USCIS weights heavily.",
      },
      {
        type: "h2",
        text: "The Three Types of Recommenders",
      },
      {
        type: "h3",
        text: "Type 1: Independent Experts Who Know Your Work",
      },
      {
        type: "paragraph",
        text: "These are people who have no formal relationship with you — not your employer, not a close collaborator — but who know your work well enough to speak to its significance. Perhaps they cited your paper, they reviewed your work, they encountered your open-source project, or they attended a talk you gave. Their independence makes their opinion highly credible to USCIS. They are the most valuable type of recommender.",
      },
      {
        type: "h3",
        text: "Type 2: Independent Experts Who Don't Know Your Work Directly",
      },
      {
        type: "paragraph",
        text: "These are eminent figures in your field who can speak to the general standards of extraordinary ability in the field and place your credentials in context, even if they haven't collaborated with you. These letters are valuable for establishing field context but less valuable for speaking to your specific contributions. They should be balanced with letters from people who actually know your work.",
      },
      {
        type: "h3",
        text: "Type 3: Dependent Recommenders (Employers, Supervisors, Collaborators)",
      },
      {
        type: "paragraph",
        text: "These people have a relationship with you that could create bias. USCIS weighs their letters less heavily. Including one or two is acceptable and can be useful for confirming your role and contributions, but a petition built entirely on letters from people who work for or with you is significantly weaker than one with a majority of independent recommenders.",
      },
      {
        type: "h2",
        text: "What Makes a Letter Effective",
      },
      {
        type: "bullets",
        items: [
          "The writer's own credentials are clearly established — their own title, affiliation, and field recognition",
          "The writer explains how they know your work — specifically, not vaguely",
          "The letter speaks to specific achievements, not just general praise",
          "The writer places your work in field context: what the standard is in the field, and how you exceed it",
          "The writer explicitly addresses the 'extraordinary ability' standard — that you are among a small percentage at the top of your field",
          "The letter is written in the writer's own voice, not clearly drafted by you and signed",
        ],
      },
      {
        type: "h2",
        text: "How to Ask for a Letter",
      },
      {
        type: "paragraph",
        text: "Most recommenders are willing but busy. Make the ask easy: send a brief note explaining your petition, attach a summary of your key achievements and the criteria you are claiming, and offer to provide a draft if they prefer (this is standard practice and USCIS is aware of it — what matters is that the final letter is accurate and reflects their genuine views). Give them at least four weeks. Follow up once at the two-week mark if you haven't heard back.",
      },
      {
        type: "callout",
        text: "Six to eight strong letters from a mix of independent and dependent recommenders is a reasonable target for most petitions. More than ten letters rarely adds value and can dilute the impact of the strongest ones.",
      },
      {
        type: "h2",
        text: "Who Should Not Write Your Letters",
      },
      {
        type: "bullets",
        items: [
          "Famous people who don't actually know your work — a name that everyone recognizes but a letter that says nothing specific is a waste",
          "People who are subordinate to you — their admiration for you may be genuine but USCIS will discount it heavily",
          "People who make sweeping claims without specific evidence — 'she is the best in the world' unsupported by anything specific is unhelpful",
        ],
      },
    ],
    references: [
      { label: "USCIS Policy Manual Vol. 6, Part F, Ch. 2 — Evidence Evaluation", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2" },
      { label: "8 C.F.R. § 204.5(h)(3) — EB-1A Regulatory Criteria", url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-204/section-204.5" },
    ],
    relatedIds: ["eb1a-building-evidence-before-lawyer", "strategy-rfe-response", "eb1a-ten-criteria-breakdown"],
  },
];
