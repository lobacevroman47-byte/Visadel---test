// Webhook endpoint — kept alive but disabled.
// Reviews now come from the mini app form only.
// Approving in admin panel posts to the channel via update-review.js
export default async function handler(req, res) {
  res.status(200).end();
}
