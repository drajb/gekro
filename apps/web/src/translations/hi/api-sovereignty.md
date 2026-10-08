---
title: "API संप्रभुता: रात 2 बजे की विफलता के लिए निर्माण"
description: "जेनेरिक API रैपर जोखिम क्यों हैं और एक लचीली, मल्टी-प्रोवाइडर फ़ॉलबैक चेन कैसे बनाएँ।"
publishedAt: "2026-03-15"
difficulty: "Advanced"
topics: ["APIs", "Architecture", "Python"]
readingTime: 8
aiSummary: "Rohit क्लाउड API आउटेज के दौरान सिस्टम का लचीलापन बनाए रखने के लिए लोकल Ollama इंस्टेंस पर स्वचालित फ़ॉलबैक वाला मल्टी-प्रोवाइडर LLM क्लाइंट लागू करते हैं।"
sourceHash: "c88de751c68b7f5aca29936c99b6b067a8c0af73c9dd0ed1f57ccb55cb827bb3"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  किसी एक AI प्रोवाइडर को हार्डकोड करना आर्किटेक्चर की लापरवाही है। मैंने एक एकीकृत LLM क्लाइंट बनाया जो Together AI को प्राथमिकता देता है, लेकिन क्लाउड ठप होते ही अपने आप लोकल Ollama इंस्टेंस पर चला जाता है। यह लेख GekroLLMClient पैटर्न को खोलकर समझाता है, जो बिना मैन्युअल दख़ल के मेरी लैब को 24/7 चालू रखता है।
</TLDR>

डलास में रात के 2 बज रहे हैं। एक रूटीन cron जॉब एक एजेंट को मेरे सर्वर लॉग का सारांश बनाने के लिए चलाती है। Together AI की API 503 लौटाती है। सामान्य सेटअप में पाइपलाइन मर जाती है, एक नोटिफ़िकेशन मुझे जगा देता है, और मैं एक ऐसी डिपेंडेंसी ठीक करते हुए एक घंटे की नींद खो देता हूँ जो मेरे नियंत्रण में नहीं है। मेरी लैब में वह विफलता अदृश्य है। सिस्टम टाइमआउट पहचानता है, एक्सेप्शन पकड़ता है और रिक्वेस्ट को मेरे एक Raspberry Pi पर चल रहे Llama 3 इंस्टेंस पर भेज देता है। लचीलापन कोई फ़ीचर नहीं है; वह संप्रभुता की ज़रूरत है।

## आर्किटेक्चर

मूल दर्शन सरल है: **ताक़त के लिए क्लाउड, लचीलेपन के लिए लोकल, डिज़ाइन से फ़ॉलबैक।** भारी इन्फ़रेंस के लिए मैं क्लाउड प्रोवाइडर इस्तेमाल करता हूँ, लेकिन हर रिक्वेस्ट के लिए एक लोकल बचाव का रास्ता रखता हूँ। मैं लोकल और क्लाउड मॉडल को अलग-अलग प्रजातियाँ नहीं मानता; वे एक ही नेटवर्क के अलग-अलग कंप्यूट नोड भर हैं।

| विशेषता | क्लाउड (Together AI / Anthropic) | लोकल (Pi/Mac पर Ollama) |
| :--- | :--- | :--- |
| **लेटेंसी** | 500ms - 2s (नेटवर्क पर निर्भर) | 50ms - 5s (हार्डवेयर पर निर्भर) |
| **लागत** | प्रति-टोकन ($$$) | 0 डॉलर (सिर्फ़ बिजली) |
| **भरोसेमंदी** | "अपटाइम" (आउटेज के अधीन) | 100% (एयर-गैप्ड भी संभव) |
| **गोपनीयता** | PII का ख़तरा | पूर्ण शून्य-रिसाव |

मेरा आर्किटेक्चर एक **यूनिवर्सल इन्फ़रेंस लेयर** इस्तेमाल करता है। एप्लिकेशन लॉजिक को कभी पता नहीं चलता कि वह डेटा सेंटर के किसी विशाल क्लस्टर से बात कर रहा है या मेरे लिविंग रूम में रखे ARM कोर के किसी समूह से।

## निर्माण

कार्यान्वयन के लिए एक एकीकृत इंटरफ़ेस चाहिए। मैं एक सख़्त अनुबंध लागू करने के लिए Python के `abc` मॉड्यूल का इस्तेमाल करता हूँ। प्रोवाइडर Together AI हो (OpenAI-संगत स्पेक के साथ) या Ollama, कॉल करने वाला कोड एक जैसे ऑब्जेक्ट सँभालता है।

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

### चेन की जाँच

जब तक मैंने अपने कोड को फ़ेल होते नहीं देख लिया, मैं उस पर भरोसा नहीं करता। यह pytest सुइट API कुंजी को ख़राब करके नेटवर्क आउटेज का अनुकरण करता है और फ़ॉलबैक लॉजिक को परखता है।

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

### WSL2 नोट

अगर आप इसे Windows पर चला रहे हैं, तो पक्का कर लें कि अगर Ollama होस्ट पर चल रहा है तो आपका `OLLAMA_HOST` `http://172.x.x.x:11434` (आपका Windows IP) पर सेट हो, या अगर वह WSL2 इंस्टेंस के भीतर है तो बस `localhost`। मैं Ollama को Windows होस्ट पर चलाना पसंद करता हूँ ताकि GPU सीधे इस्तेमाल हो और मेरा डेव एनवायरनमेंट Ubuntu में रहे।

## समझौते

ईमानदारी से कहें तो फ़ॉलबैक लॉजिक लेटेंसी बढ़ाता है। एक फ़ेल क्लाउड कॉल और 3 रीट्राई में लगभग 7 सेकंड लगते हैं, इसके बाद ही लोकल मॉडल सोचना शुरू करता है। रियल-टाइम चैट के लिए यह "टूटा हुआ" UI है। लेकिन Gekro-लॉग पार्सर, स्वचालित रिसर्च और कोड इंडेक्सर चलाने वाले बैकग्राउंड एजेंटों के लिए 7 सेकंड की लेटेंसी पूरे सिस्टम के क्रैश होने से बेहतर है।

एक **क्वालिटी क्लिफ़** भी है। Together AI पर Llama 3-70B और Pi पर क्वांटाइज़्ड Llama 3-8B बुनियादी तौर पर अलग दिमाग़ हैं। कॉल करने वाला कोड वही इंटरफ़ेस देखता है, लेकिन लोकल मॉडल के जवाब छोटे, कम बारीक और कोने के मामले चूकने की ओर ज़्यादा झुके होते हैं। स्ट्रक्चर्ड एक्सट्रैक्शन या सारांश के लिए यह अंतर सँभालने लायक़ है। जटिल रीज़निंग के लिए लोकल फ़ॉलबैक पट्टी है, इलाज नहीं। अपने एजेंटों को ऐसे डिज़ाइन करें कि वे फ़ॉलबैक के दौरान सिर्फ़ घटी हुई रफ़्तार ही नहीं, घटे हुए आउटपुट को भी बर्दाश्त करें।

सबसे बड़ी छिपी लागत **कॉन्टेक्स्ट मैनेजमेंट** है। अगर मैं क्लाउड में 128k कॉन्टेक्स्ट वाला मॉडल इस्तेमाल कर रहा हूँ और लोकल में 8k वाले मॉडल पर आ जाता हूँ, तो प्रॉम्प्ट बहुत लंबा होने पर लोकल मॉडल हैलुसिनेट करेगा या क्रैश हो जाएगा। यह मैंने कड़वे अनुभव से सीखा, जब मेरे रात के सारांश वाले एजेंट ने लोकल Llama 3-8B को 50k टोकन की लॉग फ़ाइल थमा दी और OOM किलर ने इन्फ़रेंस के बीच में प्रोसेस ख़त्म कर दिया। फ़ॉलबैक के दौरान आपको आक्रामक रूप से काट-छाँट करनी पड़ती है।

## आगे की राह

यह क्लाइंट **कंसेंसस आर्किटेक्चर** की ओर पहला क़दम है। एक मॉडल के सही होने पर निर्भर रहने के बजाय मैं चाहता हूँ कि मेरा क्लाइंट तीन मॉडलों (Together, Groq और लोकल) को एक साथ पोल करे और सबसे अच्छा जवाब चुनने के लिए एक "Adjudicator" मॉडल इस्तेमाल करे। अपटाइम तो बस फ़र्श है। लक्ष्य है यह तुलना करके लैब को और स्मार्ट बनाना कि अलग-अलग दिमाग़ एक ही समस्या को कैसे देखते हैं।
