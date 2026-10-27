// npm run seed — wipes all app data and loads sample users, venues and events.
// Event dates are relative to today, so re-run it whenever the dates go stale.
// Refuses to run when NODE_ENV=production.
const bcrypt = require('bcrypt');
const env = require('../config/env');
const pool = require('./pool');
const VOLUNTEER_ROLES = require('./volunteerSeedData');

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

// .test is a reserved TLD, so these can never be real inboxes.
const USERS = [
  { key: 'org1', name: 'Ananya Kulkarni', email: 'organizer1@punebuzz.test', password: 'Organizer1!pass', role: 'organizer' },
  { key: 'org2', name: 'Rohan Deshpande', email: 'organizer2@punebuzz.test', password: 'Organizer2!pass', role: 'organizer' },
  { key: 'user', name: 'Sneha Patil', email: 'user@punebuzz.test', password: 'User1!password', role: 'user' },
];

// Generic venue names in real Pune areas; coordinates are approximate area centres.
const VENUES = [
  { key: 'kp', name: 'Lane 7 Courtyard', area: 'Koregaon Park', address: 'Lane 7, North Main Road, Koregaon Park, Pune 411001', lat: 18.5362, lng: 73.894 },
  { key: 'baner', name: 'Baner Hill Co-working Hub', area: 'Baner', address: 'Baner Road, near Baner Hill, Pune 411045', lat: 18.559, lng: 73.7868 },
  { key: 'kothrud', name: 'Kothrud Community Auditorium', area: 'Kothrud', address: 'Karve Road, Kothrud, Pune 411038', lat: 18.5074, lng: 73.8077 },
  { key: 'viman', name: 'Skyline Rooftop', area: 'Viman Nagar', address: 'Nagar Road, Viman Nagar, Pune 411014', lat: 18.5679, lng: 73.9143 },
  { key: 'hinjewadi', name: 'Phase 1 Tech Park Hall', area: 'Hinjewadi', address: 'Rajiv Gandhi Infotech Park, Phase 1, Hinjewadi, Pune 411057', lat: 18.5913, lng: 73.7389 },
  { key: 'fc', name: 'FC Road Book Café', area: 'FC Road', address: 'Fergusson College Road, Shivajinagar, Pune 411004', lat: 18.5246, lng: 73.8411 },
  { key: 'aundh', name: 'Aundh Sports Ground', area: 'Aundh', address: 'ITI Road, Aundh, Pune 411007', lat: 18.558, lng: 73.8075 },
  { key: 'kalyani', name: 'Riverside Studio', area: 'Kalyani Nagar', address: 'Kalyani Nagar, Pune 411006', lat: 18.5463, lng: 73.9033 },
  { key: 'camp', name: 'MG Road Heritage Hall', area: 'Camp', address: 'Mahatma Gandhi Road, Camp, Pune 411001', lat: 18.5158, lng: 73.878 },
  { key: 'wakad', name: 'Wakad Turf Arena', area: 'Wakad', address: 'Datta Mandir Road, Wakad, Pune 411057', lat: 18.5975, lng: 73.77 },
];

// day = days from today, at local Pune time (IST); hours = duration.
// Capacity 2–3 events are marked "small" so the waitlist is easy to hit.
const EVENTS = [
  // tech
  { title: 'Pune JS Meetup: Node.js Performance', category: 'tech', venue: 'baner', org: 'org1', day: 2, time: '18:30', hours: 2.5, capacity: 80, price: 0 },
  { title: 'Intro to PostgreSQL Transactions', category: 'tech', venue: 'hinjewadi', org: 'org1', day: 6, time: '19:00', hours: 2, capacity: 3, price: 0, small: true },
  { title: 'React Pune: Server Components Deep Dive', category: 'tech', venue: 'baner', org: 'org2', day: 13, time: '11:00', hours: 3, capacity: 120, price: 0 },
  { title: 'Startup Pitch Night', category: 'tech', venue: 'kp', org: 'org2', day: 20, time: '18:00', hours: 3, capacity: 60, price: 299 },
  { title: 'Hinjewadi DevOps Breakfast', category: 'tech', venue: 'hinjewadi', org: 'org1', day: 27, time: '08:30', hours: 1.5, capacity: 40, price: 199 },
  { title: 'Build an LLM App in a Day', category: 'tech', venue: 'viman', org: 'org2', day: 41, time: '10:00', hours: 7, capacity: 50, price: 1499 },
  // music
  { title: 'Sunset Acoustic Sessions', category: 'music', venue: 'viman', org: 'org2', day: 3, time: '18:00', hours: 3, capacity: 150, price: 499 },
  { title: 'Indie Night at Lane 7', category: 'music', venue: 'kp', org: 'org1', day: 9, time: '20:00', hours: 3, capacity: 200, price: 699 },
  { title: 'Hindustani Classical Baithak', category: 'music', venue: 'kothrud', org: 'org2', day: 16, time: '18:30', hours: 3, capacity: 2, price: 0, small: true },
  { title: 'Open Mic: Original Songs Only', category: 'music', venue: 'fc', org: 'org1', day: 23, time: '19:30', hours: 2.5, capacity: 45, price: 0 },
  { title: 'Jazz on the River', category: 'music', venue: 'kalyani', org: 'org2', day: 37, time: '19:00', hours: 3, capacity: 90, price: 899 },
  { title: 'Marathi Folk Fusion Evening', category: 'music', venue: 'camp', org: 'org1', day: 52, time: '18:00', hours: 3, capacity: 250, price: 349 },
  // sports
  { title: 'Saturday 5-a-side Football', category: 'sports', venue: 'wakad', org: 'org1', day: 4, time: '07:00', hours: 2, capacity: 20, price: 150 },
  { title: 'Sinhagad Sunrise Trek', category: 'sports', venue: 'kothrud', org: 'org2', day: 11, time: '05:00', hours: 6, capacity: 30, price: 600 },
  { title: 'Morning Run Club: 10K', category: 'sports', venue: 'aundh', org: 'org1', day: 18, time: '06:00', hours: 1.5, capacity: 100, price: 0 },
  { title: 'Doubles Badminton Mixer', category: 'sports', venue: 'aundh', org: 'org2', day: 25, time: '17:30', hours: 2, capacity: 3, price: 200, small: true },
  { title: 'Box Cricket League: Round 1', category: 'sports', venue: 'wakad', org: 'org1', day: 34, time: '16:00', hours: 4, capacity: 48, price: 250 },
  { title: 'Yoga in the Park', category: 'sports', venue: 'kp', org: 'org2', day: 48, time: '06:30', hours: 1, capacity: 35, price: 0 },
  // food
  { title: 'Misal Pav Trail: FC Road to Sadashiv Peth', category: 'food', venue: 'fc', org: 'org1', day: 5, time: '09:00', hours: 3, capacity: 15, price: 450 },
  { title: 'Home Chef Pop-up Brunch', category: 'food', venue: 'kalyani', org: 'org2', day: 12, time: '11:30', hours: 2.5, capacity: 2, price: 1200, small: true },
  { title: 'Camp Street Food Walk', category: 'food', venue: 'camp', org: 'org1', day: 19, time: '18:00', hours: 3, capacity: 25, price: 550 },
  { title: 'Craft Coffee Cupping', category: 'food', venue: 'baner', org: 'org2', day: 30, time: '10:00', hours: 2, capacity: 12, price: 400 },
  { title: 'Maharashtrian Thali Cook-along', category: 'food', venue: 'kothrud', org: 'org1', day: 44, time: '16:00', hours: 3, capacity: 20, price: 900 },
  { title: 'Night Market at Viman Nagar', category: 'food', venue: 'viman', org: 'org2', day: 57, time: '18:00', hours: 5, capacity: 500, price: 0 },
  // workshop
  { title: 'Pottery Basics: Wheel Throwing', category: 'workshop', venue: 'kalyani', org: 'org1', day: 7, time: '15:00', hours: 3, capacity: 10, price: 1800 },
  { title: 'Watercolour Sketching on FC Road', category: 'workshop', venue: 'fc', org: 'org2', day: 14, time: '08:00', hours: 3, capacity: 18, price: 750 },
  { title: 'Public Speaking Bootcamp', category: 'workshop', venue: 'camp', org: 'org1', day: 22, time: '10:00', hours: 4, capacity: 30, price: 999 },
  { title: 'Personal Finance 101', category: 'workshop', venue: 'hinjewadi', org: 'org2', day: 29, time: '18:30', hours: 2, capacity: 60, price: 0 },
  { title: 'Photography Walk: Old Pune', category: 'workshop', venue: 'camp', org: 'org1', day: 39, time: '07:00', hours: 3, capacity: 3, price: 500, small: true },
  { title: 'Calligraphy for Beginners', category: 'workshop', venue: 'aundh', org: 'org2', day: 55, time: '11:00', hours: 3, capacity: 16, price: 650 },
];

const DESCRIPTIONS = {
  tech: 'Talks, demos and networking with developers from across Pune. Bring a laptop if you want to follow along.',
  music: 'Live performances in an intimate setting. Doors open 30 minutes before the start time.',
  sports: 'All skill levels welcome. Wear comfortable shoes and bring a water bottle.',
  food: 'A guided tasting experience. Let the organizer know about any dietary restrictions when you arrive.',
  workshop: 'Hands-on session with all materials provided. Small group so everyone gets attention.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IST_OFFSET_MINUTES = 5 * 60 + 30;

// Today's calendar date in Pune, independent of the machine's time zone.
function todayInPune() {
  const nowIst = new Date(Date.now() + IST_OFFSET_MINUTES * 60_000);
  return { y: nowIst.getUTCFullYear(), m: nowIst.getUTCMonth(), d: nowIst.getUTCDate() };
}

// A Date for "day N from today at HH:MM Pune time".
function puneDate(dayOffset, time) {
  const { y, m, d } = todayInPune();
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m, d + dayOffset, hh, mm) - IST_OFFSET_MINUTES * 60_000);
}

// INSERT ... VALUES ($1,$2),($3,$4) ... RETURNING id, keeping parameters.
async function insertMany(client, table, columns, rows) {
  const values = [];
  const tuples = rows.map((row) => {
    const placeholders = row.map((v) => {
      values.push(v);
      return `$${values.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  const { rows: inserted } = await client.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')} RETURNING id`,
    values
  );
  return inserted.map((r) => r.id);
}

function formatPune(date) {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production');
  }

  const hashes = await Promise.all(USERS.map((u) => bcrypt.hash(u.password, env.BCRYPT_ROUNDS)));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE volunteer_applications, volunteer_roles, rsvps, waitlist, events, venues, users RESTART IDENTITY CASCADE');

    const userIds = await insertMany(
      client,
      'users',
      ['name', 'email', 'password_hash', 'role'],
      USERS.map((u, i) => [u.name, u.email, hashes[i], u.role])
    );
    const userIdByKey = Object.fromEntries(USERS.map((u, i) => [u.key, userIds[i]]));

    const venueIds = await insertMany(
      client,
      'venues',
      ['name', 'area', 'address', 'lat', 'lng'],
      VENUES.map((v) => [v.name, v.area, v.address, v.lat, v.lng])
    );
    const venueIdByKey = Object.fromEntries(VENUES.map((v, i) => [v.key, venueIds[i]]));

    const eventIds = await insertMany(
      client,
      'events',
      ['organizer_id', 'venue_id', 'title', 'description', 'category', 'starts_at', 'ends_at', 'capacity', 'price'],
      EVENTS.map((e) => {
        const startsAt = puneDate(e.day, e.time);
        const endsAt = new Date(startsAt.getTime() + e.hours * 3_600_000);
        return [
          userIdByKey[e.org], venueIdByKey[e.venue], e.title, DESCRIPTIONS[e.category],
          e.category, startsAt, endsAt, e.capacity, e.price,
        ];
      })
    );

    const eventIdByTitle = Object.fromEntries(EVENTS.map((e, i) => [e.title, eventIds[i]]));
    const roleRows = Object.entries(VOLUNTEER_ROLES).flatMap(([title, roles]) =>
      roles.map((r) => [eventIdByTitle[title], r.title, r.description, r.spots])
    );
    await insertMany(client, 'volunteer_roles', ['event_id', 'title', 'description', 'spots'], roleRows);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  printSummary();
}

function printSummary() {
  const byCategory = EVENTS.reduce((acc, e) => ({ ...acc, [e.category]: (acc[e.category] || 0) + 1 }), {});
  const lastDay = Math.max(...EVENTS.map((e) => e.day));
  const roleCount = Object.values(VOLUNTEER_ROLES).flat().length;

  console.log(`Seeded ${USERS.length} users, ${VENUES.length} venues, ${EVENTS.length} events (next ${lastDay} days), ${roleCount} volunteer roles.`);
  console.log(`Events by category: ${Object.entries(byCategory).map(([c, n]) => `${c} ${n}`).join(', ')}`);

  console.log('\nTest accounts (local dev only):');
  console.table(USERS.map(({ role, email, password }) => ({ role, email, password })));

  console.log('Small events for testing the waitlist:');
  console.table(
    EVENTS.filter((e) => e.small).map((e) => ({
      title: e.title,
      capacity: e.capacity,
      starts: formatPune(puneDate(e.day, e.time)),
    }))
  );
}

seed()
  .catch((err) => {
    if (err.code === '42P01') {
      console.error('Seed failed: tables are missing. Run `npm run migrate` first.');
    } else {
      // Connection failures are AggregateErrors with an empty message.
      const reason = err.message || err.errors?.map((e) => e.message).join('; ') || err.code;
      console.error(`Seed failed: ${reason}`);
    }
    process.exitCode = 1;
  })
  .finally(() => pool.end());
