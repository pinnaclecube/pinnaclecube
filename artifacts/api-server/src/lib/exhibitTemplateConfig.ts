/**
 * exhibitTemplateConfig.ts — Pinnacle³
 *
 * Master configuration for petition exhibit generation.
 * Defines system prompts, document type structures, and per-criterion
 * metadata (CFR citations, key elements, table types) for EB-1A, NIW, and O-1A.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CriteriaConfig {
  cfr: string;
  requirement: string;
  keyElements: string[];
  tableType: string;
  figureTypes: string[];
}

export interface VisaCategoryConfig {
  fullName: string;
  standardOfProof: string;
  regulatoryBase: string;
  criteria: Record<string, CriteriaConfig>;
}

export interface ExhibitGenerationConfig {
  baseSystemPrompt: string;
  documentTypes: {
    mainDocument: { systemPrompt: string };
    indexExhibit: { systemPrompt: string };
    subExhibit: { systemPrompt: string };
  };
  visaCategories: Record<string, VisaCategoryConfig>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export const EXHIBIT_GENERATION_CONFIG: ExhibitGenerationConfig = {

  baseSystemPrompt: `You are a senior US immigration attorney with 20 years of
experience preparing EB-1A, NIW, and O-1A petitions. You write at the level of
Herman Dubin, Cyrus Mehta, or Chris Ingram — precise, authoritative, and
structured for USCIS adjudicators who are pressed for time.

Your documents must:
- Cite the specific CFR regulation for every criterion
- Use formal legal language throughout — never casual or conversational
- Capture EVERY piece of evidence provided — never summarize away a specific fact
- Preemptively address weaknesses before USCIS raises them in an RFE
- Explicitly address the preponderance of evidence standard
- Be structured so an adjudicator can navigate quickly
- Include data tables wherever comparative metrics exist
- Insert figure placeholders in format: *Figure [X][N]-[num]: [description]*
- Reference specific exhibit numbers and sub-exhibit numbers precisely
- Never fabricate evidence — if evidence is thin, say so in the gap analysis`,

  documentTypes: {
    mainDocument: {
      systemPrompt: `Generate a MAIN CRITERION DOCUMENT for a USCIS petition.
This is the primary legal argument the adjudicating officer reads first.
Use this exact six-section structure:

HEADER: [Criterion Name] — [Client Full Name]
SUBHEADER: [CFR Citation]

I. OVERVIEW
2-3 paragraphs establishing satisfaction of this criterion. Reference exhibit
numbers. State total count of evidence items. Name specific fields of expertise.

II. NATURE AND SCOPE OF WORK
Technical/professional nature of the evidence. Bullet points for subject areas.
Connect evidence to the broader field. Reference prestigious affiliations explicitly.

III. SATISFACTION OF REGULATORY REQUIREMENTS
Open: "Under [CFR], the petitioner must demonstrate [requirement]."
Subsection A: Primary element of the criterion
Subsection B: Technical/scholarly/professional nature of evidence
Subsection C: Formal process, dissemination, or verification
Each subsection: 2-4 paragraphs with specific evidence citations.

IV. SUSTAINED RECORD AND PATTERN OF CONTRIBUTION
Establish evidence represents a pattern not an isolated incident.
Group into 2-4 thematic categories with bold headers.

V. GAP ANALYSIS AND RISK ASSESSMENT
NEVER omit this section. Identify 2-4 potential weaknesses.
For each: "Potential Concern: [X]. Response: [Y]."
End: "Notwithstanding these considerations, the totality of the evidence
establishes by a preponderance that [client] satisfies this criterion."

VI. CONCLUSION
Restate CFR requirement. Confirm satisfaction with exhibit references.
End: "Accordingly, [Client Name] satisfies the criterion under [CFR citation]."`,
    },

    indexExhibit: {
      systemPrompt: `Generate the INDEX EXHIBIT (e.g., Exhibit A1) for a criterion.
This orients the adjudicator to the full evidence package for this criterion.
Use this exact structure:

HEADER: Exhibit [X]1: [Descriptive Title] — [Client Full Name]
Beneficiary: [Full Name]
Criterion: [Criterion Name]
Regulation: [CFR Citation]

I. PURPOSE OF THIS EXHIBIT
II. SUMMARY OF [CRITERION TYPE] — include total count in bold
III. INDEX TABLE — use tableType from config to determine columns:
  articles: # | Title | Year | Venue | Nature | Authors
  awards: # | Award Name | Organization | Year | Level | Selection Basis
  judging: # | Organization | Role | Date | Scope | Inviting Party
  salary: # | Position | Employer | Period | Compensation | Benchmark
  memberships: # | Organization | Level | Year | Selection Criteria | Exhibit
  press: # | Publication | Title | Date | Reach | Subject
  roles: # | Organization | Role | Period | Scope | Revenue/Scale
  contributions: # | Contribution | Impact | Year | Adoption | Exhibit
IV. THEMATIC ANALYSIS — 2-4 subsections A, B, C
V. EVIDENCE OF PROCESS AND DISSEMINATION
VI. RELEVANCE TO THE FIELD
VII. CONCLUSION — reference all sub-exhibits by number`,
    },

    subExhibit: {
      systemPrompt: `Generate an INDIVIDUAL SUB-EXHIBIT for one piece of evidence.
This must stand alone as proof of one evidence item.

HEADER: Exhibit [X][N]
[Descriptive title of this specific evidence item]
Beneficiary: [Full Name] | Criterion: [Name] | Regulation: [CFR]

I. PURPOSE OF THIS EXHIBIT
II. NATURE OF THE EVIDENCE SUBMITTED — bullet list of contents
III. RELEVANCE TO THE FIELD — 3-5 specific bullets
IV. SUMMARY STATEMENT — 1 paragraph with CFR citation

MAIN BODY — adapt heading to evidence type:
Articles: Overview | Technical Nature | Nature of Contribution |
  Evidence of Authorship | Relevance and Importance
Awards: Nature and Prestige | Selection Process | Field Significance |
  Evidence of Receipt
Judging: Nature of Role | Scope and Selectivity | Evidence of Invitation |
  Significance of Event
Salary: Compensation Structure | Benchmark Comparison WITH TABLE |
  Industry Context | Evidence of Remuneration
Press: Publication Overview | Nature of Coverage | Subjects Addressed |
  Evidence of Publication

Insert figure placeholders where data supports a chart:
*Figure [X][N]-1: [descriptive title]*

CLOSE WITH:
Exhibit [X][N].1 — [Primary Document]: description
Exhibit [X][N].2 — [Proof Document]: description
Exhibit [X][N].3 — Technical and Industry Context: 2-4 paragraphs + figure placeholder`,
    },
  },

  visaCategories: {
    EB1A: {
      fullName: "Employment-Based First Preference Extraordinary Ability (EB-1A)",
      standardOfProof: "preponderance of the evidence",
      regulatoryBase: "8 CFR § 204.5(h)",
      criteria: {
        "Extraordinary Ability Awards": {
          cfr: "8 CFR § 204.5(h)(3)(i)",
          requirement:
            "Documentation of receipt of lesser nationally or internationally recognized prizes or awards for excellence in the field",
          keyElements: [
            "national or international recognition",
            "excellence in the field",
            "selectivity of award process",
          ],
          tableType: "awards",
          figureTypes: ["award prestige tier comparison", "selection rate visualization"],
        },
        "Membership in Associations": {
          cfr: "8 CFR § 204.5(h)(3)(ii)",
          requirement:
            "Documentation of membership in associations which require outstanding achievements of their members as judged by recognized experts",
          keyElements: [
            "outstanding achievement requirement",
            "judged by recognized experts",
            "selectivity of membership",
          ],
          tableType: "memberships",
          figureTypes: ["membership selectivity comparison", "organization prestige tier"],
        },
        "Published Material About the Alien": {
          cfr: "8 CFR § 204.5(h)(3)(iii)",
          requirement:
            "Published material about the alien in professional or major trade publications or other major media relating to the alien's work in the field",
          keyElements: [
            "material is about the alien",
            "professional or major media",
            "circulation and reach",
            "relates to the alien's work in the field",
          ],
          tableType: "press",
          figureTypes: ["publication reach comparison", "media coverage timeline"],
        },
        "Judge of Others Work": {
          cfr: "8 CFR § 204.5(h)(3)(iv)",
          requirement:
            "Evidence of participation as a judge of the work of others in the same or an allied field",
          keyElements: [
            "formal judging role",
            "same or allied field",
            "invited participation",
            "scope of judging activity",
          ],
          tableType: "judging",
          figureTypes: ["judging scope visualization", "panel composition chart"],
        },
        "Original Contributions": {
          cfr: "8 CFR § 204.5(h)(3)(v)",
          requirement:
            "Evidence of original scientific scholarly artistic athletic or business-related contributions of major significance in the field",
          keyElements: [
            "originality of contribution",
            "major significance",
            "impact on the field",
            "adoption or recognition by others",
          ],
          tableType: "contributions",
          figureTypes: [
            "impact measurement chart",
            "adoption and citation trend",
            "field influence diagram",
          ],
        },
        "Scholarly Articles": {
          cfr: "8 CFR § 204.5(h)(3)(vi)",
          requirement:
            "Evidence of authorship of scholarly articles in the field in professional or major trade publications or other major media",
          keyElements: [
            "authorship attribution",
            "scholarly and technical nature",
            "professional publication venue",
            "relevance to the field",
          ],
          tableType: "articles",
          figureTypes: [
            "publication timeline",
            "citation impact chart",
            "venue prestige comparison",
          ],
        },
        "Artistic Exhibitions": {
          cfr: "8 CFR § 204.5(h)(3)(vii)",
          requirement:
            "Evidence of display of the alien's work in the field at artistic exhibitions or showcases",
          keyElements: [
            "display of work",
            "artistic exhibitions or showcases",
            "field recognition",
          ],
          tableType: "exhibitions",
          figureTypes: ["exhibition prestige comparison", "geographic reach map"],
        },
        "Leading or Critical Role": {
          cfr: "8 CFR § 204.5(h)(3)(viii)",
          requirement:
            "Evidence of performance in a leading or critical role for organizations or establishments that have a distinguished reputation",
          keyElements: [
            "leading or critical role",
            "distinguished reputation of organization",
            "scope of impact",
            "revenue and scale of organization",
          ],
          tableType: "roles",
          figureTypes: [
            "organization revenue and scale chart",
            "role scope diagram",
            "team and department size",
          ],
        },
        "High Salary": {
          cfr: "8 CFR § 204.5(h)(3)(ix)",
          requirement:
            "Evidence of commanding a high salary or other significantly high remuneration in relation to others in the field",
          keyElements: [
            "high salary relative to peers",
            "comparison to others in the field",
            "BLS or OES benchmark data",
            "geographic and industry context",
          ],
          tableType: "salary",
          figureTypes: [
            "salary percentile bar chart",
            "compensation vs BLS benchmark",
            "year over year compensation growth",
          ],
        },
        "Commercial Success": {
          cfr: "8 CFR § 204.5(h)(3)(x)",
          requirement:
            "Evidence of commercial successes in the performing arts as shown by box office receipts or record sales",
          keyElements: [
            "commercial success",
            "performing arts",
            "box office or sales figures",
            "comparison to peers",
          ],
          tableType: "commercial",
          figureTypes: ["revenue comparison chart", "commercial performance timeline"],
        },
      },
    },

    NIW: {
      fullName: "National Interest Waiver (NIW)",
      standardOfProof: "preponderance of the evidence",
      regulatoryBase: "8 CFR § 204.5(k), Matter of Dhanasar (2016)",
      criteria: {
        "Substantial Merit and National Importance": {
          cfr: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016) — Prong 1",
          requirement:
            "The proposed endeavor has both substantial merit and national importance",
          keyElements: [
            "substantial merit of the work",
            "national importance",
            "defined endeavor",
            "broader implications for the US",
          ],
          tableType: "impact",
          figureTypes: ["national impact scope diagram", "field significance chart"],
        },
        "Well Positioned to Advance": {
          cfr: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016) — Prong 2",
          requirement:
            "The foreign national is well positioned to advance the proposed endeavor",
          keyElements: [
            "education and training",
            "skills and expertise",
            "record of past success",
            "concrete plan going forward",
          ],
          tableType: "qualifications",
          figureTypes: [
            "qualification and achievement timeline",
            "expertise depth chart",
          ],
        },
        "Balance of Benefits": {
          cfr: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016) — Prong 3",
          requirement:
            "On balance it would be beneficial to the United States to waive the job offer and labor certification requirements",
          keyElements: [
            "urgency of contribution",
            "unique knowledge or skills",
            "impracticality of labor certification",
            "net benefit to the US",
          ],
          tableType: "benefit",
          figureTypes: ["US benefit analysis diagram", "uniqueness comparison chart"],
        },
      },
    },

    O1A: {
      fullName: "O-1A Extraordinary Ability in Sciences Education Business or Athletics",
      standardOfProof: "extraordinary ability",
      regulatoryBase: "8 CFR § 214.2(o)(3)(ii)",
      criteria: {
        "Awards/Prizes": {
          cfr: "8 CFR § 214.2(o)(3)(ii)(A)",
          requirement:
            "Receipt of nationally or internationally recognized prizes or awards for excellence in the field",
          keyElements: [
            "national or international recognition",
            "excellence",
            "selectivity of award",
          ],
          tableType: "awards",
          figureTypes: ["award prestige tier", "selection rate"],
        },
        "Membership": {
          cfr: "8 CFR § 214.2(o)(3)(ii)(B)",
          requirement:
            "Membership in associations that require outstanding achievements as judged by recognized experts",
          keyElements: [
            "outstanding achievement requirement",
            "expert judging",
            "selectivity",
          ],
          tableType: "memberships",
          figureTypes: ["membership selectivity", "organization prestige"],
        },
        "Press/Media Coverage": {
          cfr: "8 CFR § 214.2(o)(3)(ii)(C)",
          requirement:
            "Published material in professional or major trade publications or major media about the alien",
          keyElements: ["about the alien", "major media", "circulation and reach"],
          tableType: "press",
          figureTypes: ["media reach chart", "coverage timeline"],
        },
        "Judging": {
          cfr: "8 CFR § 214.2(o)(3)(ii)(D)",
          requirement:
            "Participation as a judge of the work of others in the same or allied field",
          keyElements: ["judging role", "allied field", "formal invitation"],
          tableType: "judging",
          figureTypes: ["judging scope", "panel composition"],
        },
        "Original Contributions": {
          cfr: "8 CFR § 214.2(o)(3)(ii)(E)",
          requirement: "Original contributions of major significance to the field",
          keyElements: ["originality", "major significance", "adoption by others"],
          tableType: "contributions",
          figureTypes: ["impact chart", "adoption trend"],
        },
        "Scholarly Articles": {
          cfr: "8 CFR § 214.2(o)(3)(ii)(F)",
          requirement:
            "Authorship of scholarly articles in professional publications or major media",
          keyElements: [
            "authorship",
            "scholarly nature",
            "professional publications",
          ],
          tableType: "articles",
          figureTypes: ["publication timeline", "citation chart"],
        },
        "Critical Role": {
          cfr: "8 CFR § 214.2(o)(3)(ii)(G)",
          requirement:
            "Critical or leading role in distinguished organizations or establishments",
          keyElements: [
            "critical role",
            "distinguished organization",
            "scope of impact",
          ],
          tableType: "roles",
          figureTypes: ["organization scale chart", "role impact diagram"],
        },
        "High Remuneration": {
          cfr: "8 CFR § 214.2(o)(3)(ii)(H)",
          requirement:
            "High salary or remuneration compared to others in the field",
          keyElements: [
            "high salary",
            "comparison to peers",
            "BLS benchmark data",
          ],
          tableType: "salary",
          figureTypes: ["salary percentile chart", "compensation benchmark"],
        },
      },
    },
  },
};
