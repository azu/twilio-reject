# Twilio Reject Test

Twilio Voice SDKの`device.connect()`でTwiML App webhookが`<Reject>`を返した場合、`error`イベントが発火するかを検証するアプリ。

## 検証目的

`enableImprovedSignalingErrorPrecision`オプションによってエラーコードが変わるかを確認する。

| 設定 | 期待するエラーコード |
|------|---------------------|
| `enableImprovedSignalingErrorPrecision: true` | 31002 (ConnectionDeclinedError) |
| `enableImprovedSignalingErrorPrecision: false` | 31005 (ConnectionError) |

## セットアップ

### 1. 環境変数の設定

`.env`ファイルを作成して、Twilioの認証情報を設定する。

```bash
# Twilio Account SID
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Twilio Auth Token
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# TwiML App SID
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# API Key SID (Voice SDKのトークン生成に必要)
API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# API Key Secret
API_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. TwiML Appの作成

Twilioコンソールで TwiML App を作成し、`TWILIO_TWIML_APP_SID`を取得する。

### 3. API Keyの作成

Twilioコンソールで API Key を作成し、`API_KEY_SID`と`API_KEY_SECRET`を取得する。

### 4. 依存関係のインストール

```bash
npm install
```

## 開発

### サーバー起動

```bash
npm run dev
```

### フロントエンド開発サーバー

別ターミナルで実行:

```bash
npx vite
```

### トンネル作成

```bash
cloudflared tunnel --url http://localhost:3000
```

### TwiML App設定

TwilioコンソールでTwiML AppのVoice Request URLを設定:

```
https://<cloudflared-url>/voice
```

## 検証手順

1. サーバー起動 (`npm run dev`)
2. フロントエンド起動 (`npx vite`)
3. トンネル作成 (`cloudflared tunnel --url http://localhost:3000`)
4. TwiML AppのVoice URLを更新
5. ブラウザで http://localhost:5173 を開く
6. "Connect"ボタンをクリック
7. ログでerrorイベントの内容を確認
8. チェックボックスで`enableImprovedSignalingErrorPrecision`を切り替えて再テスト

## 結果

### `<Reject>`を返した場合

`<Reject>`をTwiML App webhookから返した場合、**errorイベントが発火する**。

`enableImprovedSignalingErrorPrecision`オプションによってエラーコードが変わる:

| 設定 | 実際 |
|------|------|
| `enableImprovedSignalingErrorPrecision: true` | 31404 (NotFound) errorイベント発火 |
| `enableImprovedSignalingErrorPrecision: false` | 31005 (ConnectionError) errorイベント発火 |

#### `enableImprovedSignalingErrorPrecision: true` の場合

```
[Client] Connecting...
[Client] [TwilioVoice] WSTransport Received: ringing {callsid: "CAxxxxxxxx"}
[Server] [Voice Webhook] Received request: {from: "client:test-user-xxx", callSid: "CAxxxxxxxx"}
[Server] [Voice Webhook] Returning TwiML: <Response><Reject reason="rejected"/></Response>
[Client] [TwilioVoice] WSTransport Received: hangup {error: {code: 31404, message: "Not Found"}}
[Client] ===== CALL ERROR EVENT =====
[Client] Error code: 31404
[Client] Error message: NotFound (31404): Not Found
[Client] Full error: {
  "message": "NotFound (31404): Not Found",
  "causes": [
    "The outbound call was made to an invalid phone number.",
    "The TwiML application sid is missing a Voice URL."
  ],
  "code": 31404,
  "description": "Not Found (HTTP/SIP)",
  "explanation": "The server has not found anything matching the request.",
  "name": "NotFound",
  "solutions": [
    "Ensure the phone number dialed is valid.",
    "Ensure the TwiML application is configured correctly with a Voice URL link."
  ]
}
```

#### `enableImprovedSignalingErrorPrecision: false` の場合

```
[Client] Connecting...
[Client] [TwilioVoice] WSTransport Received: ringing {callsid: "CAxxxxxxxx"}
[Server] [Voice Webhook] Received request: {from: "client:test-user-xxx", callSid: "CAxxxxxxxx"}
[Server] [Voice Webhook] Returning TwiML: <Response><Reject reason="rejected"/></Response>
[Client] [TwilioVoice] WSTransport Received: hangup {error: {code: 31404, message: "Not Found"}}
[Client] ===== CALL ERROR EVENT =====
[Client] Error code: 31005
[Client] Error message: ConnectionError (31005): Error sent from gateway in HANGUP
[Client] Full error: {
  "message": "ConnectionError (31005): Error sent from gateway in HANGUP",
  "originalError": {
    "code": 31404,
    "message": "Not Found"
  },
  "causes": [],
  "code": 31005,
  "description": "Connection error",
  "explanation": "A connection error occurred during the call",
  "name": "ConnectionError",
  "solutions": []
}
```

`enableImprovedSignalingErrorPrecision: false`の場合、元のエラーコード(31404)は`originalError`に含まれ、表面上は汎用的な31005エラーになる。

### `<Say><Hangup>`を返した場合

`<Say><Hangup>`をTwiML App webhookから返した場合、**errorイベントは発火しない**。

```bash
WEBHOOK_MODE=say-hangup npm run dev
```

| 設定 | 実際 |
|------|------|
| `enableImprovedSignalingErrorPrecision: true` | errorイベントなし、acceptイベント発火後にdisconnectイベント発火 |

```
[Client] Connecting...
[Client] [TwilioVoice] WSTransport Received: ringing {callsid: "CAxxxxxxxx"}
[Server] [Voice Webhook] Received request: {from: "client:test-user-xxx", callSid: "CAxxxxxxxx"}
[Server] [Voice Webhook] Mode: say-hangup
[Server] [Voice Webhook] Returning TwiML: <Response><Say>This call will be terminated.</Say><Hangup/></Response>
[Client] [TwilioVoice] WSTransport Received: answer (SDP answer)
[Client] [TwilioVoice] ICE connection state: checking → connected
[Client] [TwilioVoice] PeerConnection state: connecting → connected
[Client] Call accepted                    ← acceptイベント発火、音声再生
[Client] Call disconnected                ← disconnectイベント発火（errorイベントは発火しない）
```

発信コールで正常に切断する場合は、`<Say><Hangup>`のような有効なTwiMLを使用する。

### 結論

`device.connect()`による発信コールで`<Reject>`を返した場合:

- `enableImprovedSignalingErrorPrecision: true` → **31404 (NotFound)** errorイベントが発火
- `enableImprovedSignalingErrorPrecision: false` → **31005 (ConnectionError)** errorイベントが発火（`originalError`に31404を保持）

`enableImprovedSignalingErrorPrecision`オプションを有効にすると、より詳細なエラーコードを取得できる。
