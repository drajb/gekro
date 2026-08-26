---
title: "500 Days and 30,000 Miles"
description: "Five hundred days ago I pointed a Raspberry Pi at my car and started keeping every mile it drove. It has captured 10.4 million data points without missing a beat I did not cause, and somewhere along the way it stopped being a logger and became something I can ask questions of."
publishedAt: "2026-08-25"
difficulty: "Intermediate"
topics: ["Tesla", "Raspberry Pi", "Self-Hosting", "AI Engineering"]
readingTime: 7
mainImage: "/images/blog/500-days-30000-miles.png"
aiSummary: "A self-hosted TeslaMate instance running in Docker on a Raspberry Pi 5 crossed 30,000 tracked miles on 23 August 2026 at 10:22:03 CDT, five hundred days after collection began on 12 April 2025. The system holds 10,356,022 position rows and 243,380 charge-detail rows in a 1,598 MB PostgreSQL database, averaging 20,712 rows per day, and has recorded 6,921 drives totalling 976 hours, 10,016 kWh across 513 charging sessions with 458 of them at home, and 35 over-the-air software updates. Collection uptime is 92 percent across the full period. Querying the raw data resolved a suspected wall connector fault: across 217,124 home charging samples the pilot signal held at 48 A on 217,118 of them, showing the connector never derated and identifying the vehicle dropping off the network on hot nights as the real cause of apparent charging interruptions. The article covers the stack, the practice of interrogating a personal telemetry database directly, and using LLMs to translate questions into SQL against owned data."
---

<TLDR>
  Five hundred days ago I pointed a Raspberry Pi at my car and started keeping every mile. It has since recorded 10.4 million data points into a 1.6 GB database, on a Pi that does nothing else and has not been asked to do anything else since. Last Sunday it logged the thirty thousandth mile. The part I did not expect is what the thing became: not a logger, but a database I can ask questions of in plain English, about my own life, that nobody else can answer.
</TLDR>

Last Sunday morning at 10:22, with the odometer reading 40,397.8, a Raspberry Pi in my house recorded the thirty thousandth mile of my driving. Five hundred days of collection, to the day.

Nothing marked it, because nothing was built to. A row landed in a Postgres table exactly like the ten million before it, which is the highest compliment I can pay a piece of infrastructure.

Ten million is not a figure of speech. The database holds **10,356,022 position rows** and another 243,380 rows of charging detail. That works out to roughly 20,700 new rows a day, every day, for five hundred days, from one dedicated node that has been left alone to do exactly this and nothing else.

## What Is Actually Running

Four Docker containers on a Raspberry Pi 5. TeslaMate does the collecting, Postgres 16 holds it, Grafana draws it, and Mosquitto publishes live state over MQTT so the rest of the house can react to the car arriving. That is the whole stack, and it has a machine to itself. I run several Pis in the lab, and this one is carved out for collection alone, doing nothing but keeping the record 24/7. Nothing else competes with it for CPU, memory or uptime, which means nothing else can take it down.

The collector is smarter than a polling loop. When the car is driving it samples every couple of seconds: position, speed, heading, elevation, battery level, power draw, temperatures. When the car is charging it follows the whole session rather than recording a start and an end. And when the car is parked it deliberately backs off and lets it sleep, because hammering a Tesla's API keeps it awake and costs you range overnight. That last decision is why the logger has never cost me range.

Five hundred days of that, complete and second by second, comes to **1.6 GB**, which is smaller than a single film. I keep waiting for storage to become a problem and it keeps not being one.

**30,144 miles** tracked against the odometer, 60.3 a day. **6,921 drives** covering 976 hours, which is forty full days spent behind the wheel. **10,016 kWh** across 513 charging sessions, **458 of them at home**, which is 89.3 percent and the single most useful thing I can tell anyone nervous about buying an EV. Thirty-five over-the-air updates captured, each one timestamped, giving me a personal firmware changelog more precise than anything Tesla publishes.

Collection uptime across the whole run is **92 percent**. For an unattended single-board computer with no ops team, I will take that every time.

A mile costs about 275 Wh out of the battery and about 368 Wh back into it, so roughly a quarter of everything I charge never reaches the road. Heat is what moves it, with hot months costing me 16 percent more per mile than mild ones and a Texas winter costing 3.

## The Part Nobody Tells You About

I kept SSHing into the Pi, and almost never because it needed fixing. I would connect because I wanted to see the data arriving, watch a drive land in the table while the car was still warm in the driveway, check that the charge curve from the night before looked like a charge curve. Early on I did it because I did not trust it yet. Later I did it because I had started to understand the schema, and understanding a schema is the point at which a database stops being a black box and starts being a place you can go and look.

That is a slower education than it sounds. You learn that a `drives` row appears the instant the car changes state, that a charging process and a charge sample are different objects with different lifetimes, that the odometer is the only field that never lies. You learn what your own data means, which is not the same as having it.

None of that required AI, and I want to be precise about the timeline: I was doing this well before an assistant could have written the queries for me. The learning was the work.

## Then the Queries Got Easy

What changed is that I stopped writing SQL and started asking questions.

Pointing an LLM at a schema I already understood turned a five-minute query into a ten-second one. Not because it knows my data, but because I do, and I can tell immediately when the answer it gives me is nonsense. That combination is the useful one. Somebody who has never opened the tables gets confidently wrong answers and has no way to catch them. Somebody who knows the schema and can now ask in English gets to skip straight to the interesting part.

The interesting part is that the questions get better. When querying is expensive you only ask the things you already suspect. When it is cheap you start asking things you have no hypothesis about, and those are where the surprises live. How does the average trip length change across seasons. When during the day does the car actually move. What does a charging session look like on the hottest night of the year compared to the mildest.

The Tesla app cannot answer any of that. It was never built to. It shows you a summary, and a summary can only ever answer the questions somebody anticipated when they designed it.

## The Question That Paid for the Whole Project

This summer I became convinced my wall connector was failing.

On hot nights, charging sessions in the app looked like they were stopping and restarting. The diagnosis suggested itself: thermal derating, the unit pulling back current as it heated, cycling the car in the way that quietly ages a battery over years. Replacing a wall connector is not cheap.

Then I remembered I did not have to guess. Every charging sample the thing had ever taken was on a disk in my house.

The pilot signal is the connector telling the car how many amps it may draw. Derating means that number drops. Across **217,124 samples taken at home, it read 48 amps on 217,118 of them.** Six readings out of two hundred thousand sit anywhere else, and the battery level never fell mid-session, which it would have done if the car had genuinely been cut off.

The connector had never faltered. Lining sessions up against outside temperature showed what was really going on: on the hottest nights the car itself was dropping off the network, so the logger lost sight of a session that was still running perfectly well.

I did not spend the money. That one answer, from data I already owned, on hardware I already had, covered the cost of the entire project several times over.

## The Next Twenty Thousand

At sixty miles a day, fifty thousand lands around the middle of next year, and the disk still will not care.

What I am actually waiting for is the comparison. One Texas summer tells you nothing about heat and batteries. Two lets you measure. Thirty thousand miles is roughly the point where a log stops being a log and becomes a baseline, and every month I leave it running the comparisons get sharper without any effort from me.

The Pi has been the least demanding piece of infrastructure I own and easily the most rewarding, because it compounds. It asked for a setup and the occasional SSH session, and in return it has quietly built something nobody can sell me, cancel on me, or price out of my reach: a complete, queryable record of how I actually use my own car.
