const pool = require('../db/pool');

const VENUE_COLUMNS = 'id, name, area, address, lat, lng';

function toVenue(row) {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    address: row.address,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
  };
}

// Unpaginated: the list is small and feeds the create-event venue picker.
async function listVenues() {
  const { rows } = await pool.query(`SELECT ${VENUE_COLUMNS} FROM venues ORDER BY area, name, id`);
  return rows.map(toVenue);
}

async function createVenue({ name, area, address = null, lat = null, lng = null }) {
  const { rows } = await pool.query(
    `INSERT INTO venues (name, area, address, lat, lng)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${VENUE_COLUMNS}`,
    [name, area, address, lat, lng]
  );
  return toVenue(rows[0]);
}

module.exports = { listVenues, createVenue };
