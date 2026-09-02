---
title: "Unit Converter"
category: "dev"
job: "Convert data, electrical and physical units, and see every unit at once instead of picking one"
description: "Converts data sizes (with decimal and binary prefixes side by side), voltage, current, resistance, power, energy, length, mass, temperature, time, speed and pressure. Shows the value in every unit of the category at once rather than making you choose a target, and includes an Ohm's law solver. Runs entirely in your browser."
aiSummary: "A client-side multi-domain unit converter. Categories: data (bit through petabyte in both decimal 1000-step and binary 1024-step prefixes), voltage, current, resistance, power, energy, length, mass, temperature, time, speed and pressure. Rather than a from/to pair it converts into every unit of the selected category simultaneously. Data conversions make the decimal-versus-binary distinction explicit, which is why a 500 GB drive reports as 465 GiB. Temperature uses explicit offset conversions for Celsius, Fahrenheit, Kelvin and Rankine rather than a scale factor. Electrical categories add an Ohm's law solver that derives the remaining values from any two of volts, amps, ohms and watts."
personalUse: "I kept converting the same handful of things in a search bar and getting an answer with an ad on it. The specific one that annoyed me was disk sizes: I wanted to see gigabytes and gibibytes together, because that gap is the reason a 500 GB drive shows up as 465 GiB and the reason two of my own memory calculators disagreed with each other. So this shows the whole column at once, and the Ohm's law solver is there because I do enough small electronics that I was tired of rearranging V = IR in my head."
status: "active"
publishedAt: "2026-09-02"
lastVerified: "2026-09-02"
companionPostSlug: ""
license: "MIT"
icon: "📐"
---

## How this works

Most converters ask you to pick a source unit and a target unit. That assumes you
already know which target you want, which is often the thing you were trying to work
out. This one converts into **every unit in the category at once** and highlights the
one you typed into.

Every category except temperature is a linear scale, so conversion is
`value × fromFactor ÷ toFactor` against a base unit. Temperature scales have different
zero points, so those get explicit conversion functions instead of a factor.

## Data: decimal and binary, side by side

This is the category worth the most attention, because the confusion is universal.

- **Decimal prefixes** step by 1000. kB, MB, GB, TB. This is what drive manufacturers
  print on the box, and it is the SI meaning of "kilo".
- **Binary prefixes** step by 1024. KiB, MiB, GiB, TiB. This is what operating systems
  usually count in, because memory addressing is binary.

A "500 GB" drive holds 500,000,000,000 bytes, which is 465.66 GiB. Nothing is missing
and nobody is lying. The two systems drift apart by 2.4% per prefix step, so it is
7.4% by the gigabyte and 10% by the terabyte.

The table separates the two families with a header rather than interleaving them, so
you cannot accidentally read across from one to the other.

## Ohm's law solver

The electrical categories carry a four-field solver: volts, amps, ohms, watts. Fill in
any two and it derives the rest from `V = I × R` and `P = V × I`.

It only ever fills blanks, never the field you are typing in, so it cannot fight you
mid-entry. Where a pair is genuinely insufficient it says so instead of guessing.

## Categories

| Category | Base | Notable units |
|---|---|---|
| Data | byte | bit through PB, plus KiB through PiB |
| Voltage | volt | nV to MV |
| Current | ampere | pA to kA |
| Resistance | ohm | mΩ to GΩ |
| Power | watt | µW to GW, mechanical and metric horsepower, BTU/h |
| Energy | joule | eV, Wh, kWh, calorie, BTU |
| Length | metre | nm to km, inch, foot, yard, mile, nautical mile |
| Mass | kilogram | mg to tonne, ounce, pound, stone |
| Temperature | Celsius | Celsius, Fahrenheit, Kelvin, Rankine |
| Time | second | ns to years |
| Speed | m/s | km/h, mph, ft/s, knot |
| Pressure | pascal | kPa, MPa, bar, psi, atmosphere, mmHg |

## Precision

Values span an enormous range - an electronvolt and a kilowatt-hour sit in the same
category, twenty-five orders of magnitude apart. Fixed decimal places would be useless
at one end or the other, so the display switches to exponential notation beyond 10^15
and below 10^-6, and otherwise keeps enough significant figures that small values do
not collapse to zero.

## Sources

- SI prefixes and base units, and the IEC 80000-13 binary prefixes (kibi, mebi, gibi)
- International yard and pound agreement of 1959: inch = 25.4 mm exactly, pound = 0.45359237 kg exactly
- Nautical mile = 1852 m exactly, by international definition
- Mechanical horsepower = 745.6998715822702 W; metric horsepower (PS) = 735.49875 W
- Thermochemical calorie = 4.184 J; BTU (IT) = 1055.05585262 J

## Limitations

- **Linear scales only**, temperature aside. Anything with a non-linear response, like
  decibels or pH, is not here and would be misleading if it were.
- **No currency.** Rates change; that belongs in the
  [currency converter](/apps/currency-converter/), which carries a verification date.
- **Floating point.** Conversions run in IEEE 754 doubles, so chained conversions at
  extreme magnitudes can drift in the last significant figure.
- **The Ohm's law solver assumes DC**, or RMS values with a purely resistive load.
  Reactive circuits need impedance and a phase angle, which this does not model.

## Disclaimer

**This tool is provided as is, with no warranty of any kind, express or implied**,
including no warranty of accuracy, completeness or fitness for a particular purpose.
Verify anything safety-critical against a primary reference. Electrical work in
particular can be dangerous, and an arithmetic helper is not a substitute for a
qualified electrician. Use entirely at your own risk.
