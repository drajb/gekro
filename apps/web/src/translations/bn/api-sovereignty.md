---
title: "API সার্বভৌমত্ব: রাত 2টার ব্যর্থতার জন্য নির্মাণ"
description: "জেনেরিক API র‍্যাপার কেন ঝুঁকির কারণ এবং কীভাবে একটি স্থিতিস্থাপক, মাল্টি-প্রোভাইডার ফলব্যাক চেইন বানাবেন।"
publishedAt: "2026-03-15"
difficulty: "Advanced"
topics: ["APIs", "Architecture", "Python"]
readingTime: 8
aiSummary: "ক্লাউড API বিভ্রাটের সময় সিস্টেমের স্থিতিস্থাপকতা নিশ্চিত করতে Rohit লোকাল Ollama ইনস্ট্যান্সে স্বয়ংক্রিয় ফলব্যাকসহ একটি মাল্টি-প্রোভাইডার LLM ক্লায়েন্ট বাস্তবায়ন করেছেন।"
sourceHash: "c88de751c68b7f5aca29936c99b6b067a8c0af73c9dd0ed1f57ccb55cb827bb3"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  একটিমাত্র AI প্রোভাইডার হার্ডকোড করা আর্কিটেকচারগত অবহেলা। আমি এমন একটি একীভূত LLM ক্লায়েন্ট বানিয়েছি যা Together AI-কে অগ্রাধিকার দেয় কিন্তু ক্লাউড অন্ধকার হয়ে গেলে নিজে থেকেই লোকাল Ollama ইনস্ট্যান্সে সরে যায়। এই লেখায় GekroLLMClient প্যাটার্নটি ভেঙে দেখানো হয়েছে, যা হাতে-কলমে হস্তক্ষেপ ছাড়াই আমার ল্যাবকে 24/7 চালু রাখে।
</TLDR>

ডালাসে রাত 2টা। একটি রুটিন cron জব একটি এজেন্টকে আমার সার্ভার লগের সারাংশ বানাতে চালু করে। Together AI-এর API 503 ফেরত দেয়। সাধারণ সেটআপে পাইপলাইন মরে যায়, একটি নোটিফিকেশন আমাকে জাগিয়ে দেয়, আর আমি এমন একটি ডিপেন্ডেন্সি ঠিক করতে গিয়ে এক ঘণ্টার ঘুম হারাই যার ওপর আমার নিয়ন্ত্রণ নেই। আমার ল্যাবে সেই ব্যর্থতা অদৃশ্য। সিস্টেম টাইমআউট ধরে, এক্সেপশন লুফে নেয় এবং রিকোয়েস্টটিকে আমার একটি Raspberry Pi-তে চলা Llama 3 ইনস্ট্যান্সে পাঠিয়ে দেয়। স্থিতিস্থাপকতা কোনো ফিচার নয়; এটি সার্বভৌমত্বের প্রয়োজনীয়তা।

## আর্কিটেকচার

মূল দর্শন সহজ: **শক্তির জন্য ক্লাউড, স্থিতিস্থাপকতার জন্য লোকাল, নকশাতেই ফলব্যাক।** ভারী ইনফারেন্সের জন্য আমি ক্লাউড প্রোভাইডার ব্যবহার করি, তবে প্রতিটি রিকোয়েস্টের জন্য একটি লোকাল পালানোর পথ নিশ্চিত করি। আমি লোকাল আর ক্লাউড মডেলকে আলাদা প্রজাতি ভাবি না; সেগুলো একই নেটওয়ার্কের শুধু ভিন্ন কম্পিউট নোড।

| বৈশিষ্ট্য | ক্লাউড (Together AI / Anthropic) | লোকাল (Pi/Mac-এ Ollama) |
| :--- | :--- | :--- |
| **ল্যাটেন্সি** | 500ms - 2s (নেটওয়ার্কনির্ভর) | 50ms - 5s (হার্ডওয়্যারনির্ভর) |
| **খরচ** | প্রতি টোকেন ($$$) | 0 ডলার (শুধু বিদ্যুৎ) |
| **নির্ভরযোগ্যতা** | "আপটাইম" (বিভ্রাটের অধীন) | 100% (এয়ার-গ্যাপেও সক্ষম) |
| **গোপনীয়তা** | PII ঝুঁকিতে | সম্পূর্ণ শূন্য-ফাঁস |

আমার আর্কিটেকচারে আছে একটি **ইউনিভার্সাল ইনফারেন্স লেয়ার**। অ্যাপ্লিকেশন লজিক কখনও জানে না সে ডেটা সেন্টারের বিশাল ক্লাস্টারের সঙ্গে কথা বলছে, নাকি আমার লিভিং রুমের একগুচ্ছ ARM কোরের সঙ্গে।

## নির্মাণ

বাস্তবায়নের জন্য একটি একীভূত ইন্টারফেস দরকার। কড়া চুক্তি বলবৎ করতে আমি Python-এর `abc` মডিউল ব্যবহার করি। প্রোভাইডার Together AI হোক (OpenAI-সঙ্গত স্পেক ব্যবহার করে) বা Ollama, কল করা কোড একই অবজেক্ট সামলায়।

### GekroLLMClient

```python
import os
import time
import logging
from typing import List, Dict, Optional
from openai import OpenAI
import ollama

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GekroLab")

class GekroLLMClient:
    def __init__(self):
        self.cloud_client = OpenAI(
            api_key=os.getenv("TOGETHER_API_KEY"),
            base_url="https://api.together.xyz/v1",
        )
        self.local_url = os.getenv("OLLAMA_HOST", "http://localhost:11434")

    def chat(self, messages: List[Dict], model_cloud: str = "meta-llama/Llama-3-70b-chat-hf", 
             model_local: str = "llama3:8b", retries: int = 3) -> str:
        
        # Phase 1: Try Cloud (Together AI)
        for attempt in range(retries):
            try:
                logger.info(f"Attempting cloud inference (Attempt {attempt + 1})")
                response = self.cloud_client.chat.completions.create(
                    model=model_cloud,
                    messages=messages,
                    timeout=10.0
                )
                return response.choices[0].message.content
            except Exception as e:
                wait = 2 ** attempt
                logger.warning(f"Cloud failure: {e}. Retrying in {wait}s...")
                time.sleep(wait)

        # Phase 2: Automatic Fallback to Local (Ollama)
        logger.error("All cloud attempts failed. Falling back to local inference.")
        try:
            response = ollama.chat(
                model=model_local,
                messages=messages
            )
            return response['message']['content']
        except Exception as e:
            return f"CRITICAL SYSTEM FAILURE: All providers exhausted. Error: {str(e)}"

# Usage in the Gekro Lab environment
if __name__ == "__main__":
    client = GekroLLMClient()
    prompt = [{"role": "user", "content": "Analyze the thermal logs for the Tesla charging cycle."}]
    print(client.chat(prompt))
```

### চেইন যাচাই করা

আমার কোডকে ব্যর্থ হতে না দেখা পর্যন্ত আমি তাকে বিশ্বাস করি না। এই pytest স্যুট API কী নষ্ট করে নেটওয়ার্ক বিভ্রাট অনুকরণ করে এবং ফলব্যাক লজিক যাচাই করে।

```python
import pytest
from unittest.mock import patch, MagicMock
from gekro_client import GekroLLMClient

def test_fallback_logic():
    client = GekroLLMClient()
    
    # Mocking the cloud client to always fail
    client.cloud_client.chat.completions.create = MagicMock(side_effect=Exception("API Down"))
    
    # Mocking ollama to succeed
    with patch('ollama.chat') as mock_ollama:
        mock_ollama.return_value = {'message': {'content': 'Local Fallback Success'}}
        
        response = client.chat([{"role": "user", "content": "test"}])
        
        assert response == "Local Fallback Success"
        assert mock_ollama.called
```

### WSL2 নোট

আপনি যদি এটা Windows-এ চালান, তাহলে Ollama হোস্টে চললে আপনার `OLLAMA_HOST` যেন `http://172.x.x.x:11434` (আপনার Windows IP) এ সেট থাকে, কিংবা WSL2 ইনস্ট্যান্সের ভেতরে হলে শুধু `localhost`, তা নিশ্চিত করুন। আমি Ollama-কে Windows হোস্টে চালাতে পছন্দ করি, যাতে সরাসরি GPU ব্যবহার করা যায় আর আমার ডেভ পরিবেশ Ubuntu-তে থাকে।

## সমঝোতা

সৎভাবে বলতে গেলে, ফলব্যাক লজিক ল্যাটেন্সি বাড়ায়। একটি ব্যর্থ ক্লাউড কল আর 3 বার রিট্রাইয়ে লোকাল মডেল ভাবতে শুরু করার আগেই প্রায় 7 সেকেন্ড লাগে। রিয়েল-টাইম চ্যাটের জন্য সেটা "ভাঙা" UI। কিন্তু Gekro-লগ পার্সার, স্বয়ংক্রিয় গবেষণা আর কোড ইনডেক্সার চালানো ব্যাকগ্রাউন্ড এজেন্টদের জন্য 7 সেকেন্ডের ল্যাটেন্সি পুরো সিস্টেম ক্র্যাশ করার চেয়ে ভালো।

একটি **কোয়ালিটি ক্লিফ**-ও আছে। Together AI-তে Llama 3-70B আর Pi-তে কোয়ান্টাইজড Llama 3-8B মৌলিকভাবে আলাদা মস্তিষ্ক। কল করা কোড একই ইন্টারফেস দেখে, কিন্তু লোকাল মডেলের উত্তর ছোট, কম সূক্ষ্ম এবং প্রান্তিক ক্ষেত্র ফসকানোর দিকে বেশি ঝুঁকে থাকে। স্ট্রাকচার্ড এক্সট্র্যাকশন বা সারসংক্ষেপে ব্যবধানটা সামলানো যায়। জটিল রিজনিংয়ে লোকাল ফলব্যাক ব্যান্ডেজ, নিরাময় নয়। ফলব্যাকের সময় শুধু কমে যাওয়া গতি নয়, কমে যাওয়া আউটপুটও যেন সহ্য করতে পারে, এভাবে আপনার এজেন্টদের নকশা করুন।

সবচেয়ে বড় লুকানো খরচ **কনটেক্সট ম্যানেজমেন্ট**। আমি যদি ক্লাউডে 128k কনটেক্সটের মডেল ব্যবহার করি আর লোকালে 8k-র মডেলে ফলব্যাক করি, তাহলে প্রম্পট খুব বড় হলে লোকাল মডেল হ্যালুসিনেট করবে বা ক্র্যাশ করবে। আমি এটা কঠিনভাবে শিখেছি, যখন আমার রাতের সারাংশ এজেন্ট একটি লোকাল Llama 3-8B-কে 50k টোকেনের লগ ফাইল খাওয়াতে গেল আর OOM কিলার ইনফারেন্সের মাঝপথে প্রসেস শেষ করে দিল। ফলব্যাকের সময় আপনাকে আক্রমণাত্মকভাবে ছাঁটতে হবে।

## আগামী দিনে

এই ক্লায়েন্ট **কনসেনসাস আর্কিটেকচারের** দিকে প্রথম পদক্ষেপ। একটি মডেলের সঠিক হওয়ার ওপর নির্ভর করার বদলে আমি চাই আমার ক্লায়েন্ট একসঙ্গে তিনটি মডেলকে (Together, Groq ও লোকাল) পোল করুক এবং সেরা উত্তর বেছে নিতে একটি "Adjudicator" মডেল ব্যবহার করুক। আপটাইম হলো মেঝে। লক্ষ্য হলো একই সমস্যা ভিন্ন ভিন্ন মস্তিষ্ক কীভাবে দেখে তা তুলনা করে ল্যাবকে আরও স্মার্ট করা।
