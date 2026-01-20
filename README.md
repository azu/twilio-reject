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

```bash
cp .env.example .env
```

`.env`ファイルを編集して、Twilioの認証情報を設定する。

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

`<Reject>`をTwiML App webhookから返した場合、**errorイベントは発火しない**。

| 設定 | 期待 | 実際 |
|------|------|------|
| `enableImprovedSignalingErrorPrecision: true` | 31002 (ConnectionDeclinedError) | errorイベントなし、disconnectイベント発火 |
| `enableImprovedSignalingErrorPrecision: false` | 31005 (ConnectionError) | errorイベントなし、disconnectイベント発火 |

### 理由

`device.connect()`による発信コールでは、以下の順序で処理される:

1. WebRTC接続が確立される
2. Twilioメディアサーバーとの接続が確立される（`accept`イベント発火）
3. TwiML App webhookが呼ばれる
4. `<Reject>`が返される → 切断として処理される（`disconnect`イベント発火）

`<Reject>`は着信コール（incoming call）を応答前に拒否するためのTwiML。発信コール（outgoing call）では既にメディア接続が確立された後にTwiMLが処理されるため、「拒否」ではなく「切断」として扱われる。

### 時系列ログ

クライアントとバックエンドのログを時系列で整理。

```
[Client] Starting application...
[Client] Initializing device (enableImprovedSignalingErrorPrecision: true)
[Client] Token received for identity: test-user-xxx
[Client] Device registered
[Client] Connecting...
[Client] [TwilioVoice] .connect {}
[Client] [TwilioVoice] WSTransport Sending: invite (SDP offer)
[Client] [TwilioVoice] WSTransport Received: ringing {callsid: "CAxxxxxxxx"}
[Server] [Voice Webhook] Received request: {from: "client:test-user-xxx", callSid: "CAxxxxxxxx"}
[Server] [Voice Webhook] Returning TwiML: <Response><Reject reason="rejected"/></Response>
[Client] [TwilioVoice] WSTransport Received: answer (SDP answer)
[Client] [TwilioVoice] ICE connection state: checking → connected
[Client] [TwilioVoice] DTLS transport state: new → connecting → connected
[Client] [TwilioVoice] PeerConnection state: connecting → connected
[Client] [TwilioVoice] Media connection established
[Client] Call accepted                    ← acceptイベント発火
[Client] Call disconnected                ← disconnectイベント発火（errorイベントは発火しない）
```

ポイント:
- `ringing` → `answer` → メディア接続確立 → `accept`イベントの順で処理
- TwiML webhookは`ringing`の後に呼ばれるが、`<Reject>`の結果はメディア接続確立後に反映される
- `<Reject>`は`error`ではなく`disconnect`として処理される

### HTTP 500エラーを返した場合

webhookでHTTP 500エラーを返した場合も、**errorイベントは発火しない**。

```bash
WEBHOOK_MODE=http-error npm run dev
```

| 設定 | 実際 |
|------|------|
| `enableImprovedSignalingErrorPrecision: true` | errorイベントなし、acceptイベント発火 |

webhookがHTTPエラーを返しても、Twilioメディアサーバーとの接続は確立される。webhookの結果はメディア接続の確立に影響しない。

### 結論

`device.connect()`による発信コールでは、以下の理由でerrorイベントを発火させることが難しい:

1. メディア接続はwebhookの処理結果に依存せず確立される
2. `<Reject>`は着信コール用のTwiMLであり、発信コールでは切断として扱われる
3. webhookのHTTPエラーもメディア接続には影響しない

errorイベント（31002, 31005）を検証するには、別のシナリオ（無効なトークン、ネットワークエラーなど）が必要と考えられる。
