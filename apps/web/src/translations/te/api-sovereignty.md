---
title: "API సార్వభౌమత్వం: రాత్రి 2 గంటల వైఫల్యం కోసం నిర్మాణం"
description: "సాధారణ API ర్యాపర్లు ఎందుకు ప్రమాదకరం, స్థితిస్థాపకమైన బహుళ-ప్రొవైడర్ ఫాల్‌బ్యాక్ చైన్‌ను ఎలా నిర్మించాలి."
publishedAt: "2026-03-15"
difficulty: "Advanced"
topics: ["APIs", "Architecture", "Python"]
readingTime: 8
aiSummary: "క్లౌడ్ API అంతరాయాల సమయంలో సిస్టమ్ స్థితిస్థాపకత కోసం లోకల్ Ollama ఇన్‌స్టెన్స్‌లకు ఆటోమేటిక్ ఫాల్‌బ్యాక్ ఉన్న బహుళ-ప్రొవైడర్ LLM క్లయింట్‌ను Rohit అమలు చేస్తున్నారు."
sourceHash: "c88de751c68b7f5aca29936c99b6b067a8c0af73c9dd0ed1f57ccb55cb827bb3"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  ఒకే AI ప్రొవైడర్‌ను హార్డ్‌కోడ్ చేయడం ఆర్కిటెక్చర్ నిర్లక్ష్యం. నేను Together AI కి ప్రాధాన్యమిచ్చే, క్లౌడ్ నిలిచిపోయినప్పుడు దానంతట అదే లోకల్ Ollama ఇన్‌స్టెన్స్‌లకు మారే ఏకీకృత LLM క్లయింట్‌ను నిర్మించాను. మాన్యువల్ జోక్యం లేకుండా నా ల్యాబ్‌ను 24/7 నడిపించే GekroLLMClient ప్యాటర్న్‌ను ఈ వ్యాసం విడమరుస్తుంది.
</TLDR>

డాలస్‌లో రాత్రి 2 గంటలు. ఒక రొటీన్ cron జాబ్ నా సర్వర్ లాగ్‌లను సారాంశం చేయడానికి ఒక ఏజెంట్‌ను ప్రేరేపిస్తుంది. Together AI API 503 ఇస్తుంది. సాధారణ సెటప్‌లో పైప్‌లైన్ చచ్చిపోతుంది, ఒక నోటిఫికేషన్ నన్ను నిద్ర లేపుతుంది, నా అదుపులో లేని డిపెండెన్సీని సరిచేస్తూ ఒక గంట నిద్ర పోగొట్టుకుంటాను. నా ల్యాబ్‌లో ఆ వైఫల్యం కనిపించదు. సిస్టమ్ టైమ్‌అవుట్‌ను గుర్తించి, ఎక్సెప్షన్‌ను పట్టుకుని, అభ్యర్థనను నా Raspberry Pi లలో ఒకదానిపై నడుస్తున్న Llama 3 ఇన్‌స్టెన్స్‌కు మళ్లిస్తుంది. స్థితిస్థాపకత ఒక ఫీచర్ కాదు; అది సార్వభౌమత్వానికి అవసరం.

## ఆర్కిటెక్చర్

ప్రధాన తత్వం సరళం: **శక్తికి క్లౌడ్, స్థితిస్థాపకతకు లోకల్, డిజైన్‌లోనే ఫాల్‌బ్యాక్.** భారీ ఇన్ఫరెన్స్ కోసం క్లౌడ్ ప్రొవైడర్లను వాడతాను, కానీ ప్రతి అభ్యర్థనకూ లోకల్ తప్పించుకునే దారి ఉండేలా చూసుకుంటాను. లోకల్, క్లౌడ్ మోడళ్లను నేను వేరువేరు జాతులుగా చూడను; అవి ఒకే నెట్‌వర్క్‌లోని వేరువేరు కంప్యూట్ నోడ్‌లు మాత్రమే.

| లక్షణం | క్లౌడ్ (Together AI / Anthropic) | లోకల్ (Pi/Mac పై Ollama) |
| :--- | :--- | :--- |
| **లేటెన్సీ** | 500ms - 2s (నెట్‌వర్క్‌పై ఆధారపడి) | 50ms - 5s (హార్డ్‌వేర్‌పై ఆధారపడి) |
| **ఖర్చు** | ప్రతి టోకెన్‌కు ($$$) | 0 డాలర్లు (విద్యుత్ మాత్రమే) |
| **విశ్వసనీయత** | "అప్‌టైమ్" (అంతరాయాలకు లోబడి) | 100% (ఎయిర్-గ్యాప్‌డ్ సామర్థ్యం) |
| **గోప్యత** | PII ప్రమాదంలో | సంపూర్ణ సున్నా-లీక్ |

నా ఆర్కిటెక్చర్ **యూనివర్సల్ ఇన్ఫరెన్స్ లేయర్**ను వాడుతుంది. అప్లికేషన్ లాజిక్‌కు తాను డేటా సెంటర్‌లోని భారీ క్లస్టర్‌తో మాట్లాడుతోందో, నా లివింగ్ రూమ్‌లోని ARM కోర్ల సమితితో మాట్లాడుతోందో ఎప్పటికీ తెలియదు.

## నిర్మాణం

అమలుకు ఏకీకృత ఇంటర్‌ఫేస్ కావాలి. కఠినమైన ఒప్పందాన్ని అమలు చేయడానికి Python యొక్క `abc` మాడ్యూల్‌ను వాడతాను. ప్రొవైడర్ Together AI అయినా (OpenAI-అనుకూల స్పెక్‌తో) Ollama అయినా, కాల్ చేసే కోడ్ ఒకే ఆబ్జెక్ట్‌లను నిర్వహిస్తుంది.

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

### చైన్‌ను ధ్రువీకరించడం

నా కోడ్ విఫలమవడాన్ని చూసేవరకు దాన్ని నమ్మను. ఈ pytest సూట్ API కీని పాడు చేయడం ద్వారా నెట్‌వర్క్ అంతరాయాన్ని అనుకరించి, ఫాల్‌బ్యాక్ లాజిక్‌ను ధ్రువీకరిస్తుంది.

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

### WSL2 గమనిక

మీరు దీన్ని Windows లో నడుపుతుంటే, Ollama హోస్ట్‌లో నడుస్తున్నట్లయితే మీ `OLLAMA_HOST` ను `http://172.x.x.x:11434` (మీ Windows IP) కు, లేదా అది WSL2 ఇన్‌స్టెన్స్ లోపల ఉంటే కేవలం `localhost` కు సెట్ చేశారని నిర్ధారించుకోండి. నేను Ollama ను Windows హోస్ట్‌లో నడపడానికి ఇష్టపడతాను, అప్పుడు GPU ని నేరుగా వాడుకోవచ్చు, నా డెవ్ వాతావరణం Ubuntu లో ఉంటుంది.

## రాజీలు

నిజాయితీగా చెప్పాలంటే, ఫాల్‌బ్యాక్ లాజిక్ లేటెన్సీని పెంచుతుంది. విఫలమైన క్లౌడ్ కాల్‌కు 3 రీట్రైలు కలిపితే, లోకల్ మోడల్ ఆలోచించడం మొదలుపెట్టకముందే సుమారు 7 సెకన్లు పడుతుంది. రియల్-టైమ్ చాట్‌కు అది "విరిగిన" UI. కానీ Gekro-లాగ్ పార్సర్లు, ఆటోమేటెడ్ పరిశోధన, కోడ్ ఇండెక్సర్లు నడిపే బ్యాక్‌గ్రౌండ్ ఏజెంట్లకు, 7 సెకన్ల లేటెన్సీ మొత్తం సిస్టమ్ క్రాష్ కన్నా మేలు.

ఒక **క్వాలిటీ క్లిఫ్** కూడా ఉంది. Together AI లోని Llama 3-70B, Pi లోని క్వాంటైజ్డ్ Llama 3-8B మౌలికంగా వేరువేరు మెదళ్లు. కాల్ చేసే కోడ్‌కు ఒకే ఇంటర్‌ఫేస్ కనిపిస్తుంది, కానీ లోకల్ మోడల్ జవాబులు చిన్నవిగా, తక్కువ సూక్ష్మంగా, అంచు కేసులను విస్మరించే అవకాశం ఎక్కువగా ఉంటాయి. స్ట్రక్చర్డ్ ఎక్స్‌ట్రాక్షన్ లేదా సారాంశానికి ఈ అంతరం నిర్వహించదగినదే. సంక్లిష్ట రీజనింగ్‌కు, లోకల్ ఫాల్‌బ్యాక్ ఒక కట్టు, చికిత్స కాదు. ఫాల్‌బ్యాక్ సమయంలో కేవలం తగ్గిన వేగాన్ని మాత్రమే కాక, తగ్గిన అవుట్‌పుట్‌ను కూడా తట్టుకునేలా మీ ఏజెంట్లను రూపొందించండి.

అతిపెద్ద దాగి ఉన్న ఖర్చు **కాంటెక్స్ట్ మేనేజ్‌మెంట్**. క్లౌడ్‌లో 128k కాంటెక్స్ట్ మోడల్‌ను వాడుతూ, లోకల్‌లో 8k మోడల్‌కు మారితే, ప్రాంప్ట్ చాలా పొడవుగా ఉంటే లోకల్ మోడల్ హాల్యుసినేట్ అవుతుంది లేదా క్రాష్ అవుతుంది. నా రాత్రి సారాంశ ఏజెంట్ 50k టోకెన్ల లాగ్ ఫైల్‌ను లోకల్ Llama 3-8B కి తినిపించడానికి ప్రయత్నించినప్పుడు, OOM కిల్లర్ ఇన్ఫరెన్స్ మధ్యలోనే ప్రాసెస్‌ను ముగించినప్పుడు నేను ఇది కష్టపడి నేర్చుకున్నాను. ఫాల్‌బ్యాక్ సమయంలో దూకుడుగా కత్తిరించాలి.

## ఇది ఎటు వెళ్తుంది

ఈ క్లయింట్ **కన్సెన్సస్ ఆర్కిటెక్చర్** వైపు మొదటి అడుగు. ఒక్క మోడల్ సరైనదై ఉండాలని నమ్ముకోకుండా, నా క్లయింట్ మూడు మోడళ్లను (Together, Groq, లోకల్) ఒకేసారి పోల్ చేసి, ఉత్తమ జవాబును ఎంచుకోవడానికి ఒక "Adjudicator" మోడల్‌ను వాడాలని నేను కోరుకుంటున్నాను. అప్‌టైమ్ అనేది కనీస స్థాయి మాత్రమే. ఒకే సమస్యను వేరువేరు మెదళ్లు ఎలా చూస్తాయో పోల్చడం ద్వారా ల్యాబ్‌ను మరింత తెలివైనదిగా చేయడమే లక్ష్యం.
