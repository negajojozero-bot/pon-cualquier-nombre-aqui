# Relay para Gazapo Link

Esta plantilla despliega un relay privado de Gazapo Link en la cuenta gratuita de
Cloudflare del usuario. El relay coordina una partida de dos jugadores mediante
WebSockets y un Durable Object.

Solo uno de los dos jugadores debe desplegarlo. Después, ambos guardan exactamente
la misma URL `workers.dev` en Gazapo Link.

## Despliegue con un clic

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/gazapo-ai/gazapo-link-relay)

Pulsa el botón, inicia sesión en GitHub y Cloudflare, acepta los nombres sugeridos
y selecciona `Deploy`. No necesitas descargar archivos ni instalar programas.

Cloudflare clonará la plantilla en la cuenta del usuario y creará automáticamente:

- el Worker `gazapo-link-relay`;
- el binding `RELAY`;
- el Durable Object SQLite `RelayRoom`;
- una URL personal terminada en `.workers.dev`.

Cada despliegue pertenece a la cuenta de quien lo crea. No consume la cuota del
autor de Gazapo Link ni comparte recursos con otros despliegues.

## Comprobación

Abre la URL entregada por Cloudflare. Debe responder:

```json
{"ok":true,"service":"gazapo-link-relay","protocol":8}
```

Si aparece `protocol: 8`, el relay está listo.

## Configurar los teléfonos

En los dos teléfonos:

1. Abre Gazapo Link.
2. Pulsa el menú de tres puntos.
3. Entra en `Multijugador online > Servidor online`.
4. Pega la misma URL completa.
5. Pulsa `Guardar`.

Si las URL son diferentes, cada jugador estará conectado a un servidor distinto y
no podrán encontrarse.

## Despliegue manual alternativo

Requiere Node.js:

```text
npm install
npx wrangler login
npm run deploy
```

En Windows también se puede ejecutar `CREAR_RELAY_WINDOWS.bat`.

## Privacidad y funcionamiento

Durante una sesión, el relay procesa identificadores técnicos, hashes de ROM,
entradas de control y bloques de sincronización o guardado enviados por la app. El
código de esta plantilla no escribe esos datos en almacenamiento permanente; se
retransmiten entre los dos participantes y se mantienen asociados a la conexión.

El propietario del despliegue controla su Worker y debe proteger su cuenta de
Cloudflare. No debe modificar el relay para registrar contenido privado sin informar
a sus usuarios.

## Compatibilidad

- Protocolo de Gazapo Link: `8`
- Jugadores por sala: `2`
- Runtime: Cloudflare Workers
- Coordinación: Durable Objects con SQLite
