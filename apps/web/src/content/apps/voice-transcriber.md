---
title: "Voice Transcriber"
category: "dev"
job: "Free browser speech-to-text with session history and transcript download"
description: "Browser-based voice transcription using the Web Speech API. Record speech, see live interim text, auto-copy each segment to clipboard, save session history, and export the full transcript. No login, no account, no upload."
aiSummary: "A WisprFlow-style free voice transcriber built on the Web Speech API. Press R to record, see live transcription, auto-copy to clipboard on stop, and download session transcripts. All processing happens in-browser — no server, no signup."
personalUse: "I was paying for WisprFlow. Then I realised I could replicate the core workflow — record, stop, text in clipboard — in a browser afternoon project. This is that project."
status: "active"
publishedAt: "2026-04-19"
icon: "🎙️"
license: "MIT"
---

## How this works

Press **R** (or click Record) to start recording. Speak. Press **R** again to stop. The transcript is automatically copied to your clipboard — paste it anywhere.

Each recording segment appears in the session log with a timestamp and word count. Click any past segment to re-copy it. Download the full session as a `.txt` file at any time.

**Session persistence** — the current session is saved to browser localStorage. Refreshing or reopening the tab restores your segment history.

## Privacy

**Your audio is not stored on our servers — we have no servers.** All processing is client-side.

In Chrome and Chromium browsers, the Web Speech API sends audio to Google's speech recognition servers over HTTPS. Google's privacy policy applies. Firefox uses a local engine by default. Safari uses Apple's servers.

This is the same infrastructure your voice search uses. If that's a concern, consider running a local Whisper instance instead.

## Browser support

| Browser | Support |
|---------|---------|
| Chrome / Edge | Full — uses Google speech recognition |
| Safari | Full — uses Apple speech recognition |
| Firefox | Limited — may require `media.webspeech.recognition.enable` flag |
| Mobile Chrome | Supported |
| Mobile Safari | Supported |

## Limitations

- **Single speaker only** — speaker diarization is not supported by the Web Speech API.
- **No offline support** — recognition requires an internet connection (Chrome/Edge/Safari all send audio to cloud APIs).
- **Accuracy varies** by accent, microphone quality, and background noise.
- **Session history** is stored in `localStorage` and cleared when you clear your session. Closing the browser does not clear history.
- **No system-wide hotkey** — browser security prevents capturing global keyboard shortcuts. The R key only works when this tab is focused.
