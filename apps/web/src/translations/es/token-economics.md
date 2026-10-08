---
title: "La economía de tokens de la IA local"
description: "Por qué todo equipo que ejecuta cargas de trabajo de IA sostenidas, desde un laboratorio doméstico individual hasta una empresa de 50,000 usuarios, recupera la inversión más rápido siendo dueño de la capa de inferencia que alquilándola."
publishedAt: "2026-05-07"
difficulty: "Intermediate"
topics: ["AI Engineering", "Architecture"]
readingTime: 9
aiSummary: "Rohit sostiene que ser dueño de la capa de inferencia se paga solo a cualquier escala, desde un laboratorio doméstico individual hasta una empresa de 50,000 usuarios. Explica por qué los costes de las API en la nube crecen de forma lineal con la adopción mientras que los costes del hardware propio se estabilizan, por qué preentrenar un modelo desde cero es una trampa de varios millones de dólares en la que nadie fuera de los laboratorios de frontera necesita caer, y cómo el ajuste fino eficiente en parámetros reduce el coste de personalización a unos pocos cientos de dólares en una sola GPU de consumo."
sourceHash: "d22f61ad2a9ed7d3dd100ecab206e8e814c2660378463d0ba555f25a8aa6af4e"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  Las API de LLM en la nube están tarifadas para prototipos. Si ejecutas la misma carga a escala de producción, la factura sale entre dos y tres veces lo que costaría el hardware propio, y la curva es fractal, así que una startup de cinco personas que quema su margen en créditos de Anthropic vive la misma curva que una empresa de 50,000 usuarios. La razón por la que la mayoría de los equipos nunca cierra esa brecha es que confunden "ser dueños de su modelo" con "entrenar uno desde cero". Eso es una trampa de varios millones de dólares. La respuesta real es ajustar uno abierto por unos pocos cientos de dólares en una sola GPU.
</TLDR>

Este es el artículo que todo gran proveedor de nube preferiría que yo no escribiera. Las cuentas no están ocultas: están publicadas en lenguaje claro en sus propias páginas de precios, en su propia documentación, en estudios del sector que cualquiera puede descargar. Simplemente preferirían que nadie los leyera, porque cada empresa que hace las cuentas y monta su propia capa de inferencia es una empresa que gasta menos en alquilar API. La respuesta a cualquier escala, una startup de cinco personas, una empresa de cincuenta mil usuarios o cualquier punto intermedio de la curva, es la misma: el equipo que es dueño de su capa de inferencia se paga varias veces por encima del que la alquila.

![La economía de tokens de la IA local: un ingeniero en una sala de servidores de Gekro Labs sostiene un cartucho de tokens frente a un cartel que dice "Proveedor de nube: pago por token"](/images/blog/token-economics.png)

## La arquitectura

La tarifa por millón de tokens parece plana. No lo es. La salida cuesta de tres a diez veces la entrada. Los modelos de razonamiento esconden los tokens de cadena de pensamiento dentro de esa factura de salida. Cada solicitud vuelve a pagar el coste del prompt del sistema y de cualquier contexto RAG que lleve adjunto. Nada de eso aparece desglosado en la página de precios. Todo llega a la factura.

Enterprise Strategy Group hizo la comparación en 2025 con Dell Technologies, modelando un despliegue de Llama 3 de 70B parámetros con RAG en una ventana de cuatro años sobre tres arquitecturas: Dell AI Factory en local, IaaS en la nube y consumo puro de API. Así se ve la cuenta en el extremo de alta utilización de la curva:

| Arquitectura | Coste por usuario, por mes | Forma de escalado |
|---|---|---|
| Servicio de API (clase GPT-4o) | $12.19 | Lineal con el tráfico; nunca se estabiliza |
| 70B local con RAG | $3.00 – $4.28 | Se estabiliza una vez instalado el hardware |

Con 10,000 usuarios, lo local sale **52% más barato** en la ventana de cuatro años. Con 50,000 usuarios, **62% más barato**. La brecha se ensancha con la adopción, justo lo contrario de lo que suponen la mayoría de los criterios de compras. Si quieres hacer la misma cuenta con tu propia carga, hay dos herramientas complementarias en este sitio: la [calculadora de costes de LLM](/apps/llm-cost-calculator) calcula el mes de equilibrio entre cualquier modelo en la nube y cualquier opción de hardware local para tus volúmenes de tokens concretos, y la [comparación de precios de hiperescaladores](/apps/hyperscaler-comparison) sigue Bedrock, Azure Foundry y Vertex con el mismo modelo y precios verificados cada semana.

Olvida un momento los números absolutos. Mira las curvas. El gasto en API crece linealmente con el tráfico y nunca se estabiliza. El gasto en hardware propio se topa con el ciclo de vida del hardware. La adopción es la variable que decide si has construido un foso o has firmado un impuesto. Las cifras de Dell son a escala empresarial, pero la curva es fractal: una startup de cinco personas que ve subir su factura mensual de Anthropic u OpenAI al pasar de prototipo a producción está en esta misma línea, solo que con un multiplicador menor. A las matemáticas no les importa tu plantilla; les importa si tu volumen sostenido de tokens mantiene el hardware propio lo bastante ocupado como para amortizarlo.

Hay un segundo eje que no aparece en absoluto en la comparación en dólares. La inferencia en la nube mueve cada prompt (contexto del sistema, documentos recuperados, estado intermedio del agente) a través de una frontera de red hacia un tercero. Eso activa el alcance normativo, la exposición a fugas de propiedad intelectual, la dependencia del proveedor en torno a las hojas de ruta de ventanas de contexto y los límites de peticiones, el riesgo de concentración si el proveedor sufre una caída regional a las 3 AM, y la variación de precios incluso entre hiperescaladores que ofrecen el mismo modelo. Yo lo llamo *soberanía de inferencia*. Es la misma conversación que tuvo el liderazgo tecnológico sobre la soberanía de datos hace cinco años, un nivel más abajo en la pila.

La objeción que me ponen los CTO en este punto es justa: *"Pero Bedrock, Vertex y OpenAI ofrecen todos ajuste fino. ¿Para qué quiero mi propia GPU?"* Porque el ajuste fino gestionado en la nube es alquiler con pasos extra. Los datos de entrenamiento siguen saliendo de tu perímetro. Los pesos del adaptador viven en la infraestructura de otro. La inferencia sigue ejecutándose a la tarifa por solicitud de otro y según la hoja de ruta de otro. Has añadido personalización a la dependencia, no has quitado la dependencia. El laboratorio local es la única arquitectura donde tu modelo, tus datos y tu bucle de inferencia son tuyos a la vez.

## La construcción

La razón por la que la mayoría de los equipos nunca da este paso es que confunden *ser dueños de su modelo* con *entrenar su modelo desde cero*. Son dos problemas completamente distintos, separados por entre cuatro y seis órdenes de magnitud de coste.

### No lo preentrenes

El AI Index 2025 de Stanford puso precio al cómputo de entrenamiento detrás de la frontera: GPT-4 en unos **$78 millones**, Llama 3.1 405B en **$170 millones**, Gemini Ultra en **$191 millones**. Son dólares de alquiler en la nube amortizados, solo cómputo en bruto: sin ingeniería de datos, sin MLOps, sin sueldos de quienes realmente saben operar un clúster de miles de GPU sin dejarlo inservible. Incluso en el extremo pequeño de la curva, un modelo de 7B desde cero cuesta $50K–$500K y decenas de miles de horas de GPU. Uno de 70B cuesta $1.2M–$6M y un clúster dedicado de 256 GPU H200 funcionando durante semanas.

No lo hagas. Nadie fuera de los presupuestos de los laboratorios de frontera lo necesita.

### Aplícale PEFT

La jugada real es el **ajuste fino eficiente en parámetros** (Parameter-Efficient Fine-Tuning) sobre una base de pesos abiertos ya existente. Llama 3, Mistral, Qwen, Phi: ya fluidos en inglés, con sintaxis correcta, con conocimiento del mundo. Lo que añades encima es tu dominio: tu taxonomía, tu formato, tu lógica de decisión, tu tono. Es un ajuste minúsculo en el espacio de parámetros, y las técnicas modernas lo aprovechan directamente.

| Enfoque | Parámetros actualizados | VRAM (base de 7B) | Coste de cómputo |
|---|---|---|---|
| Ajuste fino completo | 100% (~7B) | 80GB+ multi-GPU | $10K – $35K |
| LoRA | 1 – 10% | 16 – 40GB | $500 – $3,000 |
| QLoRA (4 bits) | < 1% | 8 – 10GB | $50 – $500 |

Los números de esa columna de VRAM son valores de referencia para un modelo de 7B. Para saber si un modelo concreto con una cuantización concreta cabe de verdad en una GPU concreta, la [calculadora de VRAM de GPU](/apps/gpu-vram-calculator) lo desglosa: pesos del modelo más caché KV más activaciones, frente a una tabla seleccionada de GPU de consumo, tarjetas de centro de datos, Apple Silicon y aceleradores para Pi. Vale la pena ejecutarla antes de cualquier decisión de hardware.

LoRA congela por completo los pesos base e inyecta pequeñas matrices entrenables de descomposición de rango en capas de atención específicas: estás actualizando algo del orden del 1% del número de parámetros. QLoRA va más allá cuantizando la base congelada a 4 bits, lo que reduce la huella de memoria lo suficiente como para que un ajuste de 7B quepa en una sola GPU de consumo. Una ejecución seria de adaptación con QLoRA cuesta unos pocos cientos de dólares y termina durante la noche. La forma del script, lo que está previsto para el próximo trimestre de trabajo del laboratorio Gekro contra un conjunto de datos seleccionado, es más o menos esta:

```python
# gekro_qlora_train.py - Llama 3 8B + QLoRA via Unsloth + TRL
# Target: single consumer GPU (Mac Mini Metal or RTX 4090 class)
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/llama-3-8b-bnb-4bit",
    max_seq_length=4096,
    load_in_4bit=True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,                                # LoRA rank
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_alpha=16,
    lora_dropout=0.0,
    use_gradient_checkpointing="unsloth",
)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    # Expected JSONL shape per record:
    # {"messages": [{"role": "user", "content": "..."},
    #               {"role": "assistant", "content": "..."}]}
    train_dataset=load_curated_dataset(),    # your domain corpus
    args=TrainingArguments(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        num_train_epochs=3,
        learning_rate=2e-4,
        optim="adamw_8bit",
        output_dir="./checkpoints",
    ),
)
trainer.train()
```

Un archivo. Una GPU. Una ejecución nocturna. El resultado es un pequeño archivo de pesos de adaptador que cargas encima de la base congelada en el momento de la inferencia, servido con Ollama o vLLM igual que servirías el modelo base.

### Los niveles de hardware: los laboratorios escalan con el tamaño del equipo, no con los ingresos de la empresa

| Nivel | Presupuesto | Hardware | Qué ejecuta |
|---|---|---|---|
| **Prototipado** | $899 – $3,500 | Una GPU de consumo (RTX 4070 / 4090) | 7B–8B cuantizado a más de 40 tok/s para un ingeniero |
| **Ajuste fino** | $7,500 – $14,000 | RTX 5090 o RTX 6000 Ada dobles / cuádruples, Threadripper, 128–256GB de RAM | Trabajos LoRA / QLoRA sobre bases de 7B–13B, horas por ejecución |
| **Espejo de producción** | $75,000 – $250,000+ | NVIDIA L40S / H100 / H200, NVLink, 100GbE | Batching continuo, servicio multiinquilino, validación de MLOps |

Un ingeniero individual con flujos de IA pesados pertenece al nivel 1. Un equipo con cargas agénticas sostenidas pertenece al nivel 2. Una organización que sirve a miles de usuarios pertenece al nivel 3. La misma arquitectura, tres multiplicadores. En cada nivel las cuentas de recuperación salen más rápido que el ciclo de compras que las aprobó: meses en el nivel 1, semanas en el nivel 2 una vez que los adaptadores ajustados empiezan a servir tráfico real, y muchas veces más en el nivel 3 frente a un gasto equivalente en API a escala sostenida.

La pila de servicio ha convergido en 2026, y esa es la parte menos contada de la historia. vLLM ha ganado en rendimiento: su algoritmo PagedAttention particiona la caché KV como los sistemas operativos paginan la memoria virtual, y la diferencia entre servir con vLLM y servir de forma ingenua en el mismo hardware es la diferencia entre una GPU ociosa y una saturada. Ollama ha ganado en ergonomía para el desarrollador en escritorio y en el borde. TensorRT-LLM vive donde te has comprometido con NVIDIA y quieres hasta el último ciclo. MLflow o Weights & Biases se encargan del seguimiento de experimentos, porque el ajuste fino de LLM no es determinista y la reproducibilidad es la diferencia entre una demo de investigación y un sistema de producción.

Ya no necesitas el equipo de infraestructura de Anthropic u OpenAI para ejecutar inferencia en producción a escala. La pila que a esas empresas les llevó años construir ahora es un `pip install` y un archivo de configuración. Eso es nuevo en 2026, y es la razón completa por la que las cuentas de este artículo funcionan a cualquier nivel. Ya he documentado el [patrón de Ollama en una Pi como seguro arquitectónico](/blog/es/hello-ollama/) y el [GekroLLMClient que abstrae los proveedores en la nube y locales tras una sola interfaz](/blog/es/api-sovereignty/); ambos escalan directamente de un laboratorio doméstico al nivel empresarial.

## Las contrapartidas

Ser dueño de la capa de inferencia no sale gratis, y fingir lo contrario es como los laboratorios acaban convertidos en pisapapeles. Vale la pena nombrar cuatro modos de fallo.

**La infrautilización mata la curva.** El argumento del punto de equilibrio depende del rendimiento sostenido. Monta un servidor de nivel 3 y úsalo al 8% de utilización y habrás construido un pisapapeles carísimo. Las API en la nube son genuinamente más baratas para trabajo irregular y de bajo volumen: esa es su forma ideal, y deberías seguir usándolas para eso. Antes de cualquier decisión de hardware, pregúntate: ¿cuál es el volumen diario estable de tokens de las cargas que voy a internalizar, y es lo bastante grande para mantener el hardware ocupado? Si la respuesta honesta es no, quédate en la API para esa carga. El hardware local se gana el sueldo estando saturado.

**El precipicio de calidad es real.** Un 8B ajustado para una tarea acotada y bien definida puede igualar o superar a una API de frontera en esa tarea: ese es todo el sentido del ajuste fino. Pero en cuanto la carga deriva hacia el razonamiento abierto o el conocimiento multidominio, el modelo pequeño se cae por un precipicio. Lo he sentido en carne propia. Mi Mac Mini ejecuta felizmente un 70B cuantizado y las respuestas son perfectamente utilizables para resumir, clasificar y revisar código. También son visiblemente menos matizadas que lo que devuelven Claude o Gemini Pro con el mismo prompt: más cortas, más literales, más propensas a pasar por alto la implicación de segundo orden de una pregunta. La decisión de enrutamiento es la arquitectura, y vive en el envoltorio del cliente:

```python
# Hybrid routing - local for narrow tasks, cloud for long-tail reasoning
NARROW = {"classify", "extract", "summarize", "format", "tag"}
REASONING = {"design", "plan", "synthesize", "debug-novel"}

def route(task_class: str, prompt: str) -> str:
    if task_class in NARROW:
        return local_finetuned_8b.run(prompt)
    if task_class in REASONING:
        return cloud_frontier.run(prompt)
    return cloud_frontier.run(prompt)        # default: don't guess
```

Local para trabajo acotado, de alto volumen y sensible a la latencia. Frontera en la nube para el razonamiento de cola larga que el modelo local no puede manejar. Este es el corazón del [patrón de soberanía de API](/blog/es/api-sovereignty/): el laboratorio no sustituye a la nube, se come primero las cargas predecibles. Cada token que maneja el nivel local es un token que la factura de la nube no te cobra. Cada token que dejas en la nube es un token con el que, en la práctica, subvencionas la próxima ronda de cómputo de entrenamiento del proveedor.

**El conjunto de datos es el foso, no la GPU.** El cómputo es barato. La ejecución de QLoRA que cuesta $300 en tiempo de GPU puede apoyarse en un esfuerzo de anotación que le costó al equipo $60,000 en horas de expertos, y en una ejecución seria de DPO o RLHF la proporción entre etiquetado humano y cómputo suele ser de veinte a treinta veces a favor de los humanos. Eso no es un argumento contra el ajuste fino. Es un argumento de que, si tu organización no puede articular su taxonomía por escrito, no se pone de acuerdo en cómo es una salida *correcta* para tu dominio, no puede dedicar expertos de dominio a revisar anotaciones, entonces todavía no tienes un problema de ajuste fino, tienes un problema de gestión del conocimiento. Resuelve eso primero. El cómputo es la mitad fácil. Cuando empieces a dar formato a los ejemplos de entrenamiento, espera fricción de formatos entre frameworks: el esquema de chat de OpenAI, Alpaca, ShareGPT y Unsloth/Llama quieren los mismos datos con una forma ligeramente distinta. Construí el [formateador de conjuntos de datos de ajuste fino](/apps/finetuning-formatter) para encargarse de la conversión y señalar los errores de turno faltante que provocan fallos silenciosos de entrenamiento.

**La renovación del hardware es brutal. Esa es la característica, no el fallo.** La contabilidad deprecia los servidores en cinco o seis años. El silicio de IA no coopera. Cada año aproximadamente llega una nueva generación de GPU con mejoras sustanciales de eficiencia, lo que significa que una H100 adquirida a principios de 2024 va dos generaciones de arquitectura por detrás a finales de 2026. Planifica una renovación de 24–36 meses en el nivel más exigente y un patrón de cascada de valor que mueva el silicio más viejo hacia cargas más ligeras: entrenamiento de frontera en los años 1–2, inferencia en tiempo real en los años 3–4, análisis por lotes después. La flexibilidad para renovar de forma agresiva es en sí misma un activo estratégico. El compromiso de instancias reservadas a tres años de la nube no te la da, ni tampoco el contrato de API a largo plazo que tu equipo de finanzas está a punto de firmar.

## Hacia dónde va esto

Este artículo es en parte síntesis y en parte mi propia hoja de ruta. Hoy ejecuto inferencia local en un Mac Mini y en un clúster de Pi, con el [GekroLLMClient](/blog/es/api-sovereignty/) enrutando entre la nube y lo local según la clase de carga. Lo que todavía no he hecho, y alrededor de lo cual está construido el próximo trimestre de trabajo del laboratorio, es ejecutar un QLoRA de extremo a extremo contra un conjunto de datos seleccionado en mi propio hardware, con el bucle de evaluación y la disciplina de MLOps que convierten un ajuste puntual en una canalización reproducible. Hay además un segundo frente de optimización propio del lugar donde vivo: la red eléctrica de Texas tiene sus propias opiniones sobre cuándo deben ejecutarse los trabajos de entrenamiento, y eso solo se abre una vez que tienes el hardware en propiedad.

Nada de esto está oculto. Los proveedores de nube que redactan tu factura mensual ya lo saben. Apuestan a que tu equipo de ingeniería está demasiado ocupado entregando funcionalidades como para hacer las cuentas. Hazlas de todos modos.
