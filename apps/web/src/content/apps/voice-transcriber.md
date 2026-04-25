---
title: "Voice Transcriber"
category: "ai"
job: "Free browser speech-to-text with session history and transcript download"
description: "Browser-based voice transcription using the Web Speech API. Record speech, see live interim text, auto-copy each segment to clipboard, save session history, and export the full transcript. No login, no account, no upload."
aiSummary: "A WisprFlow-style free voice transcriber built on the Web Speech API. Press R to record, see live transcription, auto-copy to clipboard on stop, and download session transcripts. All processing happens in-browser — no server, no signup."
personalUse: "I was paying for WisprFlow. Then I realised I could replicate the core workflow — record, stop, text in clipboard — in a browser afternoon project. This is that project."
status: "active"
publishedAt: "2026-04-19"
icon: "🎙️"
license: "MIT"
---

## What It Does

Voice Transcriber turns speech to text using your browser's built-in speech recognition engine. Press **R** to record, speak, press **R** again to stop — the transcript is automatically copied to your clipboard. Each segment is saved to a session log you can review, re-copy, or download as a text file. No account, no API key, no audio upload to Gekro servers.

## How to Use It

1. Press **R** (or click the Record button) to start.
2. Speak. Live interim text appears as you talk.
3. Press **R** again to stop. The finalized transcript is copied to clipboard automatically.
4. Paste it wherever you need it — email, notes, Slack, a document.
5. Past segments appear in the session history panel below. Click any to re-copy.
6. Click **Download** to export the full session as a `.txt` file.

**Session persistence** — the current session is saved to `localStorage`. Refreshing or reopening the tab restores your segment history until you clear it.

## The Math / How It Works

The Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) is a browser standard that abstracts over the underlying speech recognition engine. The API operates in two modes simultaneously:

- **Interim results** — hypothesis text that updates as you speak; shown in real time but not yet final
- **Final results** — committed text segments that fire when the recognizer is confident enough; these are what get saved and copied

The recognizer runs continuously while recording is active. When you stop, the final result for the last segment fires and the transcript is assembled from all final results since the last stop event.

**Where does the actual recognition happen?**
- **Chrome and Edge**: audio is streamed to Google's speech recognition servers over HTTPS. Recognition is server-side; accuracy is Google's Cloud Speech quality.
- **Safari**: audio goes to Apple's servers.
- **Firefox**: uses a local Gecko-based engine by default; accuracy is lower but offline-capable.

This means "no upload to Gekro" is accurate — but audio does go to Google or Apple, depending on your browser. Same infrastructure as voice search. If that's a concern, Firefox with local recognition is the alternative, or a self-hosted Whisper instance for production use cases.

## Why Developers and Power Users Need This (deep dive)

**The core use case is frictionless quick capture.** The gap between having a thought and having it in text is where ideas die. Dictating is typically 3–5x faster than typing for prose-length content, and for tasks like drafting a Slack message, writing a note, or capturing a verbal idea during a walk, voice-to-clipboard is meaningfully faster than any keyboard-first workflow.

**Why not just use the OS dictation?** macOS and Windows have built-in dictation. The difference with a browser-based tool is context and workflow: this tool saves a session log. You can dictate 10 segments across a 30-minute session, then download the full transcript and edit it. OS dictation discards intermediate results. This is the difference between a shorthand pad and a transcription service.

**When the Web Speech API is right vs. when it isn't:**

The Web Speech API is right for: quick notes, meeting summaries where someone is manually curating (not automated), personal productivity workflows, low-stakes transcription of clear speech in a quiet environment.

The Web Speech API falls short for: multi-speaker transcription (no diarization), high-accuracy medical/legal transcription, offline-only environments, non-English languages with complex phonetics, audio files (it only accepts live microphone input, not uploaded audio).

**For offline or high-accuracy use cases**, the alternative is running [OpenAI Whisper](https://github.com/openai/whisper) locally or via API. Whisper handles 99 languages, produces word-level timestamps, supports audio file transcription, and runs fully offline in its local version. The tradeoff is setup complexity and latency — Whisper processes in batch after recording completes, not in real time. For streaming real-time transcription at scale, Whisper Streaming or Assembly AI's real-time API are the production options.

**Browser support reality check:**

| Browser | Support |
|---------|---------|
| Chrome / Edge | Full — Google speech recognition |
| Safari | Full — Apple speech recognition |
| Firefox | Limited — may require `media.webspeech.recognition.enable` flag |
| Mobile Chrome | Supported |
| Mobile Safari | Supported |

Firefox's Web Speech API support has been behind a flag for years. If your target users are Firefox-first, this tool won't work reliably for them. Chrome is the primary target.

## Tips & Power Use

- **Short segments, not one long recording.** The Web Speech API handles segments of 30–90 seconds cleanly. Long continuous recordings introduce drift and missed final events. Record in natural thought chunks for best accuracy.
- **Quiet environment matters more than microphone quality.** Background noise (a fan, music, an open window) degrades accuracy more than a budget microphone would. A headset mic pointing at your mouth beats an expensive desktop mic in a noisy room.
- **Use the session log for editing context.** After a voice session, download the `.txt` file and open it in your editor. The session log preserves the temporal ordering of your thoughts, which is useful context for a first edit pass.
- **Pair with a clipboard manager.** Since each segment auto-copies to clipboard, a clipboard manager (Raycast, Alfred, Windows clipboard history) lets you access any of the last N segments even without looking at the Gekro session log.
- **Compare with the [Tokenizer Visualizer](/apps/tokenizer/)** after dictating a draft — voice-generated prose tends to be token-efficient because it lacks the redundant formatting that typed text often includes.

## Limitations

- **Single speaker only** — the Web Speech API produces no speaker diarization.
- **No offline support** — Chrome/Edge/Safari all send audio to cloud APIs; recognition requires internet connectivity.
- **Accuracy varies** by accent, microphone quality, and background noise.
- **Session history** is stored in `localStorage` and cleared when browser storage is cleared. Not synced across devices.
- **No system-wide hotkey** — browser security prevents capturing global keyboard shortcuts. The **R** key only works when this tab is focused.
- **No audio file input** — the Web Speech API accepts live microphone only, not uploaded audio files.
