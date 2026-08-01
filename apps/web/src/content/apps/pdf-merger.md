---
title: "PDF Merger"
category: "dev"
job: "Drop multiple PDFs, drag to reorder, type page ranges per file, merge to one PDF - all in your browser."
description: "Free in-browser PDF merger. Drop multiple PDFs, drag the handle to reorder them, type a page-range expression per file ('1-3, 5, 7-9' or 'all') to pick exactly which pages to include, hit Merge and a single combined PDF downloads. Everything runs locally via pdf-lib - no uploads, no server, your documents never leave the page. Supports any unencrypted PDF up to 100 MB per file. Handles page-range syntax with open-ended ranges, single pages, and combined expressions. Surfaces clear errors for encrypted or corrupt PDFs."
aiSummary: "Client-side PDF merger using pdf-lib (MIT, ~280 KB lazy-loaded on first interaction). Accepts multiple PDFs via drag-drop or file picker, displays each as a row with file name + size + page count + per-file page-range text input. Native HTML5 drag-and-drop reorders files via the row handle (⠿). Page-range parser supports: 'all' or empty (default = all pages), single pages ('5'), closed ranges ('1-3'), open-start ('-3' = pages 1-3), open-end ('5-' = page 5 to end), and comma-separated combinations ('1-3, 5, 7-9'). Hero shows total file count + total selected pages + total input size. Merge writes a flat PDF with metadata 'Merged with gekro.com/apps/pdf-merger'. Encrypted PDFs caught at load() time and flagged 'unlock it first'. Out of scope for v1 (per 2026-05-25 dep decision): visual page thumbnails (would require PDF.js ~1.5 MB), split mode, per-page rotation, password-protect output, OCR. Per-file 100 MB cap as memory sanity check. No persistent state."
personalUse: "I get sent loose pages of an invoice, a contract appendix, and a redacted exhibit, and need to glue them into one PDF before forwarding. Every free 'merge PDF' tool online wants me to upload my documents - I don't want them on someone else's server. Built one that does it locally."
status: "active"
publishedAt: "2026-05-25"
icon: "📑"
license: "MIT"
---

## What It Does

Drop PDFs. Drag the **⠿** handle to reorder. Type which pages of each file to include. Hit Merge. A single combined PDF downloads.

- **Multiple files** at once via drag-drop or file picker
- **Drag to reorder** using the handle in each row
- **Per-file page ranges** (the killer feature - most online mergers can't do this)
- **Live page count** under each row shows how many you've selected vs total
- **Total counts** in the hero update as you change ranges
- **Hard 100 MB cap per file** for sanity (browser memory)
- **Clear errors** for encrypted or corrupt PDFs

## Page-range syntax

Pages are 1-indexed (what your reader shows you).

| Type | Means |
|---|---|
| `all` or empty | every page (default) |
| `5` | just page 5 |
| `1-3` | pages 1, 2, 3 |
| `1, 3, 5` | pages 1, 3, and 5 |
| `1-3, 5, 7-9` | combine ranges with single pages |
| `-3` | pages 1 through 3 (open-start) |
| `5-` | page 5 through the end (open-end) |

Out-of-range pages (e.g. asking for page 10 of a 5-page PDF) get a clear inline error and the merge button stays disabled until you fix it.

## When To Use It

- Combining a contract, addendum, and signature page into one file
- Stitching scanned pages from a multi-batch scan
- Pulling exhibits 1-5 from one PDF and exhibits 8-10 from another into a single brief
- Reordering pages because the original PDF's order is wrong
- Building a single-file packet for email when 5 attachments would get bounced

## Why Local-Only Matters

Most online PDF mergers (smallpdf, ilovepdf, etc.) require you to upload your file. For a contract, a tax form, a medical record, a draft of anything sensitive - that means a stranger's server now has a copy of your document. Even if they promise to delete it within an hour, you can't verify that.

This app uses [pdf-lib](https://pdf-lib.js.org/) (MIT), a pure-JavaScript PDF library that runs entirely in your browser. The library is lazy-loaded from the page on first interaction (one-time ~280 KB download, cached after). Your PDFs are read into browser memory, merged, and the result is offered as a direct download - at no point does any file leave your machine.

## What's NOT Included (intentional)

- **Visual page thumbnails** - would require PDF.js (~1.5 MB extra bundle). The page-range text input is fast once you know the syntax; thumbnails are coming if there's demand.
- **Split mode** (one PDF in → N PDFs out) - the inverse operation, tracked as a v2 feature
- **Per-page rotation** - most PDFs come pre-oriented; if needed, do it in your reader before merging
- **Password-protected input** - pdf-lib refuses encrypted PDFs by design. Unlock with your reader's "save as" first.
- **Image-based compression** - separate concern; if your output is too big consider re-saving in your reader first
- **OCR scanned PDFs** - separate tool (~10 MB Tesseract.js bundle)
- **Cloud storage integration** - your PDFs are on your machine, that's the point

## Related Tools

- [Image Compressor](/apps/image-compressor/) - now supports batch + ZIP download
- [Hash Generator](/apps/hash-generator/) - verify file integrity after merge
- [Base64 Encoder](/apps/base64-encoder/) - if you need to embed the PDF in an email or JSON payload
