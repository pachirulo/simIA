# Prueba local OpenRouter (17-09-2026)

## Estado

La preparación local quedó validada, pero la simulación real fue detenida a pedido antes de completarse. No se ejecutarán más llamadas hasta nueva indicación.

## Configuración preparada

- Node `22.14.0`, pnpm `10.10.0`.
- Workspace pnpm con 9 proyectos; `pnpm install --frozen-lockfile` correcto.
- Plantilla local: `.env.example.local` (copiar a `.env`, reemplazando `PUT_YOUR_KEY_HERE`).
- Brain: `UW_BRAIN=openrouter`; store local: `UW_STORE=none`.
- Simulación sugerida: `--days 1 --agents 2 --tick 10 --seed 7`.
- Modelos por defecto conservados: `UW_OR_MODEL_ROUTINE`, `UW_OR_MODEL_STAKES`, `UW_OR_MODEL_REFLECT`.

## Validación estática

- `pnpm typecheck`: correcto en los 8 paquetes con script.
- `pnpm test`: correcto (tests de cognition 43, engine 96, server 49, store 11 y web 58; los paquetes restantes sin tests).
- `pnpm build`: correcto; Next compiló y generó 50 rutas.
- `pnpm --filter @unwatched/cognition measure:context`: reducción observada en converse 56,9%, reflect 47,6%, plan 35,3% y decide 5,4–10,6%.

## Llamadas observadas antes de detener

La primera corrida alcanzó OpenRouter de verdad. `anthropic/claude-sonnet-5` y luego `anthropic/claude-haiku-4.5` devolvieron HTTP 400 por el límite del proveedor Anthropic: el schema de `action_proposal` contiene 31 parámetros opcionales y el proveedor permite 24. El runtime registró esos rechazos y activó su fallback normal. La corrida se detuvo para no continuar consumiendo cuota con respuestas rechazadas.

No se obtuvo una simulación completa ni métricas finales de coste/tokens; el proceso fue interrumpido antes de escribir `events.jsonl`/`summary.json`.

## Artefactos conservados

- `out/openrouter-smoke-20260917/run.log`: respuestas reales, reintentos, errores 400 y fallbacks.
- `out/openrouter-smoke-20260917-compatible/run.log`: segunda corrida iniciada y detenida inmediatamente a pedido.

La simulación headless sólo escribe `events.jsonl`, `gazette-day*.md`, `summary.json` y `construction.json` al completar; por eso esos archivos aún no existen en estas dos carpetas.

## Repetición posterior

```powershell
Copy-Item .env.example.local .env
# editar .env y poner la clave real sin imprimirla
pnpm --filter @unwatched/headless soak -- --days 1 --agents 2 --brain openrouter --seed 7 --tick 10 --out out/openrouter-smoke-YYYYMMDD
```

Para levantar servicios sin forzar mock en el script `dev`:

```powershell
$env:UW_BRAIN='openrouter'
pnpm --filter @unwatched/server start   # API/WebSocket :4000
pnpm --filter @unwatched/web dev        # Next :3000, en otra terminal
```

El script `apps/server` `dev` fija `UW_BRAIN=mock`; no usarlo para una prueba OpenRouter.

## Actualización: DeepSeek

Los tres slots se configuraron como `deepseek/deepseek-v4-flash-0731` en `.env`, `.env.example` y `.env.example.local`. El server y la web se probaron en `4100` y `3100` porque `4000` y `3000` estaban ocupados por otro proyecto. Ambos arrancaron; el server reportó `brain openrouter` y alcanzó OpenRouter, pero DeepSeek devolvió contenido vacío y el runtime registró `not json`/fallback. Se detuvieron los procesos para evitar consumo indefinido. No hubo una simulación completa ni métricas finales.
