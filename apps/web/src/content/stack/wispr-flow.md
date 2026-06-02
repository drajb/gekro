---
name: "Wispr Flow"
category: "devtool"
tagline: "AI voice dictation that types clean text into any app on your machine."

status: "active"
publishedAt: "2026-06-01"
lastVerified: "2026-06-01"

verdict: "Wispr Flow is the fastest way I have found to get a spoken thought into any text field - its own dashboard clocks me at 146 words a minute across 63,758 words dictated in seven weeks, and it has earned its place for prose, prompts, and messages. The twist of this review: I liked it enough to fork an open-source dictation tool into a free, 100% local build of my own that runs Whisper on-device, and it now covers the same daily job beside Wispr without sending anything to the cloud."

priceTier: "paid-tier"
pricingNotes: "Free tier caps at 2,000 words/week. Pro is $15/mo, or $12/mo billed annually ($144/yr). One Pro subscription covers Mac, Windows, iOS, and Android."

goodAt:
  - "Cleans up speech as it goes - strips filler words ('um', 'uh', 'like'), adds punctuation, and fixes backtracking, so the text lands ready to send instead of ready to edit."
  - "Roughly 3-4x faster than typing for first-draft prose. I get a Slack reply or a rough prompt out in the time it takes to think it."
  - "Works system-wide in any text field - editor, browser, terminal, chat - not just inside one dedicated app window."
  - "Command Mode (Pro) lets you voice-edit selected text: 'make this more concise', 'turn this outline into a paragraph', 'translate to Spanish'."

badAt:
  - "Cloud-only. There is no offline mode - your audio leaves the machine and is processed on the company's cloud and its third-party AI subprocessors. No internet, no dictation."
  - "It leans on your on-screen context, and unless you turn on Privacy Mode (Zero Data Retention, opt-in on Pro), their own policy allows your dictation data to be used to improve their models. I would not point it at a screen showing keys, tokens, or client data."
  - "Technical terms are unreliable. In my use it mangles camelCase identifiers, CLI flags, and library names often enough that dictating code is slower than typing it."
  - "Heavy for a dictation tool. Users have reported ~800MB RAM at idle on older Macs and the Windows build briefly freezing the focused app, including the editor."

comparisonTable:
  headers: ["", "Wispr Flow", "Whisper Local", "Apple Dictation"]
  rows:
    - ["Runs offline",          "No",                    "Yes",          "Yes"]
    - ["Auto-cleanup",          "Yes",                   "Yes (optional)", "No"]
    - ["Works in every app",    "Yes",                   "Yes",          "Yes"]
    - ["Sends audio to cloud",  "Yes",                   "No",           "No (on-device)"]
    - ["Price",                 "$15/mo ($12 annual)",   "Free (MIT)",   "Free"]
  highlight: "Wispr Flow"
  caption: "Snapshot as of 2026-06-01. Whisper Local is my own open-source build; prices are the consumer tiers."

alternatives: ["Whisper Local", "Superwhisper", "Apple Dictation", "Willow Voice"]

homepage: "https://wisprflow.ai/"
referralLink: "https://wisprflow.ai/r?ROHIT2038"

relatedPost: "ai-codes-like-genius"

aiSummary: "Wispr Flow is a cloud-based AI voice dictation tool that types cleaned-up, punctuated text into any application about 3-4x faster than typing, which the author validated across 63,758 words of daily dictation over seven weeks at 146 words per minute. The twist of this review: the author forked an open-source tool into a free, 100% local alternative (Whisper Local, MIT) that runs OpenAI's Whisper on-device and covers the same everyday dictation without the cloud, screenshots, or subscription."
---

## Why I tried it

The bottleneck in my day was never thinking, it was getting the thought down. Prompts, Slack replies, commit messages, the first messy draft of a post - all of it lived at typing speed, and typing speed is slower than I talk. I had tried dictation before and bounced off it every time, because the raw transcript always needed a second pass to strip the "um"s and add the commas, and that second pass cost back whatever the first pass saved.

[Wispr Flow](https://wisprflow.ai/r?ROHIT2038) was the first one where the second pass mostly disappeared. You hold a hotkey, talk, let go, and the text that appears in whatever field you were in is already punctuated, de-ummed, and reads like you wrote it on purpose. It sits in the menu bar and works the same in the editor, the browser, and a chat window. After a week it had absorbed most of the writing I do that is not code.

The habit stuck, and the numbers back it up. Wispr's own dashboard has me at **146 words a minute** (it puts that in the top 0.2% of its users), **63,758 words dictated** in about seven weeks, and **2,119 cleanups** it made along the way - a copy editor riding shotgun that I never have to thank. About **1,256** of those dictations were prompts fired straight at AI tools, which is to say a large share of how I talk to models now is literally me talking. The screenshot below is the raw dashboard, not a cherry-picked week.

<!-- Rohit: save the dashboard screenshot to apps/web/public/images/wispr-flow-dashboard.png, then uncomment the next line to display it.
![Wispr Flow's dictation dashboard: 146 words per minute (top 0.2%), 63,758 total words dictated, 2,119 fixes made by Flow, and 1,256 AI prompts.](/images/wispr-flow-dashboard.png)
-->

## So I built my own

Here is the part that makes this an engineer's review and not a coupon. I liked Wispr enough that I wanted to own the workflow instead of renting it, so I forked [whisper-key-local](https://github.com/PinW/whisper-key-local) by Pin Wang and shaped it into something that does the one job I care about, as close to the Wispr feel as I could get. I called it [Whisper Local](https://github.com/drajb/whisper-local), and I have been refining and testing it daily for the last few weeks.

The difference from Wispr is the whole point: it runs OpenAI's Whisper entirely on your machine through `faster-whisper`, so the audio never leaves the laptop - not even the metadata. A hotkey records, you release, it pastes. An optional local Ollama pass adds the punctuation-and-capitalization polish that makes dictated text feel finished, and there is a small local API on `localhost:7777` if you want to wire it into other tools. It is MIT licensed, runs on Windows and macOS, uses the GPU if you have one, and installs in three lines of `pip`.

Honest comparison after a few weeks side by side: Wispr is still smoother out of the box. It is a real product - the mobile apps and Command Mode have no equivalent in my build, and the default `tiny` model is less accurate than Wispr's cloud until you size up to a larger Whisper model. What mine gives back is everything in the "what it's bad at" list above: no cloud, no screenshots, no subscription, and a codebase you can actually read. If privacy or the $144 a year is what has been stopping you, clone it and go: [github.com/drajb/whisper-local](https://github.com/drajb/whisper-local).

## When I'd skip it

Skip it for two things. First, code - the accuracy on identifiers, flags, and library names is not good enough, and correcting `getUserById` back from "get user by I.D." is slower than just typing it. I dictate the comment and the commit message, then type the function.

Second, anything sensitive on screen. Wispr uses your on-screen context, and unless Privacy Mode is on, their policy lets your audio and text feed model training. If you are looking at a terminal with a token in it, or a customer's data, that is the wrong tool - which is exactly why I built the fully local [Whisper Local](https://github.com/drajb/whisper-local) for that side of my day. Apple's built-in dictation is also free and on-device if you can live without the cleanup.

## My setup

I run the Pro tier with Privacy Mode (Zero Data Retention) switched on, which is the only configuration I would recommend for anyone whose screen ever shows credentials. Day to day it is: dictate the first draft of a prompt, dictate Slack and email, dictate the rough shape of a blog section, then go back and type the parts that need precision. The same subscription follows me to the phone, though the dashboard says 97% of my dictation still happens at the desktop. The cleanup is good enough that I have stopped proofreading short messages before I send them. That, more than any benchmark, is the real endorsement.

This pairs with how I think about [letting AI handle the mechanical parts of writing while I keep the judgment](/blog/ai-codes-like-genius/) - dictation is the same trade for prose that an AI pair is for code.

## Where it goes next

Both stay, for now, and that is the honest state of it. Wispr is the polished daily driver, my fork is the one I keep tightening, and I will keep publishing the side-by-side numbers as the sample grows instead of declaring a winner early. The day my own build clearly wins on the work I do every day, this entry moves to `watching` and the writeup of [Whisper Local](https://github.com/drajb/whisper-local) becomes the main event. Until then the choice is simple: rent the polish, or own the workflow. Wispr if you want it handled for you, [mine](https://github.com/drajb/whisper-local) if you would rather it never leave your machine.
