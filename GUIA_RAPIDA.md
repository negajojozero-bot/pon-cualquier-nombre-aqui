# Guia rapida: crear un relay para Gazapo Link

Solo **uno de los dos jugadores** necesita crear el relay. Los dos telefonos deben
guardar exactamente la misma URL.

## Lo que necesitas

- una computadora con Windows y acceso a Internet;
- una cuenta gratuita de Cloudflare;
- Node.js LTS instalado desde https://nodejs.org/;
- la carpeta descomprimida de este paquete.

No necesitas saber programar, abrir puertos ni dejar la computadora encendida.

## Crear el relay

1. Crea una cuenta gratuita en https://dash.cloudflare.com/sign-up.
2. Instala Node.js LTS desde https://nodejs.org/ usando las opciones predeterminadas.
3. Descomprime completamente `Gazapo-Link-Relay-protocolo-8.zip`.
4. Abre la carpeta extraida.
5. Haz doble clic en `CREAR_RELAY_WINDOWS.bat`.
6. Cuando se abra el navegador, inicia sesion en Cloudflare y autoriza Wrangler.
7. Regresa a la ventana negra y espera a que termine.
8. Copia la direccion que termina en `.workers.dev`. Se parecera a esta:

   ```text
   https://gazapo-link-relay.XXXX.workers.dev
   ```

## Comprobarlo

Abre la URL en el navegador. Debes ver un texto parecido a:

```json
{"ok":true,"service":"gazapo-link-relay","protocol":8}
```

Si aparece `protocol: 8`, el relay esta listo.

## Configurar los dos telefonos

En **cada telefono**:

1. Abre Gazapo Link.
2. Entra al menu de tres puntos.
3. Abre `Multijugador online > Servidor online`.
4. Pega la misma URL completa.
5. Pulsa `Guardar`.

La direccion permanecera guardada aunque cierres o actualices Gazapo Link. Despues,
uno crea la sala y comparte el codigo; el otro se une con ese codigo.

## Regla esencial

```text
Telefono A: https://gazapo-link-relay.XXXX.workers.dev
Telefono B: https://gazapo-link-relay.XXXX.workers.dev
```

Si las direcciones son distintas, los jugadores estan en servidores diferentes y la
sala no aparecera.

## Preguntas frecuentes

### ¿Los dos debemos tener Cloudflare?

No. Solo la persona que crea el relay necesita la cuenta. El amigo solo pega la URL.

### ¿Debo dejar encendida la computadora?

No. Una vez desplegado, Cloudflare ejecuta el relay.

### ¿Puedo reutilizar la URL?

Si. Puedes utilizarla en partidas futuras y compartirla con el mismo amigo.

### ¿Cuesta dinero?

Cloudflare dispone de un plan gratuito con limites diarios. No añadas un metodo de
pago ni cambies voluntariamente al plan de pago si deseas mantenerte en el gratuito.

### ¿Que pasa si pulso Quitar en Gazapo Link?

La aplicacion olvida la URL en ese telefono, pero el Worker continua existiendo en
Cloudflare. Puedes pegar nuevamente la misma direccion.
