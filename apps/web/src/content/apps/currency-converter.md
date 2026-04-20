---
title: "Currency Converter"
description: "Convert between 25+ major world currencies. Switch base currency between USD, INR, EUR, and GBP. Rates are hardcoded with a last-verified date."
job: "25+ currencies · USD / INR / EUR / GBP base · hardcoded rates with date"
icon: "💱"
category: "finance"
status: "active"
publishedAt: "2026-04-19"
lastVerified: "2026-04-19"
license: "MIT"
aiSummary: "Offline currency converter covering 25+ major world currencies. Switch base between USD, INR, EUR, and GBP. All exchange rates are hardcoded and clearly dated — not live. For live rates, users are directed to XE.com."
personalUse: "Quick mental-math check when comparing international costs. The hardcoded approach means it works offline and loads instantly."
companionPostSlug: ""
---

## Data and accuracy

All exchange rates in this tool are **hardcoded approximations** last verified on **2026-04-19**. They are **not live** and will drift from real-world rates over time.

Currency markets fluctuate continuously. For any financial transaction, always use a live rate source such as [XE.com](https://xe.com) or your bank's published rate.

### Cross-rate calculation

When you switch the base currency to EUR, GBP, or INR, all rates are derived from the hardcoded USD pivot:

```
EUR/INR = (USD/INR) ÷ (USD/EUR)
```

This introduces a small rounding error compared to direct cross-rate quotes. For precision work, verify directly.

### Currencies included

USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, MXN, BRL, KRW, SGD, HKD, NOK, SEK, DKK, NZD, ZAR, AED, SAR, THB, PLN, HUF, TRY.

### Limitations

- Rates are static — not connected to any API.
- Does not account for bank spreads, transaction fees, or mid-market vs. buy/sell rates.
- Exotic and restricted currencies (e.g., VEF, IRR) are excluded.
