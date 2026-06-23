---
title: "Introducing Gekro News: An AI Briefing That Curates Itself Around Me"
description: "A public daily AI briefing that reads a profile of my interests distilled from my own knowledge base, picks the day's real signal, cites its sources, and publishes itself every morning."
publishedAt: "2026-06-22"
difficulty: "Intermediate"
topics: ["Automation", "LLMs", "AI Engineering"]
readingTime: 6
aiSummary: "Gekro News is a public daily AI briefing at gekro.com/news that curates itself around an interest profile distilled automatically from the author's own knowledge base. It scans vetted feeds, selects the day's most significant stories with a neutral cited summary, validates its own output, and auto-publishes a post and an RSS feed every morning, which is then read aloud in the car on demand."
---

<TLDR>
  Gekro News is a public AI briefing that curates itself around a profile of what I actually care about, distilled automatically from my own knowledge base. It picks the day's real signal out of the noise, cites its sources, and publishes itself every morning with no human in the loop. I have my car read it to me on the drive in.
</TLDR>

<!-- The Hook (No Heading) -->

Every morning, before I am awake, a small program reads the day's AI news, drops the nine-tenths that has nothing to do with my work, and leaves me the rest. It learns what counts as my work by reading my own notes, and it keeps relearning as those notes change. I did not buy this or install it. Nothing on the market curates the news around a single reader, so I built the thing that would.

## The Architecture

The reason this is not just another feed reader is that the filter is not static. Most curation tools make you set up topics once and then drift out of date the moment your work moves on. Gekro News inverts that: the briefing reads a small profile of my current interests, and that profile is regenerated from my own knowledge base on a schedule. What I am building this month is what the news is about this month. I never edit a setting.

| | What it does | Where it lives |
|---|---|---|
| The taste | Distills my knowledge base into a public interest profile, weekly | An [n8n](/stack/n8n/) flow (cloud) |
| The wire | Scans vetted feeds, curates with that profile, validates, publishes | A daily job (cloud, unattended) |
| The delivery | Reads the briefing to me, hands-free, on request | RSS plus an on-demand voice fetch in the car |

The three are deliberately decoupled, so a failure in one never takes down the others.

```
WEEKLY                          DAILY (07:00 UTC, unattended)
──────                          ─────────────────────────────
n8n reads my knowledge base     scan vetted feeds (last 36h)
   ↓ distills to PUBLIC            ↓ read the interest profile
   ↓ AI topics, sanity-checked     ↓ curate the day's 2-4 stories
   ↓ writes interest profile  ───► ↓ validate (cite, neutral, sourced)
                                   ↓ auto-publish
                                        ↓
                              gekro.com/news + RSS ──► "read me my news" → car
```

## The Build

**Discovery.** A daily job scans a tight set of vetted, high-signal feeds for everything published in the last 36 hours. Those feeds are the net, not the catch. The part I am most particular about is the citations: every story links the exact article the job pulled, and the publisher rejects any source it cannot trace back to something it actually fetched. The briefing cannot link to a page it never read, which is the difference between a wire I will trust at 70 miles an hour and one I would have to fact-check at every light.

**Curation.** The candidates go to a single model call with one instruction set. No fine-tuning, no vector store. The intelligence is one prompt that encodes a point of view, plus the interest profile layered on top of it.

```
You are writing the daily AI briefing for gekro.com - a NEUTRAL, sourced
digest, not an opinion column.

PREFER: model releases (open-weight especially), research with engineering
implications, infra and tooling, real benchmarks, API and pricing changes
that affect developers.
AVOID: funding rounds, business news, opinion, press releases, AI drama,
AGI speculation without evidence.

Neutral, third person, no hype words. EVERY claim carries an inline citation.
Do not state anything you cannot attribute.
```

That static spine is the same every day. What changes is a small `READER FOCUS` block, injected from the interest profile, that tells the editor which of those preferred topics to weigh hardest today. If you want to see how much a single prompt like this is carrying, run it through the [System Prompt Linter](/apps/system-prompt-linter/) - selection rules, voice rules, and an output contract, all in one instruction set.

It also remembers. Before it writes, the editor sees the headlines it already published over the past several days, so a multi-day story does not get re-reported every morning. It moves on unless something genuinely new happened, which is the difference between a feed and a loop.

**The self-updating taste.** This is the part I care about most. An [n8n](/stack/n8n/) flow runs on a schedule, reads my knowledge base, and distills it into the public, AI-and-software topics I have actually been building with and writing about. It writes the result into a small profile the daily job reads on its next run. Two rules keep it safe to run unattended against a public site. First, the profile lives in a public repository, so it is world-readable by construction - which means only publishable topics can ever live there. Second, the write is gated by a check that the profile contains nothing personal, nothing about who I work for, nothing identifying, and it fails closed: if it cannot certify the profile is clean, it writes nothing and the last clean profile stays. Stale but clean beats fresh but unvetted, every time.

**Publish and deliver.** A malformed briefing never ships - the generator validates its own output (neutral tone, aligned sources, length bounds) and aborts on anything broken before a build sees it. A clean one commits itself and deploys, landing at [gekro.com/news](/news/) and in an RSS feed. The whole thing runs on scheduled cloud routines, so keeping it alive costs me nothing and never needs my machine on. For delivery, I wired a custom instruction into the assistant in my car: I ask for my news, it pulls the latest briefing and reads it to me on the drive in. No app, no screen.

## The Tradeoffs

A self-curating filter is a single point of taste. The briefing is only ever as relevant as the profile behind it, and that profile is me. That is the entire value when I want a wire that tracks my work, and a liability the moment I mistake it for objective. It reflects me on purpose, and I try not to forget that.

The harder line is public versus private. This is a public site, so the personalization has to make the news more relevant to me without ever turning the page into a diary. The discipline is one sentence: personalize what gets selected, never who gets addressed. The briefing stays neutral and third person. There is no "for you, Rohit" anywhere on it, because there is a real reader on the other side who deserves a briefing, not a look at my notebook. The personal half lives only in the car, where the audience is one.

## What I Learned

The version I almost built was much bigger - a database, a dedup engine, embeddings to cluster stories, a dashboard to tune weights. I am glad I did not. The whole thing is a scheduled job, one prompt, a small profile that rewrites itself, and a feed I was already generating. The intelligence is not in the infrastructure; it is in one paragraph of editorial judgment and one short, self-updating list of what I care about. Curation turned out not to be a model problem or a data problem. It is a taste problem, and taste compresses into a prompt and a profile better than almost anything else I have tried to encode. I built it for an audience of one, then left the doors open at [gekro.com/news](/news/), because the noise is not my problem alone.
