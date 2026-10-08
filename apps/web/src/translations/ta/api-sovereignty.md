---
title: "API இறையாண்மை: அதிகாலை 2 மணித் தோல்விக்கான கட்டமைப்பு"
description: "பொதுவான API உறைகள் ஏன் ஆபத்து, நெகிழ்திறன் கொண்ட பல-வழங்குநர் மாற்றுச் சங்கிலியை எப்படி உருவாக்குவது."
publishedAt: "2026-03-15"
difficulty: "Advanced"
topics: ["APIs", "Architecture", "Python"]
readingTime: 8
aiSummary: "கிளவுட் API செயலிழப்புகளின்போது அமைப்பின் நெகிழ்திறனை உறுதிசெய்ய, உள்ளூர் Ollama நிகழ்வுகளுக்குத் தானியங்கி மாற்று வசதியுடன் கூடிய பல-வழங்குநர் LLM கிளையன்ட்டை Rohit செயல்படுத்துகிறார்."
sourceHash: "c88de751c68b7f5aca29936c99b6b067a8c0af73c9dd0ed1f57ccb55cb827bb3"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  ஒரே AI வழங்குநரைக் குறியீட்டிலேயே பதித்துவிடுவது கட்டமைப்பு அலட்சியம். Together AI-க்கு முன்னுரிமை தந்து, கிளவுட் இருண்டதும் தானாகவே உள்ளூர் Ollama நிகழ்வுகளுக்கு மாறும் ஒருங்கிணைந்த LLM கிளையன்ட்டை உருவாக்கினேன். கைமுறைத் தலையீடு இல்லாமல் என் ஆய்வகத்தை 24/7 இயக்கும் GekroLLMClient வடிவத்தை இந்தக் கட்டுரை விளக்குகிறது.
</TLDR>

டல்லாஸில் அதிகாலை 2 மணி. வழக்கமான cron வேலை ஒன்று என் சர்வர் பதிவுகளைச் சுருக்க ஒரு ஏஜென்ட்டை இயக்குகிறது. Together AI-இன் API 503 தருகிறது. சாதாரண அமைப்பில் பைப்லைன் இறந்துவிடும், ஓர் அறிவிப்பு என்னை எழுப்பும், என் கட்டுப்பாட்டில் இல்லாத ஒரு சார்பைச் சரிசெய்ய ஒரு மணி நேரத் தூக்கத்தை இழப்பேன். என் ஆய்வகத்தில் அந்தத் தோல்வி கண்ணுக்குத் தெரிவதில்லை. அமைப்பு காலக்கெடுவைக் கண்டறிந்து, விதிவிலக்கைப் பிடித்து, கோரிக்கையை என் Raspberry Pi-களில் ஒன்றில் இயங்கும் Llama 3 நிகழ்வுக்குத் திருப்பிவிடுகிறது. நெகிழ்திறன் ஒரு அம்சம் அல்ல; அது இறையாண்மைக்கான தேவை.

## கட்டமைப்பு

மைய தத்துவம் எளிது: **ஆற்றலுக்குக் கிளவுட், நெகிழ்திறனுக்கு உள்ளூர், வடிவமைப்பிலேயே மாற்று.** கனமான அனுமானத்துக்குக் கிளவுட் வழங்குநர்களைப் பயன்படுத்துகிறேன், ஆனால் ஒவ்வொரு கோரிக்கைக்கும் ஓர் உள்ளூர் தப்பிக்கும் வழி இருப்பதை உறுதிசெய்கிறேன். உள்ளூர் மாடல்களையும் கிளவுட் மாடல்களையும் வெவ்வேறு இனங்களாக நான் கருதுவதில்லை; அவை ஒரே நெட்வொர்க்கில் உள்ள வெவ்வேறு கணிப்பு நோடுகள் மட்டுமே.

| அம்சம் | கிளவுட் (Together AI / Anthropic) | உள்ளூர் (Pi/Mac-இல் Ollama) |
| :--- | :--- | :--- |
| **தாமதம்** | 500ms - 2s (நெட்வொர்க்கைப் பொறுத்தது) | 50ms - 5s (வன்பொருளைப் பொறுத்தது) |
| **செலவு** | ஒரு டோக்கனுக்கு ($$$) | 0 டாலர் (மின்சாரம் மட்டும்) |
| **நம்பகத்தன்மை** | "இயக்க நேரம்" (செயலிழப்புக்கு உட்பட்டது) | 100% (இணைப்பற்ற நிலையிலும் இயங்கும்) |
| **தனியுரிமை** | PII ஆபத்தில் | முழுமையான பூஜ்ஜிய-கசிவு |

என் கட்டமைப்பு ஒரு **உலகளாவிய அனுமான அடுக்கைப்** பயன்படுத்துகிறது. பயன்பாட்டுத் தர்க்கத்துக்குத் தரவு மையத்திலுள்ள பெரிய கிளஸ்டருடன் பேசுகிறோமா, என் வரவேற்பறையிலுள்ள ARM கோர்களின் தொகுப்புடன் பேசுகிறோமா என்பது ஒருபோதும் தெரியாது.

## உருவாக்கம்

செயலாக்கத்துக்கு ஒருங்கிணைந்த இடைமுகம் தேவை. கடுமையான ஒப்பந்தத்தைச் செயல்படுத்த Python-இன் `abc` தொகுதியைப் பயன்படுத்துகிறேன். வழங்குநர் Together AI ஆனாலும் (OpenAI-இணக்க வரையறையுடன்) Ollama ஆனாலும், அழைக்கும் குறியீடு ஒரே பொருள்களைக் கையாள்கிறது.

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

### சங்கிலியைச் சரிபார்த்தல்

என் குறியீடு தோல்வியடைவதைப் பார்க்கும் வரை அதை நம்புவதில்லை. இந்த pytest தொகுப்பு API விசையைக் கெடுத்து நெட்வொர்க் செயலிழப்பை உருவகப்படுத்தி, மாற்றுத் தர்க்கத்தைச் சரிபார்க்கிறது.

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

### WSL2 குறிப்பு

இதை Windows-இல் இயக்கினால், Ollama ஹோஸ்டில் இயங்கினால் உங்கள் `OLLAMA_HOST` `http://172.x.x.x:11434` (உங்கள் Windows IP) என்றும், WSL2 நிகழ்வுக்குள் இருந்தால் வெறும் `localhost` என்றும் அமைக்கப்பட்டிருப்பதை உறுதிசெய்யுங்கள். GPU-வை நேரடியாகப் பயன்படுத்தவும், என் மேம்பாட்டுச் சூழலை Ubuntu-வில் வைத்துக்கொள்ளவும் Ollama-வை Windows ஹோஸ்டில் இயக்குவதையே விரும்புகிறேன்.

## சமரசங்கள்

நேர்மையாகச் சொன்னால், மாற்றுத் தர்க்கம் தாமதத்தைக் கூட்டுகிறது. தோல்வியடைந்த கிளவுட் அழைப்பும் 3 மறுமுயற்சிகளும் சேர்ந்து, உள்ளூர் மாடல் சிந்திக்கத் தொடங்கும் முன்பே சுமார் 7 வினாடிகள் எடுக்கும். நிகழ்நேர அரட்டைக்கு அது "உடைந்த" UI. ஆனால் Gekro-பதிவு பகுப்பிகள், தானியங்கு ஆய்வு, குறியீட்டு அட்டவணையாக்கிகளை இயக்கும் பின்னணி ஏஜென்ட்களுக்கு, 7 வினாடித் தாமதம் முழு அமைப்பும் செயலிழப்பதை விடச் சிறந்தது.

ஒரு **தரச் சரிவும்** உள்ளது. Together AI-இல் Llama 3-70B-உம் Pi-இல் குவாண்டைஸ் செய்த Llama 3-8B-உம் அடிப்படையில் வேறுபட்ட மூளைகள். அழைக்கும் குறியீடு அதே இடைமுகத்தைக் காண்கிறது, ஆனால் உள்ளூர் மாடலின் பதில்கள் குறுகியவை, நுணுக்கம் குறைந்தவை, விளிம்பு நிலைகளைத் தவறவிடும் வாய்ப்பு அதிகம். கட்டமைப்புள்ள பிரித்தெடுப்பு அல்லது சுருக்கத்துக்கு இந்த இடைவெளியைக் கையாளலாம். சிக்கலான காரணமறிதலுக்கு, உள்ளூர் மாற்று ஒரு கட்டு, குணமல்ல. மாற்றுப் பயன்பாட்டின்போது குறைந்த வேகத்தை மட்டுமல்ல, தரம் குறைந்த வெளியீட்டையும் தாங்கும்படி உங்கள் ஏஜென்ட்களை வடிவமைக்கவும்.

மிகப்பெரிய மறைந்த செலவு **சூழல் மேலாண்மை**. கிளவுடில் 128k சூழல் மாடலைப் பயன்படுத்தி, உள்ளூரில் 8k மாடலுக்கு மாறினால், ப்ராம்ப்ட் மிக நீளமாக இருந்தால் உள்ளூர் மாடல் மாயத்தோற்றம் காட்டும் அல்லது செயலிழக்கும். என் இரவுச் சுருக்க ஏஜென்ட் உள்ளூர் Llama 3-8B-க்கு 50k டோக்கன் பதிவுக் கோப்பை ஊட்ட முயன்று, OOM கில்லர் அனுமானத்தின் நடுவிலேயே செயல்முறையை முடித்தபோது இதைக் கடினமான வழியில் கற்றுக்கொண்டேன். மாற்றுப் பயன்பாட்டின்போது ப்ராம்ப்டை ஆக்ரோஷமாக வெட்டிச் சுருக்க வேண்டும்.

## இது எங்கே செல்கிறது

இந்த கிளையன்ட் **ஒருமித்த கட்டமைப்பை** நோக்கிய முதல் படி. ஒரு மாடல் சரியாக இருக்கும் என்று நம்புவதற்குப் பதிலாக, என் கிளையன்ட் மூன்று மாடல்களை (Together, Groq, உள்ளூர்) ஒரே நேரத்தில் வினவி, சிறந்த பதிலைத் தேர்ந்தெடுக்க ஒரு "Adjudicator" மாடலைப் பயன்படுத்த வேண்டும் என்பது என் விருப்பம். இயக்க நேரம்தான் தளம். ஒரே பிரச்சினையை வெவ்வேறு மூளைகள் எப்படிப் பார்க்கின்றன என்பதை ஒப்பிட்டு ஆய்வகத்தை மேலும் புத்திசாலியாக்குவதே இலக்கு.
