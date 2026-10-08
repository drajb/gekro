---
title: "Presentamos Gekro News: un boletín de IA que se arma a mi medida"
description: "Un boletín diario público de IA que lee un perfil de mis intereses destilado de mi propia base de conocimiento, elige la señal real del día, cita sus fuentes y se publica solo cada mañana."
publishedAt: "2026-06-22"
difficulty: "Intermediate"
topics: ["Automation", "LLMs", "AI Engineering"]
readingTime: 6
aiSummary: "Gekro News es un boletín diario público de IA en gekro.com/news que selecciona sus propias noticias en torno a un perfil de intereses destilado automáticamente de la base de conocimiento del autor. Rastrea fuentes verificadas, selecciona las noticias más relevantes del día con un resumen neutral y con citas, valida su propia salida y publica automáticamente cada mañana una entrada y un feed RSS, que luego se lee en voz alta en el coche cuando se pide."
sourceHash: "49ef62b347d67c884f49b6f131646c5d83d372abb2dfab7449cf06d93bdcc174"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  Gekro News es un boletín público de IA que selecciona sus propias noticias en torno a un perfil de lo que realmente me importa, destilado automáticamente de mi propia base de conocimiento. Saca la señal real del día entre el ruido, cita sus fuentes y se publica solo cada mañana, sin intervención humana. Hago que mi coche me lo lea en el trayecto de ida.
</TLDR>

<!-- The Hook (No Heading) -->

Cada mañana, antes de que yo me despierte, un pequeño programa lee las noticias de IA del día, descarta las nueve décimas partes que no tienen nada que ver con mi trabajo y me deja el resto. Aprende qué cuenta como mi trabajo leyendo mis propias notas, y sigue aprendiendo a medida que esas notas cambian. No lo compré ni lo instalé. Nada en el mercado selecciona las noticias en torno a un solo lector, así que construí algo que lo hiciera.

## La arquitectura

La razón por la que esto no es otro lector de feeds es que el filtro no es estático. La mayoría de las herramientas de curación te hacen configurar los temas una vez y se quedan anticuadas en cuanto tu trabajo avanza. Gekro News lo invierte: el boletín lee un pequeño perfil de mis intereses actuales, y ese perfil se regenera periódicamente a partir de mi propia base de conocimiento. Lo que construyo este mes es de lo que tratan las noticias este mes. Nunca edito un ajuste.

| | Qué hace | Dónde vive |
|---|---|---|
| El gusto | Destila mi base de conocimiento en un perfil público de intereses, cada semana | Un flujo de [n8n](/stack/n8n/) (en la nube) |
| La agencia de noticias | Rastrea fuentes verificadas, selecciona con ese perfil, valida y publica | Una tarea diaria (en la nube, sin supervisión) |
| La entrega | Me lee el boletín, con las manos libres, cuando lo pido | RSS más una consulta de voz bajo demanda en el coche |

Las tres partes están desacopladas a propósito, de modo que un fallo en una nunca tumba a las demás.

```
WEEKLY                          DAILY (07:00 UTC, unattended)
──────                          ─────────────────────────────
n8n reads my knowledge base     scan vetted feeds (last 36h)
   ↓ distills to PUBLIC            ↓ read the interest profile
   ↓ AI topics, sanity-checked     ↓ curate the day's 2-4 stories
   ↓ writes interest profile  ───► ↓ validate (cite, neutral, sourced)
                                   ↓ auto-publish
                                        ↓
                              gekro.com/news + RSS ──► "read me my news" → car
```

## La construcción

**Descubrimiento.** Una tarea diaria rastrea un conjunto reducido de fuentes verificadas y de alta señal en busca de todo lo publicado en las últimas 36 horas. Esas fuentes son la red, no la captura. Lo que más me importa son las citas: cada noticia enlaza al artículo exacto que la tarea recuperó, y el publicador rechaza cualquier fuente que no pueda rastrear hasta algo que realmente descargó. El boletín no puede enlazar a una página que nunca leyó, y esa es la diferencia entre una agencia de noticias en la que confiaré a 70 millas por hora y otra que tendría que contrastar en cada semáforo.

**Curación.** Los candidatos pasan a una única llamada a un modelo con un solo conjunto de instrucciones. Sin ajuste fino y sin almacén vectorial. La inteligencia es un único prompt que codifica un punto de vista, más el perfil de intereses superpuesto.

```
You are writing the daily AI briefing for gekro.com - a NEUTRAL, sourced
digest, not an opinion column.

PREFER: model releases (open-weight especially), research with engineering
implications, infra and tooling, real benchmarks, API and pricing changes
that affect developers.
AVOID: funding rounds, business news, opinion, press releases, AI drama,
AGI speculation without evidence.

Neutral, third person, no hype words. EVERY claim carries an inline citation.
Do not state anything you cannot attribute.
```

Esa columna vertebral estática es la misma todos los días. Lo que cambia es un pequeño bloque `READER FOCUS`, inyectado desde el perfil de intereses, que le dice al editor cuáles de esos temas preferidos debe ponderar más hoy. Si quieres ver cuánto carga un solo prompt como este, pásalo por el [System Prompt Linter](/apps/system-prompt-linter/): reglas de selección, reglas de voz y un contrato de salida, todo en un solo conjunto de instrucciones.

También tiene memoria. Antes de escribir, el editor ve los titulares que ya publicó en los últimos días, de modo que una noticia de varios días no se vuelve a contar cada mañana. Pasa a otra cosa salvo que haya ocurrido algo realmente nuevo, y esa es la diferencia entre un feed y un bucle.

**El gusto que se actualiza solo.** Esta es la parte que más me importa. Un flujo de [n8n](/stack/n8n/) se ejecuta de forma programada, lee mi base de conocimiento y la destila en los temas públicos de IA y software con los que realmente he estado construyendo y sobre los que he escrito. Escribe el resultado en un pequeño perfil que la tarea diaria lee en su siguiente ejecución. Dos reglas lo hacen seguro para ejecutarse sin supervisión contra un sitio público. Primero, el perfil vive en un repositorio público, así que es legible por todo el mundo por construcción, lo que significa que solo pueden vivir allí temas publicables. Segundo, la escritura está protegida por una comprobación de que el perfil no contiene nada personal, nada sobre para quién trabajo, nada identificativo, y falla en modo seguro: si no puede certificar que el perfil está limpio, no escribe nada y se queda el último perfil limpio. Anticuado pero limpio gana a reciente pero sin verificar, siempre.

**Publicación y entrega.** Un boletín mal formado nunca se publica: el generador valida su propia salida (tono neutral, fuentes alineadas, límites de longitud) y aborta ante cualquier cosa rota antes de que una compilación la vea. Uno limpio hace su propio commit y se despliega, y aparece en [gekro.com/news](/news/) y en un feed RSS. Todo se ejecuta en rutinas programadas en la nube, así que mantenerlo vivo no me cuesta nada y nunca necesita mi máquina encendida. Para la entrega, configuré una instrucción personalizada en el asistente de mi coche: pido mis noticias, recupera el último boletín y me lo lee durante el trayecto de ida. Sin aplicación, sin pantalla.

## Las contrapartidas

Un filtro que se ajusta solo es un único punto de gusto. El boletín solo es tan relevante como el perfil que lo respalda, y ese perfil soy yo. Ese es todo el valor cuando quiero una agencia de noticias que siga mi trabajo, y un lastre en cuanto lo confundo con algo objetivo. Me refleja a propósito, y procuro no olvidarlo.

La línea más difícil es la que separa lo público de lo privado. Este es un sitio público, así que la personalización tiene que hacer las noticias más relevantes para mí sin convertir nunca la página en un diario. La disciplina cabe en una frase: personaliza lo que se selecciona, nunca a quién se dirige. El boletín se mantiene neutral y en tercera persona. En ningún lugar hay un "para ti, Rohit", porque al otro lado hay un lector real que merece un boletín, no un vistazo a mi cuaderno. La mitad personal vive solo en el coche, donde el público es uno.

## Lo que aprendí

La versión que estuve a punto de construir era mucho más grande: una base de datos, un motor de deduplicación, embeddings para agrupar noticias, un panel para ajustar pesos. Me alegro de no haberla hecho. Todo es una tarea programada, un prompt, un pequeño perfil que se reescribe solo y un feed que yo ya estaba generando. La inteligencia no está en la infraestructura; está en un párrafo de criterio editorial y en una lista corta y autoactualizable de lo que me importa. La curación resultó no ser un problema de modelo ni de datos. Es un problema de gusto, y el gusto se comprime en un prompt y un perfil mejor que casi cualquier otra cosa que haya intentado codificar. Lo construí para una audiencia de uno y luego dejé las puertas abiertas en [gekro.com/news](/news/), porque el ruido no es solo mi problema.
