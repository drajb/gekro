---
title: "API सार्वभौमत्व: रात्री 2 वाजताच्या बिघाडासाठी बांधणी"
description: "जेनेरिक API रॅपर्स धोका का असतात आणि लवचिक, मल्टी-प्रोव्हायडर फॉलबॅक साखळी कशी बनवायची."
publishedAt: "2026-03-15"
difficulty: "Advanced"
topics: ["APIs", "Architecture", "Python"]
readingTime: 8
aiSummary: "Rohit क्लाउड API आउटेज दरम्यान सिस्टीमची लवचिकता टिकवण्यासाठी स्थानिक Ollama इन्स्टन्सवर स्वयंचलित फॉलबॅक असलेला मल्टी-प्रोव्हायडर LLM क्लायंट राबवतात."
sourceHash: "c88de751c68b7f5aca29936c99b6b067a8c0af73c9dd0ed1f57ccb55cb827bb3"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  एकच AI प्रोव्हायडर हार्डकोड करणे म्हणजे आर्किटेक्चरमधील निष्काळजीपणा. मी एक एकात्मिक LLM क्लायंट बनवला, जो Together AI ला प्राधान्य देतो पण क्लाउड बंद पडल्यावर आपोआप स्थानिक Ollama इन्स्टन्सवर जातो. हा लेख GekroLLMClient पॅटर्न उलगडतो, जो हाताने हस्तक्षेप न करता माझी लॅब 24/7 चालू ठेवतो.
</TLDR>

डलासमध्ये रात्रीचे 2 वाजले आहेत. एक नेहमीचा cron जॉब एका एजंटला माझ्या सर्व्हर लॉगचा सारांश काढायला सुरू करतो. Together AI ची API 503 परत करते. सामान्य सेटअपमध्ये पाइपलाइन मरते, एक नोटिफिकेशन मला जागे करते, आणि माझ्या नियंत्रणात नसलेली डिपेंडन्सी दुरुस्त करण्यात मी एक तास झोप गमावतो. माझ्या लॅबमध्ये तो बिघाड अदृश्य असतो. सिस्टीम टाइमआउट ओळखते, एक्सेप्शन पकडते आणि रिक्वेस्ट माझ्या एका Raspberry Pi वर चालणाऱ्या Llama 3 इन्स्टन्सकडे वळवते. लवचिकता हे फीचर नाही; ती सार्वभौमत्वाची गरज आहे.

## आर्किटेक्चर

मूळ तत्त्वज्ञान सोपे आहे: **ताकदीसाठी क्लाउड, लवचिकतेसाठी लोकल, रचनेतच फॉलबॅक.** जड इन्फरन्ससाठी मी क्लाउड प्रोव्हायडर वापरतो, पण प्रत्येक रिक्वेस्टसाठी एक स्थानिक सुटकेचा मार्ग असल्याची खात्री करतो. मी लोकल आणि क्लाउड मॉडेल वेगवेगळ्या प्रजाती मानत नाही; ते एकाच नेटवर्कमधील फक्त वेगवेगळे कॉम्प्युट नोड आहेत.

| वैशिष्ट्य | क्लाउड (Together AI / Anthropic) | लोकल (Pi/Mac वर Ollama) |
| :--- | :--- | :--- |
| **लेटन्सी** | 500ms - 2s (नेटवर्कवर अवलंबून) | 50ms - 5s (हार्डवेअरवर अवलंबून) |
| **खर्च** | प्रति-टोकन ($$$) | 0 डॉलर (फक्त वीज) |
| **विश्वासार्हता** | "अपटाइम" (आउटेजच्या अधीन) | 100% (एअर-गॅप्ड सक्षम) |
| **गोपनीयता** | PII धोक्यात | संपूर्ण शून्य-गळती |

माझे आर्किटेक्चर **युनिव्हर्सल इन्फरन्स लेयर** वापरते. ॲप्लिकेशन लॉजिकला कधीच कळत नाही की तो डेटा सेंटरमधील मोठ्या क्लस्टरशी बोलत आहे की माझ्या दिवाणखान्यातील ARM कोअरच्या संचाशी.

## बांधणी

अंमलबजावणीसाठी एकात्मिक इंटरफेस हवा. कठोर करार लागू करण्यासाठी मी Python चे `abc` मॉड्यूल वापरतो. प्रोव्हायडर Together AI असो (OpenAI-सुसंगत स्पेक वापरून) किंवा Ollama, कॉल करणारा कोड सारख्याच ऑब्जेक्ट्स हाताळतो.

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

### साखळीची पडताळणी

माझा कोड अपयशी होताना पाहिल्याशिवाय मी त्यावर विश्वास ठेवत नाही. हा pytest संच API की बिघडवून नेटवर्क आउटेजची नक्कल करतो आणि फॉलबॅक लॉजिक तपासतो.

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

### WSL2 टीप

तुम्ही हे Windows वर चालवत असाल, तर Ollama होस्टवर चालत असल्यास तुमचा `OLLAMA_HOST` `http://172.x.x.x:11434` (तुमचा Windows IP) वर सेट असल्याची खात्री करा, किंवा तो WSL2 इन्स्टन्सच्या आत असल्यास फक्त `localhost`. मी Ollama ला Windows होस्टवर चालवणे पसंत करतो, म्हणजे GPU थेट वापरता येतो आणि माझे डेव्ह वातावरण Ubuntu मध्ये राहते.

## तडजोडी

प्रामाणिकपणे सांगायचे तर, फॉलबॅक लॉजिक लेटन्सी वाढवते. एक अयशस्वी क्लाउड कॉल आणि 3 रिट्राय यांना लोकल मॉडेल विचार सुरू करण्याआधीच सुमारे 7 सेकंद लागतात. रिअल-टाइम चॅटसाठी तो "तुटलेला" UI आहे. पण Gekro-लॉग पार्सर, स्वयंचलित संशोधन आणि कोड इंडेक्सर चालवणाऱ्या बॅकग्राउंड एजंट्ससाठी 7 सेकंदांची लेटन्सी संपूर्ण सिस्टीम क्रॅश होण्यापेक्षा चांगली आहे.

एक **क्वालिटी क्लिफ** देखील आहे. Together AI वरील Llama 3-70B आणि Pi वरील क्वांटाइझ्ड Llama 3-8B हे मूलतः वेगळे मेंदू आहेत. कॉल करणारा कोड तोच इंटरफेस पाहतो, पण लोकल मॉडेलची उत्तरे लहान, कमी सूक्ष्म आणि एज केसेस चुकवण्याकडे अधिक कल असलेली असतात. स्ट्रक्चर्ड एक्स्ट्रॅक्शन किंवा सारांशासाठी ही दरी हाताळण्याजोगी आहे. जटिल रीझनिंगसाठी लोकल फॉलबॅक ही पट्टी आहे, इलाज नाही. फॉलबॅक दरम्यान फक्त घटलेला वेगच नव्हे तर घटलेले आउटपुटही सहन करतील असे तुमचे एजंट डिझाइन करा.

सर्वात मोठा छुपा खर्च म्हणजे **कॉन्टेक्स्ट मॅनेजमेंट**. मी क्लाउडमध्ये 128k कॉन्टेक्स्टचे मॉडेल वापरत असेन आणि लोकलमध्ये 8k च्या मॉडेलवर आलो, तर प्रॉम्प्ट खूप लांब असल्यास लोकल मॉडेल हॅल्युसिनेट करेल किंवा क्रॅश होईल. मी हे कठीण मार्गाने शिकलो, जेव्हा माझ्या रात्रीच्या सारांश एजंटने स्थानिक Llama 3-8B ला 50k टोकनची लॉग फाइल भरवली आणि OOM किलरने इन्फरन्सच्या मध्यातच प्रोसेस संपवली. फॉलबॅक दरम्यान तुम्हाला आक्रमकपणे छाटावे लागते.

## पुढे काय

हा क्लायंट **कॉन्सेन्सस आर्किटेक्चर** कडे पहिले पाऊल आहे. एक मॉडेल बरोबर असण्यावर अवलंबून राहण्याऐवजी मला माझा क्लायंट तीन मॉडेल्सना (Together, Groq आणि लोकल) एकाच वेळी पोल करेल आणि सर्वोत्तम उत्तर निवडण्यासाठी एक "Adjudicator" मॉडेल वापरेल असे हवे आहे. अपटाइम ही किमान पातळी आहे. वेगवेगळे मेंदू एकाच समस्येकडे कसे पाहतात याची तुलना करून लॅबला अधिक स्मार्ट बनवणे हे ध्येय आहे.
