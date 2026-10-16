---
title: "Passport Photo Maker"
category: "dev"
job: "Crop and frame a passport or visa photo to the official size with live guidelines, then download it or a print sheet. No upload, no limits."
description: "Free passport photo maker that runs in your browser. Crop to US, UK, Canada, India or EU sizes with guidelines and a print sheet. No upload, nothing stored."
aiSummary: "A free, client-side passport photo editor. You pick a country, drop in a photo, and drag it under guidelines for the chin line, the permitted head height and the centre line. It checks sharpness and background, then downloads a correctly sized JPG with the print resolution stamped in, an online-upload version where the authority publishes pixel and file-size limits, and a 4 x 6 in, 5 x 7 in, A4 or Letter print sheet as JPG or true-size PDF. The photo is processed in the browser tab and never uploaded or stored. It crops and lays out only; it does not retouch or replace backgrounds."
personalUse: "Passport photo sites charge for what is a crop and a ruler, and many of them keep your face on a server. I wanted one that does the crop, shows the actual rules next to the guidelines, and has nothing to keep."
status: "active"
publishedAt: "2026-10-15"
lastVerified: "2026-10-15"
license: "MIT"
icon: "🪪"
---

## What it does

Pick the country, add your photo, and drag it until your chin sits on the green line and the top of your head, hair included, falls between the two blue lines. The centre line and a head-shaped oval help you square up. When it looks right, download the photo at the exact pixel size for the printed size, or lay several copies on a print sheet.

Nothing leaves your device. The photo is decoded in this browser tab, drawn on a canvas and encoded to a file you download. There is no upload, no account, no watermark and no limit on how many photos you make. Close the tab and the photo is gone, because there is nowhere else it could be.

You can check that yourself: load the page, switch off your Wi-Fi, and make a photo. It still works.

## The sizes it knows

Every figure below was read from the issuing authority's own page and checked on 2026-10-15. The sources are linked under "What this country asks for" on the tool and at the bottom of this page.

| Photo | Printed size | Head, chin to crown | Online upload |
|---|---|---|---|
| United States passport | 2 x 2 in (51 x 51 mm) | 1 to 1 3/8 in (25 to 35 mm) | Renewing online: upload your original; the State Department tool crops it |
| United States visa | 2 x 2 in (51 x 51 mm) | 22 to 35 mm | Square JPEG, 240 KB or less, 600 x 600 px |
| United Kingdom | 35 x 45 mm | 29 to 34 mm | Upload your uncropped original (600 x 750 px minimum, 50 KB to 10 MB); GOV.UK crops it |
| Canada | 50 x 70 mm | 31 to 36 mm | 1,200 x 1,800 px JPEG, 200 KB to 5 MB |
| Australia | 35 x 45 mm | 32 to 36 mm | Prints only |
| Schengen, EU and ICAO | 35 x 45 mm | 32 to 36 mm | Varies by country |
| India passport form | 35 x 45 mm (4.5 x 3.5 cm) | Not stated by Passport Seva | Photo is taken at the counter at a PSK |
| India missions abroad and OCI | 2 x 2 in (51 x 51 mm) | 25 to 35 mm | OCI portal: square JPEG, 200 to 900 px, 200 KB or less |
| Japan | 35 x 45 mm | 34 mm plus or minus 2 | Mynaportal: JPG, 600 KB or less |
| China | 33 x 48 mm | 28 to 33 mm | 354 x 472 px JPEG, 40 to 120 KB |
| Singapore | 35 x 45 mm | 25 to 35 mm | 400 x 514 px, up to 8 MB |

You can also set your own width and height from 20 to 100 mm for a country that is not listed. The head band then defaults to 70% to 80% of the height, the ICAO figure, and the tool tells you it is a default rather than your authority's rule.

## How the guidelines are placed

Authorities define the head as chin to crown. The tool draws one chin line and the permitted crown band above it. No authority I could read publishes an eye-line height for these formats, so the tool draws none rather than invent one. The chin line sits so about 70% of the spare height is below the chin, which is how passport crops normally look. The oval is a rough head shape for lining up, not a measurement.

These guidelines are drawn from published numbers. They do not detect your face, and they cannot tell you the photo will pass. The authority makes that call.

## Checks on your crop

- **Sharpness.** It compares the pixels in your crop with the pixels the output needs. If the photo has to be enlarged, it tells you how many real pixels per inch you have and when that is too low.
- **Background.** It looks at the two top corners and the top strip, where a head is least likely to be, and flags a dark, coloured or patterned wall. It does not change the background.
- **Frame.** It warns when the photo does not fill the frame, because empty edges print white.

## What it deliberately does not do

It does not retouch, smooth, brighten, remove or replace a background, or apply a filter. The US, UK, Canadian and Australian authorities all reject digitally altered photos, and a tool that quietly "improved" your picture would be setting you up to be refused. The US page says not to change your photo "using computer software, phone apps or filters, or artificial intelligence". Take the photo against a plain light wall in even light, then use this to frame it.

Two authorities add conditions a home crop cannot meet. Canada asks for printed photos from a commercial photographer or studio and wants the original file for digital ones. Australia asks for dye-sublimation prints on heavy glossy paper and says it does not recommend photo apps or online services. The tool shows these notes when you pick those countries.

## When not to use a pre-cropped photo

For US online passport renewal and for UK online applications, the official tool wants a large, unedited original and crops it for you. Upload your original, not a crop from here. Use this tool for the printed photo, or for forms that ask for a finished crop.

## Downloads

- **Photo (JPG).** The exact pixel size for the printed size at 300 or 600 dpi. The print resolution is written into the file, so a print shop opens it at the right physical size instead of guessing.
- **Online version.** Where the authority publishes pixel and file-size limits, a second file sized to them. The tool searches for the highest JPEG quality that fits the size cap, and says so if nothing fits.
- **Print sheet.** As many copies as fit on a 4 x 6 in, 5 x 7 in, A4 or US Letter sheet, tried both ways round, with light cutting guides. Download it as a JPG, or as a PDF whose page is the true paper size. Print at 100% or "actual size", never "fit to page".

## Limits

- It does not find your face for you, so you line it up by eye against the guides.
- The guidelines follow published head heights, not every other rule: expression, glasses, head coverings and shadows are yours to check against the authority's page.
- Cropping a different aspect ratio for an online portal keeps the head height and chin line and changes only the side margins.
- Rules change. The checked date is on every standard, and you should confirm on the page you apply through.
- It is not an official service. Neither this tool nor any other can promise acceptance.

## Questions

**What size is a passport photo?** It depends on the country: 2 x 2 inches (51 x 51 mm) for the US, 35 x 45 mm for the UK and most of Europe, 50 x 70 mm for Canada. The table above lists the rest.

**Can I take a passport photo at home?** Often yes, if it meets the rules: a plain light background, even light, a neutral expression and a recent photo. Check your authority's page first, because Canada and Australia add conditions about who prints it and on what.

**Is it really free, with no limit?** Yes. There is no watermark, no account and no daily cap, and nothing is paid for.

**Do you keep my photo?** No. It never leaves your browser, and nothing is stored. There is no server on the path to keep it.

**Can it make my background white?** No, and that is deliberate. Authorities reject edited photos. Retake it against a plain light wall.

**Why does it say my photo is soft?** The crop needs more pixels than your photo has at that zoom. Use the original from your camera rather than a screenshot or a messaging-app copy, or step back and zoom less.

## Sources

- US passport photos: [travel.state.gov](https://travel.state.gov/content/travel/en/passports/how-apply/photos.html), digital upload: [travel.state.gov](https://travel.state.gov/content/travel/en/passports/how-apply/online-renewal-photo.html), visa photos: [travel.state.gov](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html)
- UK: [GOV.UK photo requirements](https://www.gov.uk/photos-for-passports/photo-requirements) and [digital photo rules](https://www.gov.uk/photos-for-passports/rules-for-digital-photos)
- Canada: [canada.ca passport photos](https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html)
- Australia: [passports.gov.au](https://www.passports.gov.au/help/passport-photos)
- ICAO and Schengen: [ICAO Doc 9303 Part 3](https://www.icao.int/sites/default/files/publications/DocSeries/9303_p3_cons_en.pdf), [European Commission](https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/applying-schengen-visa_en)
- India: [Passport Seva booklet](https://www.passportindia.gov.in/AppOnlineProject/pdf/ApplicationformInstructionBooklet-V3.0.pdf), [Embassy of India Berlin](https://indianembassyberlin.gov.in/pdf/photo-specifiation.pdf), [OCI services FAQ](https://ociservices.gov.in/onlineOCI/faq)
- Japan: [MOFA](https://www.mofa.go.jp/mofaj/toko/passport/ic_photo.html)
- China: [visaforchina.cn upload FAQ](https://www.visaforchina.cn/MAN3_EN/qianzhengyewu/jichuzhishi/changjianwenti/164185152103256105.html)
- Singapore: [ICA photo guidelines](https://www.ica.gov.sg/photo-guidelines)

Everything runs locally in your browser. No photo you add is uploaded, and the files you download are built on your device.
