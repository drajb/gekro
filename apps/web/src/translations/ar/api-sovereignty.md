---
title: "سيادة الـ API: البناء لعطل الساعة 2 فجرًا"
description: "لماذا تُعد أغلفة الـ API العامة عبئًا، وكيف تبني سلسلة احتياطية مرنة متعددة المزوّدين."
publishedAt: "2026-03-15"
difficulty: "Advanced"
topics: ["APIs", "Architecture", "Python"]
readingTime: 8
aiSummary: "ينفذ Rohit عميل نموذج لغوي متعدد المزوّدين مع تحويل تلقائي احتياطي إلى نسخ Ollama محلية لضمان مرونة النظام أثناء انقطاع واجهات الـ API السحابية."
sourceHash: "c88de751c68b7f5aca29936c99b6b067a8c0af73c9dd0ed1f57ccb55cb827bb3"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  تثبيت مزوّد ذكاء اصطناعي واحد في الشيفرة إهمال معماري. بنيت عميل نموذج لغوي موحدًا يعطي الأولوية لـ Together AI لكنه يتحول تلقائيًا إلى نسخ Ollama المحلية عندما تتوقف السحابة. يفصّل هذا المقال نمط GekroLLMClient الذي يُبقي مختبري يعمل 24/7 دون تدخل يدوي.
</TLDR>

الساعة 2 فجرًا في دالاس. مهمة cron روتينية تُشغّل وكيلًا لتلخيص سجلات خادمي. تُرجع واجهة Together AI الخطأ 503. في الإعداد المعتاد يموت خط المعالجة، وينبّهني إشعار من نومي، وأخسر ساعة من النوم لإصلاح تبعية لا أتحكم بها. أما في مختبري فهذا العطل غير مرئي. يكتشف النظام انتهاء المهلة، ويلتقط الاستثناء، ويعيد توجيه الطلب إلى نسخة Llama 3 تعمل على أحد أجهزة Raspberry Pi لدي. المرونة ليست ميزة؛ إنها شرط للسيادة.

## البنية

الفلسفة الأساسية بسيطة: **السحابة للقوة، والمحلي للمرونة، والاحتياط بالتصميم.** أستخدم مزوّدي السحابة للاستدلال الثقيل، لكنني أضمن أن لكل طلب مخرج طوارئ محليًا. لا أعامل النماذج المحلية والسحابية كأنواع مختلفة؛ إنها مجرد عقد حوسبة مختلفة في الشبكة نفسها.

| الميزة | السحابة (Together AI / Anthropic) | المحلي (Ollama على Pi/Mac) |
| :--- | :--- | :--- |
| **زمن الاستجابة** | 500ms - 2s (حسب الشبكة) | 50ms - 5s (حسب العتاد) |
| **التكلفة** | لكل رمز ($$$) | 0 دولار (الكهرباء فقط) |
| **الموثوقية** | "وقت التشغيل" (عرضة للانقطاع) | 100% (قادر على العمل معزولًا عن الشبكة) |
| **الخصوصية** | البيانات الشخصية في خطر | صفر تسرب مطلق |

تعتمد معماريتي على **طبقة استدلال شاملة**. منطق التطبيق لا يعرف أبدًا إن كان يتحدث إلى عنقود ضخم في مركز بيانات أم إلى مجموعة أنوية ARM في غرفة معيشتي.

## البناء

يتطلب التنفيذ واجهة موحدة. أستخدم وحدة `abc` في Python لفرض عقد صارم. سواء كان المزوّد Together AI (بمواصفات متوافقة مع OpenAI) أو Ollama، فإن الشيفرة المستدعية تتعامل مع الكائنات نفسها.

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

### التحقق من السلسلة

لا أثق بشيفرتي حتى أراها تفشل. تحاكي مجموعة اختبارات pytest هذه انقطاع الشبكة بإفساد مفتاح الـ API وتتحقق من منطق الاحتياط.

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

### ملاحظة WSL2

إذا كنت تشغّل هذا على Windows، فتأكد من ضبط `OLLAMA_HOST` على `http://172.x.x.x:11434` (عنوان IP لجهاز Windows لديك) إذا كان Ollama يعمل على المضيف، أو ببساطة `localhost` إذا كان داخل نسخة WSL2. أفضّل تشغيل Ollama على مضيف Windows للاستفادة من وحدة GPU مباشرة مع إبقاء بيئة التطوير في Ubuntu.

## المفاضلات

لنكن صريحين: منطق الاحتياط يضيف زمن استجابة. استدعاء سحابي فاشل مع 3 محاولات إعادة يستغرق نحو 7 ثوانٍ قبل أن يبدأ النموذج المحلي بالتفكير أصلًا. في المحادثة الفورية تُعد هذه واجهة "معطلة". لكن بالنسبة للوكلاء في الخلفية الذين يشغّلون محللات سجلات Gekro والبحث الآلي ومفهرسات الشيفرة، فإن 7 ثوانٍ من التأخير أفضل من انهيار كامل للنظام.

وهناك أيضًا **هاوية الجودة**. نموذج Llama 3-70B على Together AI ونموذج Llama 3-8B مكمَّم على Pi دماغان مختلفان جوهريًا. ترى الشيفرة المستدعية الواجهة نفسها، لكن ردود النموذج المحلي أقصر وأقل دقة وأكثر عرضة لإغفال الحالات الحدية. في الاستخلاص المنظم أو التلخيص تكون الفجوة مقبولة. أما في الاستدلال المعقد فالاحتياط المحلي ضمادة لا علاج. صمم وكلاءك بحيث يتحملون مخرجات متدهورة أثناء الاحتياط، لا سرعة متدهورة فقط.

أكبر تكلفة خفية هي **إدارة السياق**. إذا كنت أستخدم نموذجًا بسياق 128k في السحابة ثم أتحول إلى نموذج بسياق 8k محليًا، فسيهلوس النموذج المحلي أو ينهار إذا كان الموجّه طويلًا جدًا. تعلمت ذلك بالطريقة الصعبة حين حاول وكيل التلخيص الليلي لدي تغذية Llama 3-8B محلي بملف سجل من 50k رمز، فأنهى OOM killer العملية في منتصف الاستدلال. عليك أن تقتطع بشدة أثناء الاحتياط.

## إلى أين يتجه هذا

هذا العميل هو الخطوة الأولى نحو **معمارية الإجماع**. فبدلًا من الاعتماد على أن يكون نموذج واحد على صواب، أريد من عميلي أن يستطلع ثلاثة نماذج في وقت واحد (Together وGroq والمحلي) ويستخدم نموذج "حَكَم" لاختيار أفضل إجابة. وقت التشغيل هو الأرضية. والهدف جعل المختبر أذكى بمقارنة كيف ترى عقول مختلفة المشكلة نفسها.
