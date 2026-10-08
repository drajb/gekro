---
title: "La IA programa como un genio. Diseña arquitecturas como un pez de colores."
description: "Por qué las pruebas de concepto de IA con un solo intento se desmoronan a escala, y cómo las plantillas arquitectónicas con restricciones son lo único que separa un código limpio de una bomba de relojería en producción."
publishedAt: "2026-03-28"
difficulty: "Intermediate"
topics: ["AI Engineering", "Architecture", "Productivity"]
readingTime: 5
aiSummary: "Las herramientas de programación con IA actúan como motores sin estado que se degradan sin restricciones arquitectónicas. Este artículo detalla la estrategia exacta de plantillas y base de conocimiento que evita que las inconsistencias en cascada conviertan una prueba de concepto que funciona en un código de producción imposible de arreglar."
sourceHash: "83f8dd1a268736a94ef519833ac6c8e84a5443aa96e19c1f392d140a5ecbad1f"
translatedAt: "2026-10-08"
translator: "claude-sonnet-5-5"
reviewed: false
---

<TLDR>
  Las afirmaciones sobre generar aplicaciones de un solo intento pueden funcionar de vez en cuando para una prueba de concepto de fin de semana, pero refinar esa prueba de concepto hasta convertirla en un producto final es un proceso implacable que lleva tiempo de verdad. Un programador ocasional aceptará con gusto el resultado, completamente ajeno a que el código sin contexto está corrompiendo en silencio el activo desplegable. Una base de ingeniería sólida es la única forma de escalar la IA sin introducir inconsistencias terminales.
</TLDR>

Dos semanas después de que la demo se viera increíble, la compilación era irreparable. No rota en un solo punto: rota en todas partes, de formas que se contradecían entre sí. Así es realmente el escalado de un solo intento. Los no desarrolladores y los programadores ocasionales gritan desde los tejados que la IA puede construir aplicaciones enteras en segundos. Miran una prueba de concepto brillante y funcional, cosida con prompts de un solo intento, y asumen que está básicamente terminada, ignorando por completo el tiempo estructural, real y agotador que cuesta refinar un producto hasta su estado final.

Lo recuperé, al final. No parcheándolo. Me quedé con lo que había aprendido, tiré la estructura y reconstruí sobre una capa de memoria que el agente tenía que leer antes de que se le permitiera escribir nada. Todo el desvío costó unas tres semanas. Barato, por lo que me enseñó.

![Una aplicación futurista en forma de holograma, brillantemente pulida al frente, pero que al correr la cortina revela un desastre operativo de cinta adhesiva, cables enredados y un diminuto pez de colores pulsando botones al azar.](/images/blog/ai_goldfish_facade.png)

## La arquitectura

Modelos de IA como Claude, GPT5 y Gemini 3 actúan como motores de predicción sin estado. Un proyecto complejo solo aguantará si su base de conocimiento es sólida como una roca. Si los cimientos son débiles, la construcción del producto empezará inevitablemente a introducir errores e inconsistencias a medida que haya que hacer cambios con el tiempo.

Si esperas generar una aplicación de un solo intento a partir de un único prompt, o esperas resultados mágicos tras cada prompt en bruto, seguirás en bucles interminables, intentando arreglar un problema mientras creas otros nuevos en secreto. Planificar y sintetizar la investigación para trazar un sistema, seguido de una serie acotada de prompts dirigidos, es fundamentalmente la mejor estrategia para construir una base de código que aguante. Por eso una base de conocimiento rígida es crítica.

Esta es la línea divisoria exacta: un buen ingeniero de software detectará de inmediato las inconsistencias estructurales que introduce una IA, mientras que un programador ocasional puede tener un enfoque totalmente despreocupado, felizmente ajeno a que está integrando un desastre catastrófico de lógica de estado en conflicto.

| Fase | Prompts en bruto, sin fijar | Arquitectura con restricciones / plantilla |
|---|---|---|
| La prueba de concepto | Rápida. Se ve genial. | Rápida. Configuración estructural incómoda. |
| Sprint 2 | La IA alucina nuevos componentes de interfaz. | La IA queda restringida estrictamente a `@repo/ui`. |
| Producción | Las inconsistencias rompen la compilación. | La arquitectura con restricciones escala con seguridad. |

```text
# Example: What a strong, constrained knowledge base looks like
/antigravity-base
├── apps
│   ├── web        (Astro 4 + Tailwind v4)
│   └── studio     (Sanity CMS)
├── packages
│   ├── ui         (Strict design tokens - AI CANNOT hallucinate)
│   ├── config     (Shared ESLint/TS - strict boundaries)
│   └── core       (Business logic boundaries)
├── knowledge      (Deep context and architectural decisions)
│   └── routing-rules.md
└── turbo.json     (Build constraints)
```

## La construcción

Cuando construí gekro.com, no empecé con un prompt en blanco y una esperanza ingenua de éxito al primer intento. Empecé con una estructura arquitectónica rígida. Con el tiempo he creado mis propias plantillas "Antigravity", muy reutilizables, que me ayudan a restringir con rigidez a la IA para arrancar muy rápido cualquier proyecto complejo. El punto de partida de todo proyecto serio debería ser una base profundamente arraigada, basada en tu visión actual y a largo plazo. Los desarrolladores deben empezar a crear plantillas con sus propias bases de conocimiento para imponer restricciones.

```bash
# Initializing the environment from the core template
# Replace with your own base template repo
git clone https://github.com/your-org/your-base my-new-project
cd my-new-project
pnpm install

# Enforcing strict boundaries before AI touches anything
pnpm turbo run typecheck lint
```

Si necesito que Claude genere una función nueva, debe operar dentro de las definiciones estrictas de mi plantilla existente. Este es el bloque de configuración exacto que incorporo al prompt de sistema del agente para impedir que se descontrole e introduzca inconsistencias que lo rompan todo.

```typescript
// Conceptual representation - actual rules live in your workspace system prompt / .cursorrules
// packages/config/base-agent-rules.ts
export const AgentConstraints = {
  allowAny: false,
  styling: "Tailwind v4 utility classes exclusively",
  state: "No local state for global data - use centralized store",
  components: "Astro islands for interactivity only",
  imports: "Use alias @repo/ui, never relative paths",
  knowledge: "Always refer to /knowledge/routing-rules.md before creating new endpoints"
} as const;
```

Esto garantiza que la IA no esté adivinando cómo está estructurado el estado. Lee las restricciones, contrasta la base de conocimiento específica para obtener más contexto sobre cualquier tema concreto y ejecuta el cambio de forma quirúrgica.

Apuntar de forma constante tus reglas a una base de conocimiento dedicada hace dos cosas muy importantes: el agente se concentra exclusivamente en la tarea actual, y se preserva el límite de contexto de tu modelo, porque el agente no arrastra todo el código a la memoria solo para averiguar un único patrón de implementación.

El daño de ignorar esta disciplina es visceral. Esta es la diferencia exacta entre un componente alucinado y uno con restricciones:

```typescript
// What AI hallucinates without constraints:
import { Button } from '../../components/ui/Button'  
import { Card } from '../../../shared/Card'
import { theme } from './localTheme'  // invented, doesn't exist

// What AI generates with a constrained template:
import { Button, Card } from '@repo/ui'
import { tokens } from '@repo/config/tokens'
```

Esa única diferencia comunica todo el argumento sin una palabra de explicación.

Más allá del código base estructural, introducir flujos de "documenta sobre la marcha", registros de decisiones y gestores de incidencias en la raíz del repositorio ayuda enormemente. Al crear un contexto vivo y legible que el agente consulta antes de actuar, evitas activamente que la IA dé vueltas en círculos intentando resolver el mismo problema dos veces. En esencia, estás creando tu propio servidor MCP (Model Context Protocol) local, justo en tu sistema de archivos. Una organización estricta de archivos con el contexto inyectado directamente en las reglas del agente, junto con un buen README, es imprescindible para un repositorio sano.

Por ejemplo, trazar explícitamente adónde debe dirigir la lógica el agente garantiza el cumplimiento de la arquitectura:

```text
# Agent Prompt: Organization Enforcement
"Generate the new 'Analytics' feature. Follow the established file organization:
- Place all UI components strictly in `packages/ui/src/analytics/`
- Place all business state logic in `packages/core/stores/analytics.ts`
- Do NOT generate local component state. Review the `/knowledge/routing-rules.md` file first and automatically enforce these routing rules."
```

Antes de escribir una sola línea de código de aplicación para un proyecto complejo, mi flujo de trabajo habitual es lanzar un artículo de investigación profunda sobre el tema. Sintetizo esa investigación arquitectónica y luego empiezo a esbozar mi estrategia de prompts, guardando esos hallazgos como archivos Markdown en una carpeta aislada de artefactos. Una estrategia de prompts bien planificada y muy investigada, que haga referencia a artefactos explícitos, es infinitamente mejor que reaccionar a los fallos de un solo intento y dar vueltas intentando arreglarlos.

Además, construir así desbloquea un enorme control de costes. Esta estrategia funciona mejor cuando ya tienes una configuración con varios proveedores, algo que la capa de abstracción hace trivial. Tu plano y tu síntesis estructural deberían generarse con el modelo de frontera más capaz disponible, como Gemini Pro o Claude Opus. Una vez trazados los límites arquitectónicos rígidos, deja que un modelo más rápido y barato, como Flash, ejecute el plano documentado. Cuando termine la generación local de código, haz que el modelo de gama superior revise la solicitud de cambios para garantizar una consistencia estricta con la plantilla base. A la larga, esto ahorra muchísimo dinero.

Por último, exige siempre que el agente genere un conjunto de pruebas para cada función nueva. Asegúrate de que las instrucciones para ello vivan de forma explícita en las reglas del espacio de trabajo o en el README, para que las pruebas sean obligatorias en cada ciclo de prompts importante y no una ocurrencia tardía.

```text
# Agent Prompt: Test Suite Mandate
"Whenever you create or modify a component, you MUST simultaneously generate/update the exact corresponding `vitest` suite in the `packages/core/tests/` directory to cover the failure cases. Do not ask for permission, just include the test in the PR."
```

## Las contrapartidas

La tensión está por completo entre el coste inicial de construir una plantilla y la velocidad engañosa de los prompts en bruto. Mantener plantillas reutilizables consume horas de fin de semana que preferiría dedicar a construir funciones. Además, cuando sale una nueva versión mayor de un framework subyacente, la plantilla se rompe de raíz. Cada generación posterior de la IA basada en ella requiere una dirección manual intensa hasta que se parchea la base.

Hay una segunda contrapartida que no he resuelto, y no estoy seguro de que alguien lo haya hecho. La memoria sigue siendo el punto débil. Incluso con una buena capa de memoria, una configuración sensata de habilidades y varios agentes coordinándose, un proyecto grande sigue olvidando en silencio cosas que una persona que lo conociera nunca olvidaría. Así que te repites. Esa es la parte de este flujo de trabajo que me resulta genuinamente irritante, y ninguna cantidad de plantillas la arregla.

## Hacia dónde va esto

Vale la pena decir en qué me equivoqué. Antes pensaba que la generación de código con IA era simplemente propensa a errores: que escribía con aplomo sin comprender, y que ningún contexto la rescataba. Era una lectura justa de los modelos sobre los que formé esa opinión. No es una lectura justa de los actuales. Han avanzado muchísimo, y se puede confiar en ellos bastante más de lo que yo permitía, pero estrictamente en proporción al contexto que les das, que es todo el argumento de este artículo.

Nos estamos alejando de pedir código a los modelos para pedirles cumplimiento arquitectónico. Restringir la IA dentro de plantillas personales es el requisito previo para tratarla como un compañero de ingeniería fiable y no como una entidad caótica que destruye lentamente tu código de producción.
