---
title: "العزل المالي لسرب ذكاء اصطناعي على Raspberry Pi"
description: "كيف حوّلت جهاز Pi 5 إلى منسّق محلي باستخدام موجّه MCP وشبكات عمّال OpenClaw المعزولة لخفض تكاليف الـ API."
publishedAt: "2026-03-27"
difficulty: "Advanced"
topics: ["Architecture", "Raspberry Pi", "OpenClaw", "Docker"]
readingTime: 6
aiSummary: "تفكيك مفصّل لتحويل Raspberry Pi 5 بذاكرة 16GB إلى شبكة Docker معزولة يحكمها برنامج تحكم رئيسي. يبرز استخدام موجّه manifest.ai لتوزيع المهام على عمّال DeepSeek V3 الأقل تكلفة عبر OpenRouter."
sourceHash: "52b8730bd6ee9d4f19a2fc7e28cef3803c9687ba6ab39691b6f7ef4b37f084a4"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
حوّلت إحدى عقد Raspberry Pi 5 الثلاث لدي (16GB + M.2 256GB) إلى غلاف تنسيق معزول ماليًا يشغّل مساعدين شخصيين بالذكاء الاصطناعي بكامل قدراتهم ويُستخدمون يوميًا. من خلال معمارية الدماغ المنفصل التي يشرف فيها برنامج تحكم رئيسي (MCP) على عمّال OpenClaw متعددي الأغراض، يستطيع النظام أن يتولى بشكل مستقل كل شيء من واجهات Telegram إلى تكاملات أدوات العمل. يفرض هذا النهج حوكمة صارمة للتكلفة على وكلاء عالي القدرة دون تقييد قدراتهم بشكل مصطنع، ويثبت أنك لا تحتاج إلى الاختيار بين مساعدة ذكاء اصطناعي متقدمة وفواتير API يمكن التنبؤ بها.
</TLDR>

عزلت إحدى عقد Raspberry Pi 5 الثلاث لدي (16GB + M.2 256GB) لتعمل منسّقًا للذكاء الاصطناعي معزولًا ماليًا يحكمه برنامج تحكم رئيسي (MCP). كان الهدف بناء نظام مساعدين بالذكاء الاصطناعي قادر ومتعدد الأغراض أستطيع استخدامه يوميًا دون أن أرى فاتورة الـ API من الفئة "Pro" تتبخر بالكامل بسبب الصيانة المستمرة للحالة.

العمّال في هذا النظام ليسوا خدمات خلفية ضيقة بغرض واحد. إنهم مساعدون شخصيون يعملون بكامل وظائفهم: يراقبون الأنظمة بفاعلية، وينفذون مهام خلفية مستقلة، ويتصلون بأدوات الإنتاجية الشخصية، ويجيبون عن الاستفسارات عبر Telegram. ومع ذلك، يتطلب تشغيل هؤلاء المساعدين عالي القدرة ضمانة. وكان الحل استراتيجية توجيه صارمة: استخدام MCP مركزي للإشراف على البيئة بينما يعمل المساعدون الفعليون كعمليات خلفية داخل Docker عبر مجمِّع بحدود إنفاق صارمة على مستوى الحساب. لم يعد Pi مختبرًا منزليًا عام الأغراض: فقد جرى تطهير كل حاوية أخرى لجعله غلاف OpenClaw مخصصًا ومتصلًا بالشبكة.

## البنية

يعمل النظام على معمارية متدرجة بدماغ منفصل. في الجذر يجلس MCP. وبدلًا من تثبيت نموذج واحد باهظ، يستخدم MCP مهارة `manifest.ai` كموجّه مدمج. فهو يقيّم ديناميكيًا تعقيد المهمة الإدارية ويقرر أي نموذج Gemini يستدعي، مع جعل الوضع التلقائي الأصلي في Gemini هو الافتراضي لتحقيق الكفاءة الأساسية.

تحته، معزولين تمامًا على شبكة جسر Docker مخصصة (`claw_net`)، يقف عاملان مخصصان لمهام بعينها. يقوم العاملان بالعمل الثقيل عبر اتصال OpenRouter مدفوع مسبقًا. ويراقب MCP سجلاتهما، ويعيد كتابة إعداداتهما إن فشلا، ويعيد تشغيل حاوياتهما.

| الطبقة | النسخة | المزوّد/النموذج | الدور والقدرات | هيكل التكلفة |
| --- | --- | --- | --- | --- |
| المشرف | MCP (الجذر) | Google AI (موجّه `manifest.ai` / Gemini Auto) | توجيه ديناميكي، يعدّل الإعدادات، يتحكم في خدمة Docker. | متغيرة / محسَّنة |
| عملية فرعية | Worker 01 | OpenRouter (DeepSeek V3) | تحليل سريع للبيانات، واجهة Telegram. | $0.14 / 1M رمز |
| عملية فرعية | Worker 02 | OpenRouter (DeepSeek V3) | إجراءات API معقدة، واجهة Telegram. | $0.14 / 1M رمز |

## البناء

تطلب الانتقال مسح Pi 5 للتخلص من تعارضات المنافذ وعبء المعالج. أصبح العتاد الآن مضيف OpenClaw حصريًا.

أولًا، كنت بحاجة إلى صفحة نظيفة. نفذت تطهيرًا كاملًا للبنية القائمة لأضمن ألا تلتهم أي حاويات شبحية الذاكرة أو تتعارض مع طبقات التوجيه لدي. ثم أنشأت الشبكة المعزولة (`claw_net`). يحتاج العمّال إلى اتصال صادر بالإنترنت لواجهة Telegram وOpenRouter، لكن عزلهم على شبكة جسر خاصة بهم يضمن أنه لا وصول وارد إليهم وأنهم لا يستطيعون رؤية حركة بعضهم.

```bash
# Purge all non-essential containers and images
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
docker system prune -a --volumes -f

# Create the dedicated network for the swarm
docker network create --driver bridge claw_net
```

أعدت هيكلة نظام الملفات في `/opt/openclaw` ليعكس التسلسل الهرمي، ومنحت MCP رؤية مطلقة لملفات إعدادات العمّال.

```bash
mkdir -p /opt/openclaw/{mcp,workers/worker-01,workers/worker-02}
```

بعد ذلك ضبطت العمّال المعزولين. قيّدت مصادقتهم بـ OpenRouter وفرضت حدًّا شهريًا صارمًا للإنفاق مباشرة على مستوى الحساب. وهذا يحتوي تجاوزات التكلفة من الخلفية: إذا حدثت حلقة، يكون أقصى ضرر محدودًا صراحة، فينقذني من فاتورة شهرية مفاجئة بقيمة 500 دولار. عمليًا، يكلفني تشغيل هؤلاء المساعدين بالذكاء الاصطناعي بكامل قدراتهم والمستخدَمين يوميًا ما بين 8 و15 دولارًا شهريًا بشكل واقعي. وبدلًا من فرض سقوف تعسفية للقدرات، ضبطت `maxOutputTokens` و`maxHistoryTurns` كمعاملات معايرة أداء مقصودة. تتوافق هذه القيم تحديدًا مع طبيعة دور كل عامل، فتحسّن نوافذ السياق للاستجابات السريعة مقابل الإجراءات المعقدة، وتضمن بقاءهم بكامل الوظائف دون إهدار عبء حسابي.

```bash
# Configure Worker 01
cd /opt/openclaw/workers/worker-01
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "$OPENROUTER_API_KEY" --non-interactive
openclaw config set agents.defaults.model.primary "openrouter/deepseek/deepseek-chat"
openclaw config set agents.defaults.maxOutputTokens 250
openclaw config set agents.defaults.maxHistoryTurns 5

# Configure Worker 02
cd /opt/openclaw/workers/worker-02
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "$OPENROUTER_API_KEY" --non-interactive
openclaw config set agents.defaults.model.primary "openrouter/deepseek/deepseek-chat"
openclaw config set agents.defaults.maxOutputTokens 600
openclaw config set agents.defaults.maxHistoryTurns 8
```

أطلقت العمّال متصلين بالشبكة المعزولة. بتثبيت أدلة إعداداتهم مباشرة داخل الحاويات، يستطيع MCP لاحقًا التدخل وقراءة هذه الإعدادات عبر مقبس Docker وإعادة كتابتها ديناميكيًا إذا بدأ أحد العمّال يسيء التصرف.

```bash
docker run -d --name worker-01 \
  --network claw_net \
  -v /opt/openclaw/workers/worker-01:/app/config \
  openclaw/core:latest

docker run -d --name worker-02 \
  --network claw_net \
  -v /opt/openclaw/workers/worker-02:/app/config \
  openclaw/core:latest
```

وأخيرًا، برنامج التحكم الرئيسي. يحتاج MCP إلى بيانات اعتماد Google AI، لكنني لمنع حرق الرموز دون داعٍ طبّقت مهارة التوجيه `manifest.ai`. ثبّتُّ مقبس Docker والدليل الجذر `/opt/openclaw/workers` داخل حاويته ليتمكن من الإشراف على العمليات الفرعية بشكل أصلي. MCP هو الحاوية الوحيدة التي تملك مفاتيح المملكة.

```bash
cd /opt/openclaw/mcp
openclaw onboard --auth-choice oauth --token-provider google --non-interactive

# Inject the manifest.ai router skill and set dynamic defaults
openclaw skill add manifest.ai/router
openclaw config set agents.defaults.model.primary "google/gemini-auto"
openclaw config set routing.strategy "manifest-dynamic"

docker run -d --name mcp \
  --network claw_net \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /opt/openclaw/workers:/supervised_workers \
  -v /opt/openclaw/mcp:/app/config \
  openclaw/core:latest
```

## المفاضلات

تثبيت `/var/run/docker.sock` داخل حاوية يقودها نموذج لغوي مخاطرة أمنية كارثية في بيئة الإنتاج. فإذا تعرض MCP لهجوم حقن موجّهات، فإنه يملك تحكمًا بمستوى الجذر في خدمة Docker على Pi. قبلت هذه المخاطرة لأن Pi 5 معزول ماديًا ومخصص لهذه التجربة وحدها، لكنه ليس نمطًا يصلح للنشر المؤسسي.

كذلك، فإن موجّه `manifest.ai` ذكي لكنه ليس معصومًا. حين ألقى Worker 02 تتبعًا ضخمًا للمكدس بسبب حمولة API مشوهة، حدده الموجّه بشكل صحيح بوصفه "مهمة تنقيح معقدة" ورفع التنفيذ إلى نموذج استدلال ثقيل بدلًا من استخدام نسخة Flash أخف. استوعب MCP نحو 40,000 رمز وهو يقرأ سجل الأخطاء قبل أن يقترح إصلاحًا. أعاد بنجاح كتابة مخطط مخرجات Worker 02 وأعاد تشغيل الحاوية، لكن إجراء التنقيح الوحيد ذاك تجاوز وفورات الوضع التلقائي وكلّف أكثر من أسبوع التشغيل الكامل لـ Worker 02 على DeepSeek.

## ما تعلمته

قبل أن أطبق منطق التوجيه، فشل Worker 01 فعلًا بصمت. لم يستطع تحليل حمولة JSON مشوهة من Telegram فعلق هناك، يلتهم موارد ذاكرة Pi بهدوء بينما تنتهي مهلة الـ API مرارًا. لم ألاحظ ذلك لمدة يومين. هذا الصمت، والفشل المتتالي الذي كان يهدد به، هو ما دفعني إلى بناء MCP أصلًا.

يعتمد النظام حاليًا على أن أطلب من MCP يدويًا فحص العمّال، وهذا حل منقوص. النتيجة المنطقية للمعمارية، ومشروعي التالي في المختبر، هي إنشاء مراقب نبض مستمر. بتمرير فحوص صحة العمّال إلى مخزن متجهات محلي خفيف على Pi، سيتمكن MCP من الاستعلام مستقلًا عن بيانات الأعطال التاريخية وضبط حرارة DeepSeek لدى العمّال أو سقوف الرموز استباقيًا *قبل* أن يتتالى الفشل.

أثبتت هذه التجربة أنك لا تحتاج إلى بنية تحتية سحابية ضخمة وأحادية لتشغيل أنظمة ذكاء اصطناعي معقدة. فبحصر المعمارية ضمن الحدود المادية لجهاز Raspberry Pi 5 واحد والحد المالي لسقف إنفاق شهري قدره 8–15 دولارًا، لم تكن النتيجة بيئة تجريبية مساومة أو مقيّدة. لقد شكلت تلك القيود نظام تنسيق أكثر انضباطًا وقدرة عالية. اليوم هذه ليست مجرد سكربتات ضيقة؛ إنها مساعدون شخصيون بالذكاء الاصطناعي فعّالون حقًا ويُستخدمون يوميًا يديرون سير عملي بنشاط. المختبر يعمل أخيرًا بذكاء، والمساعدون مطلقو العنان بالكامل، وصفحة الفواتير لدي مملة أخيرًا.
