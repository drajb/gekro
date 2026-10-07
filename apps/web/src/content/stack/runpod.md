---
name: "RunPod"
category: "infra"
tagline: "Rent a GPU by the hour, SSH into it, and pay nothing when it is gone."

status: "active"
publishedAt: "2026-10-06"
lastVerified: "2026-10-06"

verdict: "RunPod is the cheapest sane way I have found to get a real GPU for a few hours without buying one, and an RTX 4090 at $0.34/hr on Community Cloud costs less than a coffee for an afternoon of inference. The catch is storage: your disk keeps billing after the GPU is gone, and it bills at double the rate while the pod sits stopped, so the way you shut down matters more than the GPU you picked."

priceTier: "paid-only"
pricingNotes: "Pay per second of GPU uptime, no subscription. Community Cloud RTX 4090 $0.34/hr, L40S $0.79/hr, A100 SXM $1.39/hr, H100 PCIe $1.99/hr; Secure Cloud runs roughly 20-100% higher. Storage is billed separately and continuously: container and volume disk $0.10/GB/mo while running, volume disk $0.20/GB/mo while stopped, network volumes $0.07/GB/mo."

goodAt:
  - "Per-second billing on the GPU with no monthly commitment. An afternoon of batch inference on a 4090 at $0.34/hr costs about $1.40, which is the part that makes renting beat buying for occasional work."
  - "Real root SSH into a real machine, so anything that runs on a Linux box runs here. I drive the pod from my own terminal instead of a hosted notebook, and Claude Code can work against it the same way it works against any remote host."
  - "Community Cloud undercuts Secure Cloud substantially on the same silicon: 4090 at $0.34 vs $0.74, H100 PCIe at $1.99 vs $2.89. For work you can restart, the cheaper tier is usually the right call."
  - "Network volumes decouple your data from one physical machine, so you can terminate a pod entirely, redeploy on whatever hardware is free, and reattach the same /workspace."

badAt:
  - "Volume storage costs MORE when you are not using it. $0.10/GB/mo running, $0.20/GB/mo stopped. Stopping a pod to save money doubles your storage bill, which is the exact opposite of what everyone assumes."
  - "Volume disk is deleted when a pod is terminated. Only network volumes survive, and that is a decision you have to make when you create the pod, not later."
  - "Stopping a pod releases its GPU to other renters, and your pod stays pinned to that one machine. RunPod's own FAQ documents restarting with zero GPUs attached because somebody else took the card while you were away."
  - "The basic SSH connection is proxied and does not support scp or sftp. File transfer needs a pod with a public IP and port 22 exposed, or you pull data from inside the pod instead of pushing it."
  - "Connection details change when a pod restarts, so saved SSH config and host entries go stale constantly."

alternatives: ["Vast.ai", "Lambda Labs", "Together AI", "a second-hand 3090 on your own desk"]

homepage: "https://runpod.io"
referralLink: "https://runpod.io?ref=2xpo09xp"

relatedPost: "api-sovereignty"

aiSummary: "RunPod rents cloud GPUs billed per second with no subscription, from about $0.34/hr for an RTX 4090 on Community Cloud up to $1.99/hr for an H100 PCIe. Its main cost trap is storage, which bills continuously and charges $0.20/GB/month for a stopped pod's volume disk versus $0.10/GB/month while running, so the cheapest pattern is a small disk, a network volume at $0.07/GB/month for anything worth keeping, and terminating rather than stopping."
---

I rented GPUs on RunPod for a batch of inference work rather than buying a card, and the arithmetic was easy: an RTX 4090 at $0.34 an hour on Community Cloud is about $1.40 for an afternoon. A card that does the same job sits on my desk costing money whether I use it or not.

Then I looked at the bill and the GPU was not the interesting line.

## Verdict

RunPod is genuinely good at the thing it advertises. You get a real Linux box with a real GPU, root SSH, per-second billing and no subscription, and for occasional heavy work that beats owning hardware by a wide margin. I would recommend it to anyone who needs a big card a few times a month.

What nobody tells you is that the storage model runs on completely different logic to the compute model, and if you treat it like the GPU you will quietly pay for nothing. Compute stops when you stop. Storage does not, and it gets more expensive the moment you stop using it.

## What it's good at

The per-second billing is the whole pitch and it works. Community Cloud is substantially cheaper than Secure Cloud for identical silicon, and for anything you can restart safely it is the obvious choice.

Root SSH is what makes it useful to me rather than merely cheap. It is an ordinary remote Linux machine, so my normal tooling works, and I can point Claude Code at it the same way I would at any other host. No notebook interface to fight, no proprietary runtime to learn.

## What it's bad at

Here is the number that reorganised how I use the service.

Volume disk is **$0.10/GB/month while the pod runs and $0.20/GB/month while it is stopped.** Storage costs double when you are not using it.

So the instinct everybody has, stop the pod to save money, is wrong in two directions at once. Your storage bill doubles, and stopping also releases the GPU back to the pool while your pod stays pinned to that specific machine. RunPod's own FAQ has an entry for restarting with zero GPUs attached, because somebody else rented the card while you were away.

Put a number on the idle disk and it gets worse. 100 GB sitting stopped is $20 a month, which is roughly 59 hours of the 4090 you are not using. Break-even against five hours of 4090 time a month arrives at **8.5 GB** of idle volume.

## How I use it

Keep the pod's own disk small. Whatever you actually need to keep goes on a **network volume at $0.07/GB/month**, which is cheaper than idle volume disk, does not double, and is not tied to one physical machine.

Then terminate rather than stop. Redeploy a fresh pod when you next need a GPU, reattach the same network volume, and you land on whatever hardware is free instead of queueing for one specific card that may be taken.

Everything else happens over SSH from my own terminal. The model weights get pulled from inside the pod rather than pushed from my laptop, which sidesteps the fact that the basic proxied SSH cannot do scp or sftp. The pod is disposable. The volume is the only thing that persists, and it is the only thing I pay for continuously.

## When I'd skip it

If you need a GPU most days, rent the hours for a month, work out what you actually spent, and compare it against a used 3090. At sustained load the maths flips toward owning.

If you only ever call a model rather than running one, skip GPU rental entirely and use a hosted inference API. RunPod is worth it when you need the machine, not just the model.
