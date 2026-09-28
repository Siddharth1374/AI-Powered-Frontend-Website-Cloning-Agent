import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router } from './routes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', router);

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`AI website-cloning agent server listening on http://localhost:${port}`);
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  const keyName = provider === 'groq' ? 'GROQ_API_KEY' : 'GEMINI_API_KEY';
  console.log(`LLM provider: ${provider}`);
  if (!process.env[keyName]) {
    console.warn(`⚠️  ${keyName} is not set. Add it to server/.env and restart.`);
  }
});
