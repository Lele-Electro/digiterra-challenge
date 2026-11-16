// Responsive, table-based HTML for the private lift club's booking emails.
// Structure follows welcome-to-matla.html (640px rows, stacked columns below 660px),
// restyled in the lift club's dark green. Every dynamic value is HTML-escaped.

const GREEN = '#1b4f43';
const GREEN_DEEP = '#123a31';
const GREEN_SOFT = '#eef3ef';
const INK = '#193d33';
const MUTED = '#52675b';
const LINE = '#d7e0d9';
const FONT = "'Plus Jakarta Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const WHATSAPP_NOTE = 'Please allow Toni to confirm the details with you on WhatsApp.';
const PRODUCTION_SITE = 'https://www.toniribeiro.com';

const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// Images are served by the production website (public/email in the frontend), never by
// a development machine. RIBEIRO_EMAIL_ASSETS_URL can point at another permanent host.
function emailUrls(env = process.env) {
  const trim = (value) => String(value).trim().replace(/\/+$/, '');
  const site = trim(env.RIBEIRO_APP_URL || PRODUCTION_SITE);
  const assets = trim(env.RIBEIRO_EMAIL_ASSETS_URL || `${PRODUCTION_SITE}/email`);
  return { site, assets };
}

// wa.me needs an international number without "+". A leading 0 is a South African number.
function whatsappLink(number) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${String(number).startsWith('+') ? digits : digits.replace(/^0/, '27')}`;
}

function directionsLink(pickup, dropoff) {
  const point = (place) => (Number.isFinite(place?.lat) && Number.isFinite(place?.lng)
    ? `${place.lat},${place.lng}` : place?.address || '');
  const params = new URLSearchParams({ api: '1', origin: point(pickup), destination: point(dropoff), travelmode: 'driving' });
  if (pickup?.placeId) params.set('origin_place_id', pickup.placeId);
  if (dropoff?.placeId) params.set('destination_place_id', dropoff.placeId);
  return `https://www.google.com/maps/dir/?${params}`;
}

const table = (attrs = '') => `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;" ${attrs}>`;

// One full-width band containing a centred 640px content table.
function row(content, { background = '#ffffff', padding = '0' } = {}) {
  return `${table(`width="100%" bgcolor="${background}" style="background-color:${background};"`)}<tr><td align="center">
${table('class="row-content" width="640" style="width:640px;max-width:640px;margin:0 auto;"')}<tr><td style="padding:${padding};">${content}</td></tr></table>
</td></tr></table>`;
}

function image({ src, alt, width, height }) {
  // The styled alt text and background keep the layout meaningful when images are blocked.
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="${width}" height="${height}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;background-color:${GREEN};color:#ffffff;font-family:${FONT};font-size:14px;line-height:20px;"/>`;
}

function button(label, href) {
  return `${table('align="center" style="margin:0 auto;"')}<tr><td align="center" bgcolor="${GREEN}" style="border-radius:999px;background-color:${GREEN};">
<a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function details(rows) {
  const cells = rows.filter(([, value]) => value != null && value !== '').map(([label, value, html]) => `<tr>
<td class="detail-label" width="170" valign="top" style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1.5px;line-height:20px;text-transform:uppercase;color:${MUTED};">${escapeHtml(label)}</td>
<td class="detail-value" valign="top" style="padding:12px 0 12px 12px;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:16px;font-weight:600;line-height:24px;color:${INK};word-break:break-word;">${html || escapeHtml(value)}</td>
</tr>`).join('');
  return `${table('width="100%"')}${cells}</table>`;
}

const paragraph = (html, style = '') => `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:26px;color:${INK};${style}">${html}</p>`;

function layout({ title, preheader, rows }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<title>${escapeHtml(title)}</title>
<meta content="text/html; charset=utf-8" http-equiv="Content-Type"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
<style>
* { box-sizing: border-box; }
body { margin: 0; padding: 0; }
a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; }
#MessageViewBody a { color: inherit; text-decoration: none; }
@media (max-width: 660px) {
  .row-content { width: 100% !important; }
  .pad-x { padding-left: 24px !important; padding-right: 24px !important; }
  .hero-title { font-size: 28px !important; line-height: 34px !important; }
  .detail-label { width: 112px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${GREEN_SOFT};-webkit-text-size-adjust:none;text-size-adjust:none;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${GREEN_SOFT};">${escapeHtml(preheader)}</div>
${table(`width="100%" bgcolor="${GREEN_SOFT}" style="background-color:${GREEN_SOFT};"`)}<tr><td>
${rows.join('\n')}
</td></tr></table>
</body>
</html>`;
}

const brandBar = () => row(
  `<div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:3px;line-height:16px;text-align:center;text-transform:uppercase;color:#ffffff;">Toni Ribeiro &nbsp;&middot;&nbsp; Private Lift Club</div>`,
  { background: GREEN_DEEP, padding: '14px 24px' },
);

const footer = ({ site, contact, reason }) => row(
  `<div class="pad-x" style="padding:0 40px;font-family:${FONT};font-size:13px;line-height:21px;text-align:center;color:#d5e3dc;">
<p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#ffffff;">Toni Ribeiro &middot; Private Lift Club</p>
<p style="margin:0 0 8px;">${escapeHtml(reason)}</p>
<p style="margin:0;"><a href="${escapeHtml(site)}/lift-club" target="_blank" style="color:#ffffff;text-decoration:underline;">Lift club schedule</a>${contact ? ` &nbsp;&middot;&nbsp; <a href="mailto:${escapeHtml(contact)}" style="color:#ffffff;text-decoration:underline;">${escapeHtml(contact)}</a>` : ''}</p>
</div>`,
  { background: GREEN_DEEP, padding: '32px 0' },
);

function journeyRows(booking) {
  return [
    ['Date', booking.date],
    ['Time', `${booking.time} SAST`],
    ['Travellers', String(booking.passengers)],
    ['Pickup', booking.pickup?.address],
    ['Drop-off', booking.dropoff?.address],
    ['WhatsApp number', booking.whatsapp],
    ['Reference', booking.reference],
  ];
}

const journeyText = (booking) => journeyRows(booking).filter(([, value]) => value)
  .map(([label, value]) => `${label}: ${value}`).join('\n');

/**
 * Confirmation to the member who booked.
 * booking: { name, date, time, passengers, whatsapp, pickup, dropoff, reference, updated }
 */
function bookingConfirmationEmail(booking, { env = process.env, contact } = {}) {
  const { site, assets } = emailUrls(env);
  const headline = booking.updated ? 'Your updated journey is reserved' : 'Your journey is reserved';
  const subject = booking.updated ? 'Your lift club booking has been updated' : 'Your lift club booking is confirmed';
  const text = `Hi ${booking.name},

${headline}. ${WHATSAPP_NOTE}

${journeyText(booking)}

Toni will be there 5 minutes early.

You can edit or cancel your reservation on the lift club page: ${site}/lift-club

Toni Ribeiro`;

  const html = layout({
    title: subject,
    preheader: `${booking.date}, ${booking.time} SAST. ${WHATSAPP_NOTE}`,
    rows: [
      brandBar(),
      row(image({ src: `${assets}/lift-club-hero.jpg`, alt: 'Toni’s red Volvo S60 crossing a bridge', width: 640, height: 360 }), { background: GREEN }),
      row(`<div class="pad-x" style="padding:0 40px;text-align:center;">
<div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:3px;line-height:16px;text-transform:uppercase;color:#bfd6cc;">${booking.updated ? 'Booking updated' : 'Booking confirmed'}</div>
<h1 class="hero-title" style="margin:12px 0 0;font-family:${FONT};font-size:34px;font-weight:800;line-height:40px;letter-spacing:-0.5px;color:#ffffff;">${escapeHtml(headline)}</h1>
</div>`, { background: GREEN, padding: '32px 0 36px' }),
      row(`<div class="pad-x" style="padding:0 40px;">
${paragraph(`Hi ${escapeHtml(booking.name)}, the whole hour is reserved for you${booking.passengers > 1 ? ` and your fellow traveller${booking.passengers > 2 ? 's' : ''}` : ''}. Toni will be there 5 minutes early in the red Volvo S60.`)}
${table('width="100%"')}<tr><td bgcolor="${GREEN_SOFT}" style="padding:16px 20px;border-left:4px solid ${GREEN};border-radius:6px;background-color:${GREEN_SOFT};font-family:${FONT};font-size:16px;font-weight:700;line-height:24px;color:${INK};">${WHATSAPP_NOTE}</td></tr></table>
</div>`, { padding: '32px 0 20px' }),
      row(`<div class="pad-x" style="padding:0 40px;">
${details(journeyRows(booking))}
</div>`, { padding: '0 0 28px' }),
      row(`<div class="pad-x" style="padding:0 40px;text-align:center;">
${button('View or change my booking', `${site}/lift-club`)}
</div>`, { padding: '0 0 36px' }),
      footer({ site, contact, reason: 'You are receiving this email because you reserved a lift club timeslot with this address.' }),
    ],
  });
  return { subject, text, html };
}

/**
 * Notification to Toni, so that the details can be confirmed with the member on WhatsApp.
 * booking additionally has { email }.
 */
function bookingNotificationEmail(booking, { env = process.env } = {}) {
  const { site } = emailUrls(env);
  const chat = whatsappLink(booking.whatsapp);
  const route = directionsLink(booking.pickup, booking.dropoff);
  const subject = `${booking.updated ? 'Updated' : 'New'} lift club booking: ${booking.date}, ${booking.time}`;
  const text = `${booking.updated ? 'A lift club booking was updated' : 'A new lift club booking was made'}.

Member: ${booking.name}
Email: ${booking.email}
${journeyText(booking)}
${chat ? `\nWhatsApp chat: ${chat}` : ''}
Directions: ${route}

Please confirm the details with ${booking.name} on WhatsApp.`;

  const rows = [
    ['Member', booking.name],
    ['Email', booking.email, `<a href="mailto:${escapeHtml(booking.email)}" style="color:${GREEN};">${escapeHtml(booking.email)}</a>`],
    ...journeyRows(booking).map((item) => (item[0] === 'WhatsApp number' && chat
      ? [item[0], item[1], `<a href="${escapeHtml(chat)}" target="_blank" style="color:${GREEN};">${escapeHtml(item[1])}</a>`]
      : item)),
  ];
  const html = layout({
    title: subject,
    preheader: `${booking.name} · ${booking.pickup?.address || ''} to ${booking.dropoff?.address || ''}`,
    rows: [
      brandBar(),
      row(`<div class="pad-x" style="padding:0 40px;">
<div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:3px;line-height:16px;text-transform:uppercase;color:#bfd6cc;">${booking.updated ? 'Booking updated' : 'New booking'}</div>
<h1 class="hero-title" style="margin:12px 0 0;font-family:${FONT};font-size:30px;font-weight:800;line-height:36px;letter-spacing:-0.5px;color:#ffffff;">${escapeHtml(booking.name)} is travelling with you</h1>
<p style="margin:12px 0 0;font-family:${FONT};font-size:16px;line-height:24px;color:#d5e3dc;">${escapeHtml(booking.date)} &middot; ${escapeHtml(booking.time)} SAST</p>
</div>`, { background: GREEN, padding: '32px 0' }),
      row(`<div class="pad-x" style="padding:0 40px;">
${paragraph(`Please confirm the details with ${escapeHtml(booking.name)} on WhatsApp. They have been told to expect your message.`, 'font-weight:700;')}
${details(rows)}
</div>`, { padding: '28px 0' }),
      row(`<div class="pad-x" style="padding:0 40px;text-align:center;">
${chat ? `${button('Message on WhatsApp', chat)}<div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>` : ''}
<a href="${escapeHtml(route)}" target="_blank" style="font-family:${FONT};font-size:15px;font-weight:700;line-height:24px;color:${GREEN};text-decoration:underline;">Open the route in Google Maps</a>
</div>`, { padding: '0 0 36px' }),
      footer({ site, reason: 'Sent automatically when a member’s booking stays unchanged for five minutes.' }),
    ],
  });
  return { subject, text, html };
}

module.exports = { WHATSAPP_NOTE, bookingConfirmationEmail, bookingNotificationEmail, emailUrls, whatsappLink, directionsLink };
