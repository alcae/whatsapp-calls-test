import express from "express";
import axios from "axios";

const app = express();

app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GRAPH_VERSION = process.env.GRAPH_VERSION || "v25.0";

app.get("/", (req, res) => {
  res.status(200).send("WhatsApp Calling Sandbox Test activo ✅");
});

/**
 * Verificación del webhook de Meta
 */
app.get("/webhook/whatsapp-calls", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Intento de verificación webhook:", {
    mode,
    token,
    challenge
  });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado correctamente ✅");
    return res.status(200).send(challenge);
  }

  console.log("Verificación fallida ❌");
  return res.sendStatus(403);
});

/**
 * Webhook que recibe eventos de WhatsApp
 */
app.post("/webhook/whatsapp-calls", async (req, res) => {
  console.log("====================================");
  console.log("WEBHOOK RECIBIDO");
  console.log("====================================");
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const entries = req.body?.entry || [];

    for (const entry of entries) {
      const changes = entry?.changes || [];

      for (const change of changes) {
        const field = change?.field;

        console.log("Field recibido:", field);

        if (field !== "calls") {
          console.log("No es evento de llamada. Ignorando...");
          continue;
        }

        const value = change?.value || {};
        const calls = value?.calls || [];

        for (const call of calls) {
          const callId = call?.id;
          const event = String(call?.event || "").toLowerCase();
          const from = call?.from;
          const sdpType = call?.session?.sdp_type;
          const sdp = call?.session?.sdp;

          console.log("📞 LLAMADA DETECTADA:");
          console.log({
            callId,
            event,
            from,
            sdpType,
            tieneSdp: Boolean(sdp)
          });

          /**
           * Primera prueba:
           * No contestamos la llamada.
           * Solo verificamos que entró y luego la rechazamos.
           */
          if (callId && event === "connect") {
            console.log("Llamada entrante detectada. Rechazando llamada para prueba rápida...");

            await rejectWhatsAppCall(callId);

            console.log("Llamada rechazada correctamente ✅");
          }
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Error procesando webhook:", error?.response?.data || error.message);

    /**
     * Respondemos 200 para evitar reintentos infinitos de Meta.
     */
    return res.sendStatus(200);
  }
});

/**
 * Rechazar llamada desde Graph API
 */
async function rejectWhatsAppCall(callId) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/calls`;

  const payload = {
    messaging_product: "whatsapp",
    call_id: callId,
    action: "reject"
  };

  console.log("Enviando rechazo a Meta:", payload);

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    timeout: 15000
  });

  console.log("Respuesta de Meta:", response.data);

  return response.data;
}

app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
  console.log("Ruta webhook GET/POST: /webhook/whatsapp-calls");
});
