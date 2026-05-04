// Telegram Webhook — syncs @visadel_recall channel posts/deletions with Supabase
// Env vars: TELEGRAM_BOT_TOKEN, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

const CHANNEL = 'visadel_recall';

// Gender detection from Russian first name
function getAvatar(name) {
  if (!name) return '🧑';
  const first = name.trim().split(/\s+/)[0].toLowerCase();
  // Female Russian names typically end in а, я, ь, ия, ья
  if (/[аяь]$/i.test(first)) return '👩';
  return '👨';
}

// Extract display name from text (— @username or — Имя)
function parseAuthor(text) {
  const match = text.match(/—\s*(.+)$/m);
  if (!match) return { displayName: 'Клиент', avatar: '🧑' };
  const raw = match[1].trim().replace(/^@/, '');
  // If it looks like a username (no spaces, latin/cyrillic mixed), show generic
  const isUsername = /^[a-zA-Z0-9_]+$/.test(raw);
  if (isUsername) return { displayName: 'Клиент', avatar: '🧑' };
  const avatar = getAvatar(raw);
  return { displayName: raw, avatar };
}

function parseReviewPost(text) {
  if (!text) return null;
  try {
    const starMatch = text.match(/⭐/g);
    const rating = starMatch ? Math.min(starMatch.length, 5) : 5;

    const countryMatch = text.match(/Страна:\s*[*_\\]*([\p{L}\s\-]+)[*_\\]*/u);
    const country = countryMatch ? countryMatch[1].trim() : '';

    const textMatch = text.match(/"([^"]+)"/);
    const reviewText = textMatch ? textMatch[1].trim() : '';
    if (!reviewText) return null;

    const { displayName, avatar } = parseAuthor(text);

    return { rating, country, text: reviewText, displayName, avatar };
  } catch {
    return null;
  }
}

async function supabaseFetch(url, key, method, path, body) {
  return fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': method === 'POST' ? 'resolution=ignore-duplicates' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(200).end(); return; }

  const update = req.body;
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) { res.status(200).end(); return; }

  // ── Handle deleted messages ──────────────────────────────────────────────────
  const deleted = update?.deleted_messages ?? update?.channel_post_deleted;
  if (deleted) {
    const ids = Array.isArray(deleted.message_ids) ? deleted.message_ids
      : deleted.message_id ? [deleted.message_id] : [];
    for (const msgId of ids) {
      await supabaseFetch(supabaseUrl, supabaseKey, 'DELETE',
        `reviews?channel_message_id=eq.${msgId}`, null);
    }
    res.status(200).end();
    return;
  }

  // ── Handle new channel post ──────────────────────────────────────────────────
  const post = update?.channel_post;
  if (!post || post.chat?.username !== CHANNEL) {
    res.status(200).end();
    return;
  }

  // Handle edited posts — delete old, re-insert
  if (update?.edited_channel_post) {
    await supabaseFetch(supabaseUrl, supabaseKey, 'DELETE',
      `reviews?channel_message_id=eq.${post.message_id}`, null);
  }

  const parsed = parseReviewPost(post.text);
  if (!parsed) { res.status(200).end(); return; }

  await supabaseFetch(supabaseUrl, supabaseKey, 'POST', 'reviews', {
    country: parsed.country || 'Не указана',
    rating: parsed.rating,
    text: parsed.text,
    author_name: parsed.displayName,
    avatar: parsed.avatar,
    channel_message_id: post.message_id,
    status: 'pending',
    source: 'channel',
  });

  res.status(200).end();
}
