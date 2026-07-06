# Polla Mundialista 2026 ⚽

Quiniela automatizada para la fase eliminatoria del Mundial 2026. Los puntajes se calculan automáticamente y el fixture se actualiza desde [Football-Data.org](https://www.football-data.org/).

## Stack

- **Next.js 16** (App Router)
- **Firebase** (Firestore + Admin SDK)
- **Tailwind CSS v4**
- **Football-Data.org API**
- **GitHub Actions** (cada 30 min actualiza resultados)
- **Vercel** (hosting)

## Scoring

| Acierto | Pts |
|---|---|
| Resultado exacto (marcador completo) | 6 |
| Ganador o empate acertado | 3 |
| Incorrecto | 0 |

## Pages

| Ruta | Descripción |
|---|---|
| `/` | Ranking general en tiempo real |
| `/dashboard` | Fixture con bracket por fase, entrada de resultados |
| `/pronosticos` | Carga y consulta de pronósticos por usuario |

### Fixture (`/dashboard`)
- Tabs por fase (Dieciseisavos, Octavos, Cuartos, Semis, Tercer Puesto, Final)
- Tarjetas con hora, equipos, banderas, resultado
- Input para ingresar resultados manualmente (se bloquean al guardar)
- Flecha de avance a siguiente fase

### Pronósticos (`/pronosticos`)
- Selector de usuario (persiste en localStorage)
- Partidos pendientes: entrada editable de goles
- Partidos finalizados: pronóstico vs resultado real lado a lado con indicador de acierto
- Filtro por fase

## Environment Variables

Ver `.env.example`. Las necesarias:

```
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_KEY=   # Base64 del JSON de cuenta de servicio
FIREBASE_PROJECT_ID=

# API
FOOTBALL_DATA_API_KEY=
FOOTBALL_COMPETITION_ID=WC
```

## Scripts

```bash
# Cargar partidos desde Football-Data.org a Firestore
node scripts/cargar-datos.mjs

# Cargar predicciones desde JSON
node scripts/cargar-predicciones.mjs predicciones.json
```

## Desarrollo

```bash
npm install
npm run dev
```

## Deploy

```bash
git push
# Vercel detecta el push y despliega automáticamente
```

Variables de entorno deben configurarse en **Vercel → Settings → Environment Variables** (Production + Preview).

## Actualización automática

GitHub Actions corre `GET /api/cron/update-fixtures` cada 30 minutos para sincronizar resultados desde la API y recalcular puntajes. También se pueden ingresar resultados manualmente desde `/dashboard`.
