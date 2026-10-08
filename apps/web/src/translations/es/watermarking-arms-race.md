---
title: "La carrera armamentista de las marcas de agua en la IA"
description: "Anthropic ha empezado a poner marcas de agua en el texto de Claude. Cómo funcionan en realidad las marcas de agua en texto generativo, por qué ningún tercero puede verificarlas todavía, por qué la capacidad de detección cae a la raíz cuadrada de la fracción escrita por máquina cuando un documento tiene dos autores, y por qué publiqué una herramienta que dice 'no comprobable' en lugar de inventarse una puntuación."
publishedAt: "2026-08-24"
difficulty: "Intermediate"
topics: ["AI Engineering", "Security", "Provenance"]
readingTime: 12
aiSummary: "Anthropic ha empezado a marcar de forma legible por máquina la salida de Claude, con modelos lanzados a partir del 2 de agosto de 2026 que lo admiten desde el lanzamiento en todo el mundo, en el marco del Código de buenas prácticas sobre transparencia de los contenidos generados por IA del artículo 50(2) de la Ley de IA de la UE. Usa una marca de agua estadística en el texto más metadatos firmados C2PA en archivos .svg, .png y .jpg. Este artículo explica cómo funciona la marca de agua en texto generativo (sesgo de lista verde y muestreo por torneo de SynthID-Text), deduce por qué puntuar el documento entero conserva solo sqrt(f) de la potencia de detección cuando una fracción f del texto es escrita por máquina, explica por qué el cambio de modelo y los modelos de pesos abiertos sin marca acotan todo el régimen, y defiende herramientas que declaren como no verificables las señales que no se pueden verificar."
sourceHash: "5763824b2f474dfde1baf431f7972f61665aab4256cb312d3e604785b626161d"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  Anthropic ha empezado a marcar la salida de Claude. El texto recibe una marca de agua estadística, los archivos reciben metadatos firmados C2PA, y se despliega modelo por modelo para todo lo lanzado a partir del 2 de agosto de 2026, en todo el mundo, bajo el código de transparencia de la Ley de IA de la UE. Me propuse construir un detector y no pude. El método no está publicado, la señal está en las palabras que elige el modelo y no en ningún carácter que se pueda buscar, y cuando un documento tiene dos autores la estadística se desmorona de una forma que se puede deducir en tres líneas. Así que construí la herramienta que informa de lo que sí se puede comprobar y lo dice cuando no hay nada.
</TLDR>

Leí el anuncio de Anthropic y abrí un editor de texto para buscar caracteres de ancho cero. No hay ninguno. La marca de agua no se esconde entre las letras, está en qué palabras eligió el modelo, y me costó aceptarlo más de lo que debería. También significa que un "eliminador de marcas de agua" no tiene nada que eliminar.

## Tres cosas que la gente llama marca de agua

Tres mecanismos distintos reciben el nombre de marca de agua. Casi no tienen nada en común.

| Mecanismo | Dónde vive la señal | Se elimina con | Detectable por terceros |
|---|---|---|---|
| Unicode oculto | Caracteres de ancho cero, bloque Tag (U+E0000-E007F) | Cualquier buscar y reemplazar | Sí, trivialmente |
| Metadatos C2PA | Manifiesto firmado en el contenedor del archivo | Captura de pantalla, volver a guardar, conversión de formato | Sí, la presencia se puede comprobar |
| Marca de agua estadística | Las elecciones de tokens del modelo | Paráfrasis intensa o traducción | No, necesita la clave del proveedor |

Anthropic incorpora dos de ellas. Los archivos reciben metadatos de procedencia firmados C2PA, el mismo estándar de Content Credentials que usa la industria de la imagen, en `.svg`, `.png` y `.jpg`. El texto recibe la tercera fila. La documentación de Anthropic la describe como "una marca de agua imperceptible directamente en el propio texto", una que "no cambia el significado, la calidad ni la legibilidad de la respuesta de Claude".

El despliegue es más estrecho de lo que sugerían los titulares. Según Anthropic, "los modelos de Claude lanzados a partir del 2 de agosto de 2026 admitirán el marcado legible por máquina desde su lanzamiento", y el soporte para los modelos existentes se describe como en curso. El corte es por modelo, no por país. La misma página dice que el marcado se aplica a la salida de los modelos compatibles dondequiera que se ofrezca Claude, en todo el mundo. El motor es el Código de buenas prácticas sobre transparencia de los contenidos generados por IA del artículo 50(2) de la Ley de IA de la UE, que Anthropic firmó como proveedor de modelos y como proveedor de sistemas de IA generativa. Así que llega modelo por modelo, y cuando un modelo lo tiene, lo tienen todos.

Google lleva tiempo ejecutando SynthID-Text en Gemini, y el método está publicado en Nature. Solo cambia el paso de muestreo. En cada token inicializa una función pseudoaleatoria con los k tokens anteriores, reparte el vocabulario en un cuadro de torneo con m capas, y aumenta la probabilidad de muestreo de los tokens que siguen ganando sus enfrentamientos. Extiéndelo sobre suficientes capas y suficientes tokens y obtienes un sesgo estadístico medible, sin que ninguna palabra individual le parezca rara a un lector.

La detección no necesita el modelo original. Necesita la función pseudoaleatoria con clave y una pasada de puntuación sobre el texto candidato. El texto con marca de agua tiene valores g sistemáticamente más altos que el texto sin ella, y esa diferencia es un contraste de hipótesis.

Ahí es donde me atasqué.

```
Signal              Verifiable in a browser?     Why
------              ------------------------     ---
Zero-width chars    Yes                          Codepoint scan
Unicode Tag block   Yes                          Codepoint scan, decodes to ASCII
C2PA manifest       Presence, not signature      JUMBF box / PNG caBX chunk markers
Claude watermark    NO                           Keyed detector, method unpublished
SynthID-Text        NO                           Keyed detector, Google-side API
```

La página de ayuda de Anthropic es directa al respecto. Dicen que están "trabajando para permitir que los usuarios y otros terceros detecten las marcas de agua y los metadatos de procedencia incrustados de Claude" y que "compartirán detalles sobre los mecanismos de detección en la documentación técnica que se publicará". Lo que se publicará significa que todavía no existe. Hasta que exista, nadie fuera de Anthropic puede comprobar la marca de agua del texto. Cualquier herramienta que diga hacerlo ejecuta un clasificador genérico de texto de IA con otro nombre, y esos tienen un perfil de errores mucho peor, sobre todo con quien escribe en una segunda lengua.

## Construir el inspector

Así que construí la versión que solo afirma lo que puede comprobar.

La parte de C2PA fue la que más código llevó. Un manifiesto de Content Credentials vive en una caja JUMBF, y dónde cae esa caja depende del contenedor. PNG la pone en un fragmento `caBX`, JPEG la lleva en un segmento APP11, SVG la guarda en metadatos XML. Encontrarla significa recorrer los bytes en bruto buscando esos marcadores:

```ts
const scanC2PA = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);

  const find = (needle: string): boolean => {
    const n = needle.length;
    const limit = bytes.length - n;
    for (let i = 0; i <= limit; i++) {
      let ok = true;
      for (let j = 0; j < n; j++) {
        if (bytes[i + j] !== needle.charCodeAt(j)) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  };

  const isPng = bytes[0] === 0x89 &&
    String.fromCharCode(bytes[1], bytes[2], bytes[3]) === 'PNG';

  const hasJumbf  = find('jumb') || find('jumd');
  const hasC2pa   = find('c2pa');
  const hasPngBox = isPng && find('caBX');

  return { found: hasC2pa || hasPngBox, hasJumbf, isPng };
};
```

Eso encuentra un manifiesto. No lo verifica. Validar significa comprobar una cadena de certificados y una firma criptográfica, y no voy a programar eso a mano en una pestaña del navegador y presentarlo como autorizado. La herramienta lo dice y remite al verificador oficial.

El escaneo tiene un modo de fallo que debo nombrar en vez de enterrar. Buscar un marcador de cuatro caracteres en bytes en bruto puede dar un falso positivo, ya que nada impide que los bytes `c2pa` aparezcan dentro de datos de imagen comprimidos. Lo dejé así de todos modos. Analizar bien la estructura de los contenedores en tres formatos es mucho trabajo para una herramienta cuya única afirmación es "aquí hay algo, ve a verificarlo en otro sitio". Es un detector de humo, y la etiqueta lo dice. Si algún día deja de ser suficiente, la solución es analizar las cajas de verdad.

La parte de texto reutiliza el escáner de puntos de código de mi inspector de texto oculto: caracteres de ancho cero, el bloque Tag de Unicode que puede colar mensajes ASCII enteros de forma invisible, controles bidi, selectores de variación. Todo eso es detectable y vale la pena señalarlo.

Lo más difícil no fue el código. Fue la redacción de un único veredicto. La herramienta tiene una señal llamada "Marca de agua estadística (Claude, SynthID-Text)" cuyo estado permanente es `not checkable`, con una explicación adjunta. Le di vueltas un buen rato antes de publicarlo, porque una herramienta que responde "no lo sé" parece rota.

Importa por cómo se usan estos resultados. Alguien pasa un párrafo por un comprobador y lleva el resultado a una reunión disciplinaria. Por eso la herramienta empieza con cuatro advertencias. Las dos primeras son la postura propia de Anthropic, las otras dos son mías sobre los límites de lo que construí:

- La ausencia de marca no es prueba de autoría humana. Anthropic enumera la edición intensa, la paráfrasis, la traducción y la mezcla con otros textos como condiciones que dejan las marcas indetectables.
- La presencia tampoco es prueba de autoría. Indica que el contenido puede haber sido procesado por ese modelo, no quién lo escribió ni cuánto lo cambió una persona.
- La presencia de C2PA no es verificación de C2PA. Esta herramienta encuentra un manifiesto, no valida la firma ni al emisor.
- Los metadatos son frágiles. Las capturas de pantalla, los guardados nuevos y la mayoría de las subidas a plataformas los eliminan, así que un resultado limpio en un archivo descargado dice muy poco sobre el original.

## Qué pasa cuando un documento tiene dos autores

Todo lo anterior supone un autor por documento. Casi nada tiene uno. La gente redacta en un chatbot, reescribe una sección en otro, pasa por OpenRouter al modelo más barato de esa semana y edita a mano entre medias. No es una técnica de evasión exótica, es como se trabaja ahora.

Anthropic ya lo señala. Su lista de condiciones en las que una marca deja de ser detectable incluye texto "muy editado, parafraseado, traducido o mezclado con otros escritos". Lo plantea como advertencia y lo deja ahí. Aquí va el mecanismo, porque el tamaño del efecto me sorprendió.

La detección por lista verde es una prueba z sobre recuentos de tokens. Esta es la construcción publicada de lista verde con parámetros ilustrativos. No es el esquema de Anthropic, que no está publicado. La forma del resultado se traslada, los números concretos no.

```
z = (greens - γT) / sqrt(T · γ(1-γ))
```

Supongamos que un documento tiene `T` tokens, de los cuales solo `W` están escritos por máquina, y cada uno sube la tasa de verdes en `ε`. Los tokens humanos aportan verdes a la tasa de base `γ`, así que el recuento esperado de verdes es `Tγ + Wε` y el estadístico del documento completo queda:

```
z_whole = W·ε / sqrt(T · γ(1-γ))
```

Ahora puntúa solo el tramo escrito por máquina:

```
z_span  = ε·sqrt(W) / sqrt(γ(1-γ))
```

Divide uno entre otro y todo se cancela en un único número:

```
z_whole / z_span = sqrt(W/T) = sqrt(f)
```

Puntuar el documento entero conserva solo la raíz cuadrada de la fracción escrita por máquina de su potencia de detección. Con `f = 0.1` eso es el 32%. Tomando `γ = 0.5` y una subida de la tasa de verdes de `ε = 0.25` como valores ilustrativos, un pasaje de 300 tokens escrito por máquina puntúa `z = 8.66` por sí solo y se marcaría con una confianza enorme. Meta ese mismo pasaje en un documento de 3,000 tokens y la puntuación del documento completo cae a `z = 2.74`, por debajo de cualquier umbral razonable. La marca de agua no cambió. El detector midió la unidad equivocada.

Así que mezclar modelos no ataca la marca de agua. Ataca la elección de ventana del detector.

La solución es deslizar una ventana por el texto y tomar la puntuación máxima, más o menos la idea WinMax del artículo de SynthID-Text. Funciona, y cuesta algo. Puntuar cientos de ventanas solapadas supone ejecutar cientos de contrastes de hipótesis sobre un mismo documento, así que hace falta corrección por comparaciones múltiples, lo que sube el umbral, lo que devuelve los tramos cortos por debajo. Se cambia un problema de dilución por un problema de falsos positivos, y ningún ajuste de ese mando evita ambos.

Además, el enventanado solo localiza la marca de un proveedor, porque cada proveedor usa su propia función pseudoaleatoria con clave:

```
for each vendor key K:          # Anthropic, Google, OpenAI, ...
    for each window w in text:  # all of these need FPR correction together
        score(w, K)
```

Tres proveedores significan tres detectores, tres viajes de ida y vuelta a una API, tres relaciones de confianza. Nadie ofrece una versión federada, y la de Anthropic todavía no es pública.

Luego está el agujero que vuelve académico la mayor parte de lo anterior. La marca de agua exige que quien ejecuta la inferencia sesgue el paso de muestreo. Eso es una propiedad de la pila de servicio, no del texto. Así que:

| Ruta | ¿Con marca de agua? | Por qué |
|---|---|---|
| OpenRouter → Claude / Gemini / GPT | Sí | Se aplica dentro de la pila del proveedor antes de devolver los tokens. El enrutador solo reenvía el texto ya terminado. |
| OpenRouter → Llama / Qwen / Mistral | No | Los proveedores de inferencia de pesos abiertos no tienen obligación ni incentivo para implementar un muestreo sesgado. |
| llama.cpp en tu propio portátil | No | Mismo motivo, más aún. |

OpenRouter no derrota la marca de agua enrutando. Ofrece un carril donde la marca nunca se aplicó, y ese carril está a una cadena de configuración de distancia. Así que el régimen abarca las API propietarias de frontera y nada más. Los pesos abiertos ya son lo bastante buenos para la mayoría del trabajo con texto y quedan fuera. Quien quiera esquivarlo cambia un nombre de modelo.

Incorporé el efecto de dilución al inspector como una tercera pestaña. No analiza ningún texto y no detecta nada. Ejecuta la aritmética de la prueba z y dibuja cómo se separan las dos puntuaciones a medida que cambias la fracción escrita por máquina.

## En qué me equivoqué

Había supuesto que la durabilidad de la marca de agua consistía en sobrevivir a las ediciones. Consiste en sobrevivir a la paráfrasis, que es mucho más difícil, porque parafrasear vuelve a muestrear las elecciones de tokens y ahí vive la señal. Mi primer plan era un comprobador con un porcentaje de confianza, porque eso es lo que la gente espera y lo que posiciona. Lo descarté. Cualquier número que produjera habría sido un clasificador genérico de texto de IA con otra etiqueta, y esos tienen problemas de falsos positivos documentados, sobre todo con quien escribe en inglés como segunda lengua.

La decisión más difícil fue el eliminador de marcas de agua, el producto contiguo que de verdad atraería tráfico. Lo descarté. Sería una herramienta para eludir un compromiso de divulgación, y además no funciona. No hay ningún carácter que quitar, así que eliminarla significa una paráfrasis tan agresiva que degrada la escritura, y una herramienta de navegador no puede parafrasear sin incluir un modelo. Lo que me quedó después es que el corrector de puntuación que publiqué junto a esto sí elimina caracteres de ancho cero, que es una limpieza que quería para mis propios borradores. Misma expresión regular, otro producto. La línea está en lo que la página dice que es la herramienta, no en el código.

## Hacia dónde va esto

Una señal de procedencia que solo el proveedor puede verificar todavía no es procedencia pública. Pero el resultado sqrt(f) apunta a algo más concreto que "la carrera armamentista continúa". La ciencia forense basada solo en el contenido no puede responder la pregunta que la gente realmente hace. No si un texto fue generado, sino qué partes, por quién, y cuánto lo cambió una persona. Todos los mecanismos que tenemos se degradan justo donde viven los documentos reales, en archivos con varios autores y un largo historial de ediciones. Así que lo útil probablemente sea dejar de interrogar el texto y empezar a registrar el entorno. El historial de revisiones del editor, las líneas temporales de commits y las cadenas de ediciones firmadas ya capturan la autoría con mucha más fiabilidad que cualquier prueba estadística sobre un artefacto terminado, y el modelo de aserciones de C2PA apunta a ese tipo de procedencia en capas y con varios actores. El verdadero trabajo de la marca de agua es más acotado de lo que sugerían los titulares. Es una divulgación activada por defecto para el texto de máquina que nadie intenta ocultar, con los casos adversarios resueltos donde siempre debieron estar, en las herramientas que registran cómo se hizo un documento.
