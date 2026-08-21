---
title: "EU AI Act Risk Classifier"
category: "ai"
job: "Find out which risk tier your AI system falls into, what that obliges you to do, and the date it actually applies from"
description: "A guided walk through the EU AI Act's classification logic: prohibited practices, Annex I and Annex III high-risk listings, the Article 6(3) derogation, Article 50 transparency and the separate general-purpose model track. Returns the tier, the obligations it triggers with article references, the compliance date and the penalty band. Runs entirely in your browser."
aiSummary: "A client-side EU AI Act risk classifier. It walks Regulation (EU) 2024/1689 in application order - Article 5 prohibitions, Annex I product safety, Annex III high-risk use cases, the Article 6(3) derogation including the profiling override, Article 50 transparency, and GPAI obligations under Articles 51-56 - and returns a risk tier with its obligations, article citations, compliance date and Article 99 penalty band. Dates reflect Regulation (EU) 2026/1744, the Digital Omnibus on AI, which deferred Annex III high-risk obligations to 2 December 2027 and Annex I to 2 August 2028 while leaving Article 50 transparency in force from 2 August 2026. Unlike most classifiers it treats the tiers as stacking rather than mutually exclusive."
personalUse: "I ship AI tools that anyone can load from anywhere, which makes Article 50 my problem rather than somebody else's. When I went looking for a classifier to check my own work against, the free ones were either gated behind a contact form or still printing deadlines the Digital Omnibus had already moved. So this is the version I wanted: it walks the Act in the order the Act applies, stacks the obligations instead of pretending the tiers are mutually exclusive, and names the article behind every answer so you can go read it yourself."
status: "active"
publishedAt: "2026-08-21"
lastVerified: "2026-08-21"
companionPostSlug: ""
license: "MIT"
icon: "🇪🇺"
---

## How this works

The Act is a decision procedure, so this is one too. It asks the questions in the order the
regulation applies them, and the first hard stop wins:

1. **Scope.** The Act bites when a system is placed on the EU market, put into service in the EU,
   or its output is used in the EU. That last limb catches a lot of providers who assume they are
   outside it. Military, defence, national security and purely personal non-professional use are
   carved out by Article 2.
2. **Article 5.** Nine prohibited practices. One tick here ends the analysis, because the practice
   is banned rather than regulated.
3. **Annex I.** AI as a safety component of a product already covered by EU harmonised
   product-safety law. Conformity assessment runs through the existing sectoral regime.
4. **Annex III.** The eight standalone high-risk areas.
5. **Article 6(3).** The derogation out of Annex III, which needs a no-significant-risk finding
   *and* one of four conditions. Profiling voids it outright.
6. **Article 50.** Transparency duties, which stack on top of whatever tier you landed in.
7. **Articles 51 to 56.** General-purpose model obligations, a separate track for whoever places
   the model itself on the market.

## What it does differently

**The tiers stack.** Most classifiers hand you one label and stop. In the Act they are not
mutually exclusive: a high-risk recruitment system that also talks to candidates owes Chapter III
duties *and* Article 50 duties, and a general-purpose model provider owes Chapter V regardless of
what the downstream system does. This tool reports every track you are on.

**The derogation is modelled properly.** Article 6(3) is a two-part test, not a menu. You need
both the finding that the system poses no significant risk of harm *and* at least one of the four
conditions. And even then, the final paragraph makes profiling of natural persons always
high-risk. The tool refuses to grant the derogation if you tick profiling.

**A derogation is not an exit.** Article 6(4) still requires you to document the assessment before
placing the system on the market, register it in the EU database anyway, and hand the
documentation over on request. The tool says so.

**The dates are the post-Omnibus ones.** This is the part most secondary sources still get wrong.

## The calendar, after the Digital Omnibus

Regulation (EU) 2026/1744 was published in the Official Journal on 24 July 2026 and entered into
force on 27 July 2026. It is enacted law, not a proposal, and it moved the high-risk regime:

| Obligation | Applies from |
|---|---|
| Article 5 prohibitions, Article 4 AI literacy | 2 February 2025 |
| General-purpose model obligations | 2 August 2025 |
| Article 50 transparency | 2 August 2026 |
| Machine-readable marking, systems already on the market | 2 December 2026 |
| High-risk via **Annex III** | **2 December 2027**, deferred from 2 August 2026 |
| High-risk via **Annex I** | **2 August 2028**, deferred from 2 August 2027 |

The deferral bought time to build compliance infrastructure. It did not remove the duty to work
out your classification, and the analysis is the slow part anyway.

## Inputs explained

- **Your role** - provider, deployer, importer or product manufacturer. The duty tables change
  completely. Watch for the Article 25 trap: a deployer who rebrands a high-risk system,
  substantially modifies it, or repurposes it into a high-risk use becomes the provider and
  inherits the entire Chapter III burden. Fine-tuning counts.
- **Intended purpose** - tick Annex III areas against what the system is *for*, not only what it
  currently does. Classification follows intended purpose.
- **Systemic risk** - training compute above 10^25 FLOP, or a Commission designation. It pulls in
  Article 55 on top of Article 53, and it cancels the open-source relief entirely.

## Penalties

Article 99 sets three bands: up to EUR 35,000,000 or 7% of worldwide annual turnover for
prohibited practices, EUR 15,000,000 or 3% for most other breaches, and EUR 7,500,000 or 1% for
supplying incorrect or misleading information to authorities. For most undertakings the higher of
the two figures applies. For SMEs and start-ups it is the lower one, under Article 99(6).

## Sources

- [EU AI Act, Regulation (EU) 2024/1689](https://artificialintelligenceact.eu/) - consolidated article text, verified 2026-08-21
- [Article 6, classification rules](https://artificialintelligenceact.eu/article/6/) - the derogation and the profiling override, verified 2026-08-21
- [Annex III, high-risk use cases](https://artificialintelligenceact.eu/annex/3/) - the eight areas, verified 2026-08-21
- Regulation (EU) 2026/1744, the Digital Omnibus on AI - OJ 24 July 2026, in force 27 July 2026, verified against two independent legal-practitioner summaries 2026-08-21

## Limitations

- **This is triage, not legal advice.** Classification turns on the specific intended purpose and
  the deployment context. A tool that reduces that to checkboxes is useful for orientation and
  useless as a defence.
- **Annex I is compressed.** The real annex lists individual harmonisation instruments; this
  groups them into three families. If you tick it, go and read the actual annex.
- **National implementation varies.** Member States designate their own market surveillance
  authorities and set their own penalty procedures within the Article 99 ceilings.
- **It cannot tell you whether you pose a significant risk of harm.** That judgement under
  Article 6(3) is yours to make and yours to document, and an authority can disagree with it.
- **The Act moves.** The Omnibus proved that. The date on this page is when the classification
  logic was last checked against the text.
