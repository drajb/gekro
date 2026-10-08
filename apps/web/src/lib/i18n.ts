/**
 * i18n.ts - UI strings for translated blog pages
 *
 * Only the chrome of a blog post and a language archive is translated here.
 * Site-wide chrome (Header, Footer, search) stays English by design: the
 * multilingual scope is the blog (decision-log 2026-10-06).
 *
 * `en` holds the exact strings the English components have always rendered.
 * Components call `t(lang, key)` with `lang` defaulting to 'en', so English
 * output is byte-identical to before this module existed.
 *
 * Review status: every non-English entry below was written by Claude and has
 * not been read by a native speaker. They are short, plain UI labels. See
 * .gekro/docs/i18n-standard.md before changing any of them.
 */

export type UIKey =
  | 'translatedNotice'
  | 'readOriginal'
  | 'minRead'
  | 'inThisPost'
  | 'sharePost'
  | 'copyLink'
  | 'copied'
  | 'thanksTitle'
  | 'thanksBody'
  | 'backToBlog'
  | 'writtenBy'
  | 'authorBio'
  | 'tldr'
  | 'skipToContent'
  | 'readIn'
  | 'heroAlt'
  | 'archiveEyebrow'
  | 'archiveTitle'
  | 'archiveIntro'
  | 'read';

type Strings = Record<UIKey, string>;

const en: Strings = {
  translatedNotice: 'This is a machine translation of the English original. Some nuance may be lost, so the English version is the reference.',
  readOriginal: 'Read the original in English',
  minRead: '{n} min read',
  inThisPost: 'In this post',
  sharePost: 'Share Post',
  copyLink: 'Copy Link',
  copied: 'Copied!',
  thanksTitle: 'Thanks for reading.',
  thanksBody: 'If you enjoyed this, consider sharing it with your network.',
  backToBlog: 'Back to Blog',
  writtenBy: 'Written by',
  authorBio: 'AI engineer building local-first systems, self-hosted infrastructure, and autonomous tools from the lab.',
  tldr: 'TL;DR',
  skipToContent: 'Skip to content',
  readIn: 'Read in',
  heroAlt: 'Key metrics for {title}',
  archiveEyebrow: 'The Blog',
  archiveTitle: 'The AI Engineering Blog',
  archiveIntro: 'Deep dives, tutorials, and field notes from the lab - building agentic AI, local-first LLM infrastructure, and self-hosted systems in production.',
  read: 'Read',
};

const hi: Strings = {
  translatedNotice: 'यह अंग्रेज़ी मूल लेख का मशीनी अनुवाद है। कुछ बारीकियाँ छूट सकती हैं, इसलिए संदर्भ के लिए अंग्रेज़ी संस्करण ही मान्य है।',
  readOriginal: 'अंग्रेज़ी में मूल लेख पढ़ें',
  minRead: '{n} मिनट में पढ़ें',
  inThisPost: 'इस लेख में',
  sharePost: 'लेख साझा करें',
  copyLink: 'लिंक कॉपी करें',
  copied: 'कॉपी हो गया!',
  thanksTitle: 'पढ़ने के लिए धन्यवाद।',
  thanksBody: 'अगर यह आपको पसंद आया, तो इसे अपने नेटवर्क के साथ साझा करें।',
  backToBlog: 'ब्लॉग पर वापस जाएँ',
  writtenBy: 'लेखक',
  authorBio: 'AI इंजीनियर, जो लैब से लोकल-फ़र्स्ट सिस्टम, सेल्फ़-होस्टेड इंफ्रास्ट्रक्चर और स्वायत्त टूल बनाते हैं।',
  tldr: 'संक्षेप में',
  skipToContent: 'मुख्य सामग्री पर जाएँ',
  readIn: 'इस भाषा में पढ़ें',
  heroAlt: '{title} के प्रमुख आँकड़े',
  archiveEyebrow: 'ब्लॉग',
  archiveTitle: 'AI इंजीनियरिंग ब्लॉग',
  archiveIntro: 'लैब से गहन विश्लेषण, ट्यूटोरियल और फ़ील्ड नोट्स। एजेंटिक AI, लोकल-फ़र्स्ट LLM इंफ्रास्ट्रक्चर और सेल्फ़-होस्टेड सिस्टम को प्रोडक्शन में बनाने का काम।',
  read: 'पढ़ें',
};

const bn: Strings = {
  translatedNotice: 'এটি ইংরেজি মূল লেখাটির মেশিন অনুবাদ। কিছু সূক্ষ্মতা হারিয়ে যেতে পারে, তাই ইংরেজি সংস্করণই মূল রেফারেন্স।',
  readOriginal: 'মূল ইংরেজি লেখাটি পড়ুন',
  minRead: '{n} মিনিটে পড়া যায়',
  inThisPost: 'এই লেখায়',
  sharePost: 'লেখাটি শেয়ার করুন',
  copyLink: 'লিংক কপি করুন',
  copied: 'কপি হয়েছে!',
  thanksTitle: 'পড়ার জন্য ধন্যবাদ।',
  thanksBody: 'লেখাটি ভালো লাগলে আপনার নেটওয়ার্কের সঙ্গে শেয়ার করুন।',
  backToBlog: 'ব্লগে ফিরে যান',
  writtenBy: 'লেখক',
  authorBio: 'AI ইঞ্জিনিয়ার, যিনি ল্যাব থেকে লোকাল-ফার্স্ট সিস্টেম, সেলফ-হোস্টেড অবকাঠামো এবং স্বয়ংক্রিয় টুল তৈরি করেন।',
  tldr: 'সংক্ষেপে',
  skipToContent: 'মূল বিষয়বস্তুতে যান',
  readIn: 'এই ভাষায় পড়ুন',
  heroAlt: '{title}-এর মূল পরিসংখ্যান',
  archiveEyebrow: 'ব্লগ',
  archiveTitle: 'AI ইঞ্জিনিয়ারিং ব্লগ',
  archiveIntro: 'ল্যাব থেকে গভীর বিশ্লেষণ, টিউটোরিয়াল ও ফিল্ড নোট। প্রোডাকশনে এজেন্টিক AI, লোকাল-ফার্স্ট LLM অবকাঠামো ও সেলফ-হোস্টেড সিস্টেম তৈরির কাজ।',
  read: 'পড়ুন',
};

const mr: Strings = {
  translatedNotice: 'हा इंग्रजी मूळ लेखाचा यांत्रिक अनुवाद आहे. काही बारकावे हरवू शकतात, म्हणून संदर्भासाठी इंग्रजी आवृत्तीच ग्राह्य धरावी.',
  readOriginal: 'मूळ लेख इंग्रजीत वाचा',
  minRead: '{n} मिनिटांचे वाचन',
  inThisPost: 'या लेखात',
  sharePost: 'लेख शेअर करा',
  copyLink: 'लिंक कॉपी करा',
  copied: 'कॉपी झाले!',
  thanksTitle: 'वाचल्याबद्दल धन्यवाद.',
  thanksBody: 'हा लेख आवडला असेल तर तो तुमच्या नेटवर्कसोबत शेअर करा.',
  backToBlog: 'ब्लॉगवर परत जा',
  writtenBy: 'लेखक',
  authorBio: 'AI इंजिनिअर, जे लॅबमधून लोकल-फर्स्ट सिस्टीम, सेल्फ-होस्टेड इन्फ्रास्ट्रक्चर आणि स्वायत्त टूल्स तयार करतात.',
  tldr: 'थोडक्यात',
  skipToContent: 'मुख्य मजकुराकडे जा',
  readIn: 'या भाषेत वाचा',
  heroAlt: '{title} चे प्रमुख आकडे',
  archiveEyebrow: 'ब्लॉग',
  archiveTitle: 'AI इंजिनिअरिंग ब्लॉग',
  archiveIntro: 'लॅबमधून सखोल विश्लेषण, ट्यूटोरियल आणि फील्ड नोट्स. एजंटिक AI, लोकल-फर्स्ट LLM पायाभूत सुविधा आणि सेल्फ-होस्टेड सिस्टीम प्रोडक्शनमध्ये उभारण्याचे काम.',
  read: 'वाचा',
};

const te: Strings = {
  translatedNotice: 'ఇది ఆంగ్ల మూల వ్యాసానికి యంత్ర అనువాదం. కొన్ని సూక్ష్మ భేదాలు కోల్పోవచ్చు, కాబట్టి ఆంగ్ల వెర్షన్‌నే ప్రమాణంగా తీసుకోండి.',
  readOriginal: 'మూల వ్యాసాన్ని ఆంగ్లంలో చదవండి',
  minRead: '{n} నిమిషాల పఠనం',
  inThisPost: 'ఈ వ్యాసంలో',
  sharePost: 'వ్యాసాన్ని షేర్ చేయండి',
  copyLink: 'లింక్ కాపీ చేయండి',
  copied: 'కాపీ అయింది!',
  thanksTitle: 'చదివినందుకు ధన్యవాదాలు.',
  thanksBody: 'ఇది నచ్చితే, మీ నెట్‌వర్క్‌తో షేర్ చేయండి.',
  backToBlog: 'బ్లాగ్‌కు తిరిగి వెళ్లండి',
  writtenBy: 'రచయిత',
  authorBio: 'AI ఇంజినీర్. ల్యాబ్ నుంచి లోకల్-ఫస్ట్ సిస్టమ్‌లు, సెల్ఫ్-హోస్టెడ్ ఇన్‌ఫ్రాస్ట్రక్చర్, స్వయంచాలక టూల్స్ నిర్మిస్తారు.',
  tldr: 'సంక్షిప్తంగా',
  skipToContent: 'ప్రధాన కంటెంట్‌కు వెళ్లండి',
  readIn: 'ఈ భాషలో చదవండి',
  heroAlt: '{title} ముఖ్య గణాంకాలు',
  archiveEyebrow: 'బ్లాగ్',
  archiveTitle: 'AI ఇంజినీరింగ్ బ్లాగ్',
  archiveIntro: 'ల్యాబ్ నుంచి లోతైన విశ్లేషణలు, ట్యుటోరియల్స్, ఫీల్డ్ నోట్స్. ఏజెంటిక్ AI, లోకల్-ఫస్ట్ LLM ఇన్‌ఫ్రాస్ట్రక్చర్, సెల్ఫ్-హోస్టెడ్ సిస్టమ్‌లను ప్రొడక్షన్‌లో నిర్మించే పని.',
  read: 'చదవండి',
};

const ta: Strings = {
  translatedNotice: 'இது ஆங்கில மூலக் கட்டுரையின் இயந்திர மொழிபெயர்ப்பு. சில நுணுக்கங்கள் விடுபடலாம், எனவே ஆங்கிலப் பதிப்பே அடிப்படை ஆதாரம்.',
  readOriginal: 'மூலக் கட்டுரையை ஆங்கிலத்தில் படியுங்கள்',
  minRead: '{n} நிமிட வாசிப்பு',
  inThisPost: 'இந்தக் கட்டுரையில்',
  sharePost: 'கட்டுரையைப் பகிருங்கள்',
  copyLink: 'இணைப்பை நகலெடுக்கவும்',
  copied: 'நகலெடுக்கப்பட்டது!',
  thanksTitle: 'படித்ததற்கு நன்றி.',
  thanksBody: 'இது பிடித்திருந்தால், உங்கள் நெட்வொர்க்குடன் பகிருங்கள்.',
  backToBlog: 'வலைப்பதிவுக்குத் திரும்பு',
  writtenBy: 'எழுதியவர்',
  authorBio: 'AI பொறியாளர். ஆய்வகத்திலிருந்து லோக்கல்-ஃபர்ஸ்ட் அமைப்புகள், சுயமாக ஹோஸ்ட் செய்யப்படும் உள்கட்டமைப்பு, தன்னாட்சிக் கருவிகளை உருவாக்குகிறார்.',
  tldr: 'சுருக்கமாக',
  skipToContent: 'முதன்மை உள்ளடக்கத்திற்குச் செல்',
  readIn: 'இந்த மொழியில் படிக்க',
  heroAlt: '{title} பற்றிய முக்கிய அளவீடுகள்',
  archiveEyebrow: 'வலைப்பதிவு',
  archiveTitle: 'AI பொறியியல் வலைப்பதிவு',
  archiveIntro: 'ஆய்வகத்திலிருந்து ஆழமான பகுப்பாய்வுகள், பயிற்சிகள், களக் குறிப்புகள். ஏஜென்டிக் AI, லோக்கல்-ஃபர்ஸ்ட் LLM உள்கட்டமைப்பு, சுயமாக ஹோஸ்ட் செய்யப்படும் அமைப்புகளை உற்பத்தியில் உருவாக்கும் பணி.',
  read: 'படிக்க',
};

const zh: Strings = {
  translatedNotice: '本文是英文原文的机器翻译，部分细节可能有所损失，请以英文版本为准。',
  readOriginal: '阅读英文原文',
  minRead: '阅读约 {n} 分钟',
  inThisPost: '本文目录',
  sharePost: '分享文章',
  copyLink: '复制链接',
  copied: '已复制！',
  thanksTitle: '感谢阅读。',
  thanksBody: '如果这篇文章对你有帮助，欢迎分享给你的圈子。',
  backToBlog: '返回博客',
  writtenBy: '作者',
  authorBio: 'AI 工程师，在实验室里构建本地优先系统、自托管基础设施和自主工具。',
  tldr: '要点速览',
  skipToContent: '跳到正文',
  readIn: '阅读语言',
  heroAlt: '{title} 的关键数据',
  archiveEyebrow: '博客',
  archiveTitle: 'AI 工程博客',
  archiveIntro: '来自实验室的深度文章、教程和实战笔记，内容涵盖智能体 AI、本地优先的 LLM 基础设施，以及自托管系统的生产实践。',
  read: '阅读',
};

const es: Strings = {
  translatedNotice: 'Esta es una traducción automática del original en inglés. Puede perderse algún matiz, así que la versión en inglés es la referencia.',
  readOriginal: 'Leer el original en inglés',
  minRead: '{n} min de lectura',
  inThisPost: 'En este artículo',
  sharePost: 'Compartir artículo',
  copyLink: 'Copiar enlace',
  copied: '¡Copiado!',
  thanksTitle: 'Gracias por leer.',
  thanksBody: 'Si te ha gustado, compártelo con tu red.',
  backToBlog: 'Volver al blog',
  writtenBy: 'Escrito por',
  authorBio: 'Ingeniería de IA: sistemas local-first, infraestructura autoalojada y herramientas autónomas desde el laboratorio.',
  tldr: 'En resumen',
  skipToContent: 'Saltar al contenido',
  readIn: 'Leer en',
  heroAlt: 'Métricas clave de {title}',
  archiveEyebrow: 'El blog',
  archiveTitle: 'El blog de ingeniería de IA',
  archiveIntro: 'Análisis en profundidad, tutoriales y notas de campo desde el laboratorio. IA agéntica, infraestructura de LLM local-first y sistemas autoalojados en producción.',
  read: 'Leer',
};

const ar: Strings = {
  translatedNotice: 'هذه ترجمة آلية للنص الإنجليزي الأصلي. قد تضيع بعض الفروق الدقيقة، لذا تبقى النسخة الإنجليزية هي المرجع.',
  readOriginal: 'اقرأ النص الأصلي بالإنجليزية',
  minRead: 'مدة القراءة: {n} د',
  inThisPost: 'في هذا المقال',
  sharePost: 'شارك المقال',
  copyLink: 'انسخ الرابط',
  copied: 'تم النسخ!',
  thanksTitle: 'شكرًا على القراءة.',
  thanksBody: 'إن أعجبك المقال، فشاركه مع شبكتك.',
  backToBlog: 'العودة إلى المدونة',
  writtenBy: 'بقلم',
  authorBio: 'مهندس ذكاء اصطناعي يبني أنظمة محلية أولًا وبنية تحتية مستضافة ذاتيًا وأدوات مستقلة من المختبر.',
  tldr: 'باختصار',
  skipToContent: 'انتقل إلى المحتوى',
  readIn: 'اقرأ بلغة',
  heroAlt: 'أهم المؤشرات في {title}',
  archiveEyebrow: 'المدونة',
  archiveTitle: 'مدونة هندسة الذكاء الاصطناعي',
  archiveIntro: 'تحليلات معمّقة ودروس وملاحظات ميدانية من المختبر، عن وكلاء الذكاء الاصطناعي والبنية التحتية المحلية لنماذج اللغة والأنظمة المستضافة ذاتيًا في الإنتاج.',
  read: 'اقرأ',
};

export const STRINGS: Record<string, Strings> = { en, hi, bn, mr, te, ta, zh, es, ar };

/** Look up a UI string; unknown languages fall back to English. */
export function t(lang: string | undefined, key: UIKey, vars?: Record<string, string | number>): string {
  const table = STRINGS[lang ?? 'en'] ?? en;
  let out = table[key] ?? en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

/** Arrow glyphs that point the right way for the language's text direction. */
export function arrows(dir: 'ltr' | 'rtl'): { back: string; forward: string } {
  return dir === 'rtl' ? { back: '→', forward: '←' } : { back: '←', forward: '→' };
}
