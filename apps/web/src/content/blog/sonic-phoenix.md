---
title: "Sonic Phoenix: Bringing 7,246 Forgotten Songs Back from the Dead"
description: "How my child's request to hear my childhood music turned into a seven-phase pipeline that fingerprinted, sorted, enriched, and synced a 30GB library to Spotify — then handed it to an AI skill for on-demand playlist curation."
publishedAt: "2026-04-12"
difficulty: "Intermediate"
topics: ["AI", "Automation", "Productivity"]
readingTime: 11
aiSummary: "Rohit built Sonic Phoenix, a seven-phase pipeline that used acoustic fingerprinting, language classification, metadata enrichment, and an AI agent skill to transform 7,246 chaotic audio files into a clean 30GB library with on-demand Spotify playlist curation. The project started when his kid asked to hear the music he grew up with."
mainImage: "/images/blog/sonic-phoenix.png"
---

<TLDR>
  My kid asked to hear what I listened to growing up. The problem: 7,246 audio files on a hard drive with broken tags, garbled metadata, and zero usable organization. Over a weekend I built Sonic Phoenix — a seven-phase pipeline that fingerprinted every track via Shazam, classified languages, merged 1,365 fragmented artist folders, enriched metadata from iTunes and LrcLib, and sorted the entire 30GB collection into a clean hierarchy. Zero unsorted files remain. Phase 7 is a ClawHub AI skill that sits on top of the catalog and lets any OpenClaw-compatible agent curate Spotify playlists on demand from natural language.
</TLDR>

My kid asked me to play the songs I used to listen to when I was their age. Simple request. I said sure, pulled out a dusty external drive, plugged it in, and opened a folder I hadn't touched in years. What I found was 7,246 audio files with metadata that was either wrong, missing, or nonsensical — artist fields containing track numbers, album names that meant nothing, titles that had nothing to do with the actual song. I couldn't find a single track by name. That drive held everything I grew up on — Eminem, Linkin Park, A.R. Rahman, Pritam, Queen — buried under layers of broken tags accumulated over years of ripping, converting, and moving files between devices. The weekend that followed turned into [Sonic Phoenix](https://github.com/drajb/sonic-phoenix).

## The Architecture

The pipeline is split into seven phases, each a series of small scripts that write their state to disk. You can stop after any phase, inspect the intermediate JSON, fix things by hand, and resume without redoing work. Nothing clever about it — just disciplined state management that makes a chaotic problem tractable.

| Phase | Purpose | Key Metric |
|:------|:--------|:-----------|
| **1 — Discovery** | Acoustic fingerprint every file via Shazam | 7,246 files scanned, 4,177 identified (57.6%) |
| **2 — Consolidation** | SHA-256 catalog + language classification | 7,160 cataloged entries across 2 language buckets |
| **3 — Audit & Re-sort** | Merge fragmented artists, enforce structure | 1,365 consolidation moves, 968 unique artist folders |
| **4 — Enrichment** | iTunes metadata, LrcLib lyrics, cover art | 6,733 tracks with real album data |
| **5 — Finalization** | Clean, vacuum, lock the master catalog | 0 unsorted files remaining |
| **6 — Spotify Sync** | Mirror library + auto-generate playlists | 95 artists synced to discovery engine |
| **7 — AI Skill (ClawHub)** | On-demand playlist curation via OpenClaw agents | Shipped as `ultimate-music-manager` on ClawHub |

The target structure is `Sorted/<Language>/<Artist>/<Album>/<Artist> - <Title>.<ext>`. Two language buckets emerged from my collection: **English** (3,621 tracks) and **Hindi** (1,410 tracks). The classification isn't hardcoded — it's driven entirely by JSON hint files you drop into `config/language_hints/`. If your collection is French and Japanese, the pipeline produces `Sorted/French/` and `Sorted/Japanese/` and nothing else.

```text
T:\Music\
├── Sorted/
│   ├── English/          # 3,621 tracks
│   │   ├── Eminem/       # 125 tracks
│   │   ├── Oasis/        # 80 tracks
│   │   ├── Pitbull/      # 68 tracks
│   │   ├── Nickelback/   # 68 tracks
│   │   ├── Evanescence/  # 64 tracks
│   │   ├── Metallica/    # 59 tracks
│   │   ├── Queen/        # 57 tracks
│   │   └── ... (600+ more artists)
│   └── Hindi/            # 1,410 tracks
│       ├── Pritam/       # 122 tracks
│       ├── Sonu Nigam/       # 63 tracks
│       ├── A.R. Rahman/  # 44 tracks
│       ├── Shankar Ehsaan Loy/ # 39 tracks
│       └── ... (350+ more artists)
├── .data/                # 11 MB of pipeline state
│   ├── shazam_hash_results.json   # 1.3 MB — ground-truth identifications
│   ├── catalog.json               # 3.8 MB — master SHA-256 catalog
│   ├── final_catalog.json         # 1.9 MB — read-only canonical output
│   └── enrichment_progress.json   # 642 KB — per-file enrichment status
└── sonic-phoenix/        # the pipeline repo
```

## The Build

### Phase 1: Ignore Every Tag, Trust Only the Audio

The first decision was the most important: **stop trusting the existing metadata.** The ID3 tags on these files weren't just incomplete — they were actively misleading. Artist fields contained track numbers. Album names were meaningless strings. Titles bore no resemblance to the actual song. Some tags were correct, but there was no way to tell which ones without an external source of truth.

That source of truth was [ShazamIO](https://github.com/shazamio/ShazamIO)'s acoustic fingerprinting engine. I fed every single file through it to cross-validate what the tags claimed against what the audio actually was. The script (`01D_shazam_all_files.py`) runs 20 concurrent Shazam lookups, flushes results to disk every 100 files, and is fully resumable — I killed it three times over the weekend and it picked up exactly where it left off each time.

Out of 7,246 files, Shazam positively identified 4,177 — a 57.6% recognition rate. Where Shazam confirmed the existing tags, those tags were kept. Where Shazam disagreed, the acoustic result won. The remaining 3,069 unrecognized files were a mix of obscure Bollywood tracks, regional Indian music, and files too corrupted or too short for acoustic matching. Those fell through to a three-tier resolution: Shazam result → existing ID3 tags (sanitized and denormalized) → filename parsing as a last resort. The final catalog shows the breakdown: 6,925 entries resolved via ID3 (cross-validated or corrected by Shazam where possible), 79 purely from Shazam, and 156 from filename fallback.

### Phase 2–3: The Language Problem and the Artist Fragmentation Problem

Language classification was straightforward for English tracks but broke down immediately for Hindi. The problem: `langdetect` sees transliterated Hindi (Hindi written in English letters — "Tujhe Dekha Toh Yeh Jaana Sanam") and classifies it as English. Every Bollywood song with a romanized title ended up in the wrong bucket.

The fix was explicit language hint files — JSON configs under `config/language_hints/` that list known artists, DNA keywords, and language codes. Drop a `Hindi.json` with `"artists": ["Pritam", "A.R. Rahman", "Sonu Nigam"]` and those artists get hard-routed to the Hindi bucket regardless of what `langdetect` thinks. The pipeline loaded these at runtime with zero hardcoded language knowledge in the code itself.

Then came the artist fragmentation problem. After the initial sort, I had separate folders for `Akon feat. Eminem`, `Akon ft Snoop Dogg`, and `AKON` — all the same primary artist, scattered across three directories. The consolidation pass (`03A_consolidate_by_artist.py`) used fuzzy matching at a 70% similarity threshold plus a manual override map for canonical names. It executed **1,365 folder merges** to collapse the mess down to **968 clean artist directories**.

The final structural enforcer (`03D_titanium_resort.py`) made a guarantee: after it runs, every single file under `Sorted/` complies with the `Language/Artist/Album/Artist - Title.ext` hierarchy. Anything that doesn't is re-sorted or flagged. By the time Phase 3 finished, the library had gone from a flat dump of 7,246 files to a structured hierarchy with zero orphans.

### Phase 4: Enrichment — Making the Metadata Worth Something

Sorting files into the right folders is half the job. The other half is making each file self-describing — correct ID3 tags, embedded cover art, synchronized lyrics. I used three external sources:

- **iTunes Search API** for canonical artist names, album titles, release dates, and 1000×1000 cover art. No API key required. The script rotates queries across US and GB country codes to dodge per-region rate limits.
- **LrcLib** for synchronized lyrics (the kind that scroll word-by-word in a player). Free, no auth.
- **Shazam's original identification** as the ground-truth anchor for fuzzy-matching against iTunes results.

The enrichment script (`04I_polish_and_enrich_v6.py` — the sixth iteration, which tells you how many edge cases this process surfaced) runs a 14-pattern regex denoise pass before writing any tag. It strips junk fragments — quality markers (`128kbps`, `320kbps`, `VBR`, `HQ`), description artifacts (`official video`, `full song`, `dj remix`), and miscellaneous noise that had accumulated in tag fields over the years. It detects inverted artist/title fields by fuzzy-comparing against the Shazam ground truth and auto-corrects them.

The result: **6,733 out of 7,160** cataloged tracks now carry real album metadata. 103 tracks have embedded HD cover art. 25 have synchronized lyrics. The remaining gaps are mostly regional tracks that iTunes doesn't index — a known limitation I'm tracking for a future enrichment pass against MusicBrainz.

### Phase 5–6: Finalization and the Spotify Bridge

Phase 5 locked the catalog. `05I_finalize_catalog.py` merges ID3, Shazam, and NLP classification data into a single `final_catalog.json` — a 1.9 MB read-only artifact that downstream consumers treat as the single source of truth. After finalization: **zero unsorted audio files remaining** anywhere under the music root.

Phase 6 was the payoff. The discovery sync engine (`06E_spotify_discovery_sync.py`) cross-references local artists against Spotify's catalog and auto-generates genre-based "Essentials" playlists. It processed **95 artists** in the first sync run. The Spotify 403 on playlist creation (the app was in Development Mode) blocked the auto-generated playlists from landing — a one-click fix in the Spotify Developer Dashboard that I'll resolve before the next run.

But the real payoff isn't Phase 6 itself. It's that the catalog is now structured and enriched enough to hand to an AI.

### Phase 7: The AI Skill — Playlist Curation on Demand

Phases 1–6 built the dataset. Phase 7 puts an AI on top of it.

I've shipped the skill to [ClawHub](https://clawhub.ai/drajb/ultimate-music-manager) under the name `ultimate-music-manager`. Any OpenClaw-compatible agent — Claude Code, Codex, Copilot — can install it and immediately operate the pipeline or query the catalog. The skill package includes the full pipeline instruction set (`SKILL.md`), helper scripts for preflight checks and status dashboards, and a safety hook that intercepts destructive operations before they execute.

This is where the weekend project pays off. I can now say "build me a 90s Bollywood nostalgia playlist" or "give me every Eminem track sorted by album" or "create a road trip mix from my English collection, heavy on rock" and the agent has the structured metadata — artist, title, album, language, genre — to actually do it. It reads `final_catalog.json`, filters by whatever criteria I describe in plain language, and pushes the result to Spotify via Phase 6's sync engine.

The final catalog isn't a flat list of filenames anymore. It's a queryable dataset sitting behind a shipped AI skill that turns natural language into curated playlists — built entirely from my own music, not from an algorithm that doesn't know what I grew up on.

## The Tradeoffs

The 57.6% Shazam recognition rate was the biggest surprise. I expected acoustic fingerprinting to be a silver bullet — feed it audio, get an answer. For mainstream Western music it was. For regional Indian music, especially older Bollywood tracks and devotional recordings, Shazam's database simply didn't have coverage. The three-tier fallback (Shazam → ID3 → filename) caught most of these, but 156 tracks still resolved only via filename parsing, which means their metadata is only as good as whatever the original downloader typed. Those 156 entries are the lowest-confidence records in the catalog.

The six iterations of the enrichment script (`04A` through `04I`) tell their own story. Each version exists because the previous one broke on an edge case I didn't anticipate: mixed ID3v2.3/v2.4 headers that Mutagen couldn't save, iTunes returning a completely different track for a fuzzy query, inverted artist/title fields that the denoise pass made worse instead of better. I kept every iteration in the repo as a historical record. Reading `04A` through `04I` in order is the fastest way to understand every metadata edge case a music library can throw at you.

The `langdetect` failure on transliterated Hindi burned hours. I had 200+ Bollywood tracks sitting in the English bucket before I realized the classifier was confidently wrong. The hint-file system was the fix, but it's a manual process — someone has to curate those artist lists and keywords per language. For a two-language collection (English + Hindi) this was manageable. For a polyglot library with 10+ languages it would be a significant upfront investment.

The 690 mismatch entries in the mismatch report represent tracks where iTunes returned a result that didn't match the Shazam identification. Some were legitimate alternate versions (live recordings, remasters). Some were genuinely wrong matches from iTunes' fuzzy search. The enrichment script logs these but doesn't override the Shazam ground truth — a conservative choice that occasionally leaves a track under-enriched rather than mis-tagged.

## What I Learned

My kid got to hear the songs. That was the whole point, and it almost got lost in the engineering. But the real lesson is that a pile of 7,246 untagged audio files isn't a music collection — it's a data problem, and data problems are exactly what AI tooling has gotten good at. The pipeline I built over a weekend would have taken weeks of manual sorting a few years ago. Now the catalog is structured enough that an AI skill can build me a playlist in seconds from metadata I never would have had the patience to curate by hand. The hard drive isn't dusty anymore. It's a dataset, and datasets compound.
