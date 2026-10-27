// Sample volunteer roles for the seeded events, keyed by event title.
// Used by seed.js (fresh data) and seedVolunteers.js (adds roles to an
// existing database without touching anything else).
module.exports = {
  'Pune JS Meetup: Node.js Performance': [
    { title: 'Registration desk', description: 'Check people in and hand out name tags.', spots: 2 },
    { title: 'AV helper', description: 'Mic runner and slides switcher during talks.', spots: 1 },
  ],
  'Sunset Acoustic Sessions': [
    { title: 'Stage crew', description: 'Help set up and pack away instruments and lights.', spots: 3 },
  ],
  'Saturday 5-a-side Football': [
    { title: 'Referee assistant', description: 'Keep time and track scores.', spots: 2 },
  ],
  'Misal Pav Trail: FC Road to Sadashiv Peth': [
    { title: 'Walk lead', description: 'Keep the group together between stops.', spots: 2 },
    { title: 'Photographer', description: 'Capture the trail for the community page.', spots: 1 },
  ],
  'Pottery Basics: Wheel Throwing': [
    { title: 'Studio assistant', description: 'Prepare clay and help clean the wheels.', spots: 1 },
  ],
  'Sinhagad Sunrise Trek': [
    { title: 'Sweep trekker', description: 'Walk at the back and make sure nobody is left behind. Some trek experience needed.', spots: 2 },
    { title: 'First-aid volunteer', description: 'Carry the kit and handle small injuries. First-aid training preferred.', spots: 1 },
  ],
  'Morning Run Club: 10K': [
    { title: 'Water station', description: 'Hand out water at the 5K mark.', spots: 4 },
  ],
  'Public Speaking Bootcamp': [
    { title: 'Timekeeper', description: 'Run the speaking clock and hold up time cards.', spots: 1 },
  ],
  'Night Market at Viman Nagar': [
    { title: 'Stall runner', description: 'Help vendors set up and keep walkways clear.', spots: 6 },
    { title: 'Info booth', description: 'Answer questions and point people to stalls.', spots: 2 },
  ],
};
