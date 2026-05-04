// Telegram Webhook — saves channel posts from @visadel_recall to Supabase reviews table
// Env vars: TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY

const CHANNEL = '@visadel_recall';

function parseReviewPost(text) {
  if (!text) return null;
  try {
    // Count stars from emoji
    const starMatch = text.match(/⭐/g);
    const rating = starMatch ? starMatch.length : 5;

    // Extract country
    const countryMatch = text.match(/Страна:\s*[*_]?([^*_\n]+)[*_]?/);
    const country = countryMatch ? countryMatch[1].trim() : '';

    // Extract review text between quotes
    const textMatch = text.match(/"([^"]+)"/);
    const reviewText = textMatch ? textMatch[1].trim() : text.slice(0, 200).trim();

    // Extract username
    const usernameMatch = text.match(/—\s*@([^\s\n]+)/);
    const username = usernameMatch ? usernameMatch[1] : '';
    const authorName = username ? `@${username}` : 'Пользователь';

    return { rating, country, text: reviewText, username, authorName };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(200).end(); return; }

  const update = req.body;
  const post = update?.channel_post;

  // Only handle posts from our channel
  if (!post || post.chat?.username !== CHANNEL.replace('@', '')) {
    res.status(200).end();
    return;
  }

  const parsed = parseReviewPost(post.text);
  if (!parsed || !parsed.text) { res.status(200).end(); return; }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) { res.status(200).end(); return; }

  try {
    await fetch(`${supabaseUrl}/rest/v1/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({
        user_telegram_id: 0,
        application_id: `channel_${post.message_id}`,
        country: parsed.country,
        rating: parsed.rating,
        text: parsed.text,
        username: parsed.username,
        author_name: parsed.authorName,
        channel_message_id: post.message_id,
        status: 'approved',
        source: 'channel',
      }),
    });
  } catch (e) {
    console.error('Webhook save error:', e);
  }

  res.status(200).end();
}
