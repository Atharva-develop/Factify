# Factify — Secure Backend Setup

Your API keys now live **only on the server**. The browser never sees them.

---

## 📁 File Structure

```
factify-backend/
├── server.js        ← Express proxy server
├── package.json
├── .env             ← YOUR KEYS (never commit this)
├── .env.example     ← Safe template to share
├── .gitignore
└── index.html       ← Updated frontend (copy to your site root)
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd factify-backend
npm install
```

### 2. Create your .env file
```bash
cp .env.example .env
```
Open `.env` and paste your three Gemini API keys:
```
GEMINI_KEY_1=AIzaSy...
GEMINI_KEY_2=AIzaSy...
GEMINI_KEY_3=AIzaSy...
PORT=3001
```

### 3. Start the server
```bash
npm start
# or for auto-reload during development:
npm run dev
```

### 4. Copy index.html to your site
Place `index.html` (and your `news.html`) wherever you serve your frontend.
The `BACKEND_URL` in index.html is set to `http://localhost:3001` by default.

---

## 🌐 Deploying to Production

Popular free/cheap options:

| Platform   | Command                    | Notes                        |
|------------|----------------------------|------------------------------|
| Railway    | Connect GitHub repo        | Set env vars in dashboard    |
| Render     | Connect GitHub repo        | Free tier available          |
| Fly.io     | `fly launch`               | Great for Node apps          |
| VPS/Ubuntu | `pm2 start server.js`      | Use nginx as reverse proxy   |

After deploying, update this line in `index.html`:
```js
const BACKEND_URL = "https://your-backend-domain.com";
```

---

## 🔑 API Key Rotation

The backend uses **round-robin rotation** across all 3 keys:
- Key 1 → Key 2 → Key 3 → Key 1 → ...
- If a key hits a 429 (rate limit), it automatically tries the next key
- All 3 failing triggers a 503 response with a clear error message

---

## 📡 API Endpoints

| Method | Path            | Body              | Description              |
|--------|-----------------|-------------------|--------------------------|
| GET    | `/health`       | —                 | Server status check      |
| POST   | `/api/analyze`  | `{ text: "..." }` | Fake news detection      |
| POST   | `/api/livefeed` | `{ query: "..." }`| News feed generation     |

---

## 🔒 Security Notes

- `.env` is in `.gitignore` — never commit it
- In production, restrict CORS in `server.js` to your domain:
  ```js
  app.use(cors({ origin: "https://yoursite.com" }));
  ```
- Consider adding rate limiting (e.g. `express-rate-limit`) to prevent abuse
