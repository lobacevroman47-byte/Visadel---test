// Vercel Serverless — grant a bonus to a user (service key, bypasses RLS)
// Also handles referral bonus automatically when type === 'payment'
// POST body: { telegram_id, type, amount, description, application_id? }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function dbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
  return r.json();
}

async function dbPatch(path, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
}

async function dbInsert(table, body) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
}

async function grantBonus(telegram_id, type, amount, description) {
  // Insert log
  await dbInsert('bonus_logs', { telegram_id, type, amount, description });

  // Get current balance
  const [user] = await dbGet(`users?telegram_id=eq.${telegram_id}&select=bonus_balance`);
  const newBalance = ((user?.bonus_balance) ?? 0) + amount;

  // Update balance
  await dbPatch(`users?telegram_id=eq.${telegram_id}`, { bonus_balance: newBalance });

  return newBalance;
}

async function alreadyGranted(telegram_id, type, application_id) {
  // Look for existing log entry with this app ID in description
  const encoded = encodeURIComponent(`%${application_id}%`);
  const rows = await dbGet(
    `bonus_logs?telegram_id=eq.${telegram_id}&type=eq.${type}&description=like.${encoded}`
  );
  return Array.isArray(rows) && rows.length > 0;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { telegram_id, type, amount, description, application_id } = req.body ?? {};
  if (!telegram_id || !type || !amount) {
    res.status(400).json({ error: 'telegram_id, type, amount required' });
    return;
  }

  try {
    // ── Deduplication ───────────────────────────────────────────────────────
    if (application_id) {
      const dup = await alreadyGranted(telegram_id, type, application_id);
      if (dup) {
        res.json({ ok: true, skipped: true });
        return;
      }
    }

    // ── Grant the main bonus ────────────────────────────────────────────────
    const newBalance = await grantBonus(telegram_id, type, amount, description);

    // ── Referral bonus when a payment is confirmed ──────────────────────────
    // Give 500₽ to whoever referred this user (once per user, first paid visa)
    if (type === 'payment' && application_id) {
      try {
        // Get user's referred_by
        const [userRow] = await dbGet(`users?telegram_id=eq.${telegram_id}&select=referred_by`);
        const referredBy = userRow?.referred_by;

        if (referredBy) {
          // Check if referrer already got bonus for this user
          const refDedupDesc = `%ref_for_${telegram_id}%`;
          const [referrerRow] = await dbGet(
            `users?referral_code=eq.${encodeURIComponent(referredBy)}&select=telegram_id,bonus_balance`
          );

          if (referrerRow) {
            const refTgId = referrerRow.telegram_id;
            const alreadyPaid = await alreadyGranted(refTgId, 'referral', `ref_for_${telegram_id}`);

            if (!alreadyPaid) {
              await grantBonus(
                refTgId,
                'referral',
                500,
                `+500₽ за визу друга (ref_for_${telegram_id})`
              );
            }
          }
        }
      } catch (refErr) {
        console.error('Referral bonus error (non-fatal):', refErr);
      }
    }

    res.json({ ok: true, newBalance });
  } catch (err) {
    console.error('grant-bonus error:', err);
    res.status(500).json({ error: String(err) });
  }
}
