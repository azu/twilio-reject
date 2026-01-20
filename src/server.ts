import express from "express";
import twilio from "twilio";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// 環境変数
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_TWIML_APP_SID = process.env.TWILIO_TWIML_APP_SID;
const API_KEY_SID = process.env.API_KEY_SID;
const API_KEY_SECRET = process.env.API_KEY_SECRET;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_TWIML_APP_SID) {
  console.error(
    "Missing required environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TWIML_APP_SID"
  );
  process.exit(1);
}

if (!API_KEY_SID || !API_KEY_SECRET) {
  console.error(
    "Missing required environment variables: API_KEY_SID, API_KEY_SECRET"
  );
  process.exit(1);
}

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// 静的ファイル配信 (本番用)
app.use(express.static(path.join(__dirname, "../dist/client")));

// Access Token生成
app.get("/token", (_req, res) => {
  const identity = "test-user-" + Date.now();

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const accessToken = new AccessToken(
    TWILIO_ACCOUNT_SID,
    API_KEY_SID,
    API_KEY_SECRET,
    { identity }
  );

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: false,
  });

  accessToken.addGrant(voiceGrant);

  console.log(`[Token] Generated for identity: ${identity}`);

  res.json({
    token: accessToken.toJwt(),
    identity,
  });
});

// TwiML App webhook
// MODE: "reject" | "http-error" | "invalid-twiml" | "say-hangup"
const WEBHOOK_MODE = process.env.WEBHOOK_MODE || "reject";

app.post("/voice", (req, res) => {
  console.log("[Voice Webhook] Received request:", {
    from: req.body.From,
    to: req.body.To,
    callSid: req.body.CallSid,
  });
  console.log("[Voice Webhook] Mode:", WEBHOOK_MODE);

  if (WEBHOOK_MODE === "http-error") {
    console.log("[Voice Webhook] Returning HTTP 500 error");
    res.status(500).send("Internal Server Error");
    return;
  }

  if (WEBHOOK_MODE === "invalid-twiml") {
    console.log("[Voice Webhook] Returning invalid TwiML");
    res.type("text/xml");
    res.send("<Invalid>Not valid TwiML</Invalid>");
    return;
  }

  if (WEBHOOK_MODE === "say-hangup") {
    console.log("[Voice Webhook] Returning Say + Hangup TwiML");
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say("This call will be terminated.");
    response.hangup();
    console.log("[Voice Webhook] Returning TwiML:", response.toString());
    res.type("text/xml");
    res.send(response.toString());
    return;
  }

  // デフォルト: <Reject>を返す
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  response.reject({ reason: "rejected" });

  console.log("[Voice Webhook] Returning TwiML:", response.toString());

  res.type("text/xml");
  res.send(response.toString());
});

// ヘルスチェック
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`TwiML App SID: ${TWILIO_TWIML_APP_SID}`);
});
