const TIME_ZONE = 'Africa/Johannesburg';
const QUIET_PERIOD_MS = 5 * 60 * 1000;

function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-ZA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (name) => parts.find((item) => item.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateAfter(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Local or international numbers; the same normalisation as the account's cellphone number.
function cleanWhatsapp(raw) {
  if (typeof raw !== 'string' || raw.length > 40) return null;
  const value = raw.trim().replace(/[\s().-]/g, '');
  return /^\+?\d{7,15}$/.test(value) ? value : null;
}

// An address is always required. Google's Place ID and coordinates are optional so
// that a manually typed address still works when Maps is unavailable in the browser.
function cleanPlace(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.address !== 'string') return null;
  const address = raw.address.replace(/\s+/g, ' ').trim();
  if (address.length < 3 || address.length > 300) return null;
  const place = { address };
  if (raw.placeId != null && raw.placeId !== '') {
    if (typeof raw.placeId !== 'string' || !/^[\w-]{1,300}$/.test(raw.placeId)) return null;
    place.placeId = raw.placeId;
  }
  if (raw.lat != null || raw.lng != null) {
    if (!Number.isFinite(raw.lat) || !Number.isFinite(raw.lng) ||
        Math.abs(raw.lat) > 90 || Math.abs(raw.lng) > 180) return null;
    place.lat = raw.lat;
    place.lng = raw.lng;
  }
  return place;
}

function validateBooking(body, now = new Date()) {
  const { serviceDate, startHour, passengers } = body || {};
  if (typeof serviceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) ||
      Number.isNaN(Date.parse(`${serviceDate}T00:00:00Z`)) || dateAfter(serviceDate, 0) !== serviceDate) {
    return { error: 'Choose a valid calendar day.' };
  }
  if (serviceDate < today(now) || serviceDate > dateAfter(today(now), 6)) {
    return { error: 'Choose one of the next seven service days, including today.' };
  }
  if (!Number.isInteger(startHour) || startHour < 5 || startHour > 25) {
    return { error: 'Choose an hourly slot from 05:00 through 01:00–02:00 the following morning.' };
  }
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 3) {
    return { error: 'Choose between 1 and 3 travellers, including yourself.' };
  }
  const whatsapp = cleanWhatsapp(body.whatsapp);
  if (!whatsapp) return { error: 'Enter a valid WhatsApp number with 7–15 digits.' };
  const pickup = cleanPlace(body.pickup);
  if (!pickup) return { error: 'Enter a pickup location.' };
  const dropoff = cleanPlace(body.dropoff);
  if (!dropoff) return { error: 'Enter a drop-off location.' };
  // SAST is UTC+02:00 year-round. Hours 24 and 25 belong to the following calendar day.
  const scheduledFor = new Date(Date.parse(`${serviceDate}T00:00:00+02:00`) + startHour * 3600000);
  if (scheduledFor <= now) return { error: 'This slot has already started. Choose a future departure.' };
  return { value: { serviceDate, startHour, passengers, scheduledFor, whatsapp, pickup, dropoff } };
}

module.exports = { TIME_ZONE, QUIET_PERIOD_MS, today, dateAfter, validateBooking };
