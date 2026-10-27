// Single source of truth for everything the site says about the academy.
// Both the React client and the API server import this file, so editing a
// program name or a timing here updates the page and the enquiry form validation.

export const academy = {
  name: 'Vision Football Academy',
  shortName: 'Vision FA',
  city: 'Surat',
  phone: {
    display: '+91 90335 13330',
    tel: '+919033513330',
    whatsapp: '919033513330',
  },
  address: {
    venue: 'Boghara School Ground',
    lines: ['L.H. Boghara School Ground, TGB', 'Adajan Gam, Adajan'],
    city: 'Surat',
    region: 'Gujarat',
    postcode: '395009',
    country: 'IN',
    full: 'Boghara School Ground, L.H, TGB, Adajan Gam, Adajan, Surat, Gujarat 395009',
  },
  maps: {
    directions:
      'https://www.google.com/maps/search/?api=1&query=Vision+Football+Academy+Boghara+School+Ground+Adajan+Surat',
    embed:
      'https://www.google.com/maps?q=Boghara+School+Ground,+Adajan+Gam,+Adajan,+Surat,+Gujarat+395009&output=embed',
  },
  timezone: 'Asia/Kolkata',
  // 0 = Sunday … 6 = Saturday. Times are 24h local (IST).
  schedule: [
    { day: 'Monday', dow: 1, open: '18:00', close: '21:00' },
    { day: 'Tuesday', dow: 2, open: '18:00', close: '21:00' },
    { day: 'Wednesday', dow: 3, open: '18:00', close: '21:00' },
    { day: 'Thursday', dow: 4, open: '18:00', close: '21:00' },
    { day: 'Friday', dow: 5, open: '18:00', close: '21:00' },
    { day: 'Saturday', dow: 6, open: null, close: null },
    { day: 'Sunday', dow: 0, open: null, close: null },
  ],
  weekendNote: 'Kept free for regional tournaments, league fixtures and recovery.',
  facility:
    'An outdoor turf layout at Boghara School Ground, set up for high-tempo match training, spatial drills and fitness testing.',
  ratings: [
    { source: 'Google', score: 5.0, count: 53, countLabel: '53+ reviews' },
    { source: 'Justdial', score: 5.0, count: null, countLabel: 'Local family and player reviews' },
  ],
  // `verbatim: true` renders with quotation marks; paraphrased themes render as plain statements.
  reviewThemes: [
    {
      text: 'Humble yet deeply structured style of coaching',
      verbatim: true,
      note: 'The phrase reviewers keep coming back to',
    },
    {
      text: 'Coaches put real work into every player’s confidence, not just the advanced ones.',
      verbatim: false,
      note: 'A theme repeated across parent reviews',
    },
  ],
  philosophy: {
    name: 'Cerebral Player Development',
    summary:
      'Instead of rigid drills where players only follow instructions, sessions are built around guided self-discovery. Coaches set the problem. Players work out the answer.',
    objective:
      'Players learn to read the game, make their own quick decisions on the pitch, and think ahead of the ball instead of waiting for instructions from the sideline.',
    quadrants: [
      {
        key: 'technical',
        name: 'Technical',
        title: 'Footwork and ball skills',
        body: 'First touch, passing on both feet, dribbling in tight spaces and striking technique.',
      },
      {
        key: 'physical',
        name: 'Physical',
        title: 'Match conditioning',
        body: 'Speed, agility and the stamina to stay sharp in the last ten minutes of a match.',
      },
      {
        key: 'tactical',
        name: 'Tactical',
        title: 'Game awareness',
        body: 'Scanning, positioning and choosing the right option before the ball arrives.',
      },
      {
        key: 'mental',
        name: 'Mental',
        title: 'Resilience under pressure',
        body: 'Staying composed after a mistake and playing with confidence when the match is tight.',
      },
    ],
  },
  programs: [
    {
      id: 'recreational',
      name: 'Recreational Program',
      for: 'Younger children and beginners',
      format: 'Group sessions',
      summary:
        'A pressure-free start to the game. Players learn basic ball control, build fitness and get used to playing as part of a team.',
      focus: ['Basic ball control', 'Cardiovascular fitness', 'Teamwork and enjoyment'],
    },
    {
      id: 'academy',
      name: 'Academy Training Squads',
      for: 'Committed players ready to compete',
      format: 'Structured squad training',
      summary:
        'The competitive tier. Squads work on tactical shape, attacking and defensive transitions, and preparing for competitive football.',
      focus: ['Team formations', 'Attack-to-defence transitions', 'Preparation for trials and leagues'],
    },
    {
      id: 'personal',
      name: '1-on-1 Personal Training',
      for: 'Players working on specific weaknesses',
      format: 'Individual sessions',
      summary:
        'Sessions built around one player. The coach targets whatever is holding them back and tracks progress week by week.',
      focus: ['Weak-foot accuracy', 'Body position when receiving', 'Acceleration with the ball'],
    },
    {
      id: 'goalkeeping',
      name: 'Goalkeeping Program',
      for: 'Goalkeepers of every level',
      format: 'Specialist sessions',
      summary:
        'Dedicated keeper training away from outfield drills, covering everything from handling to starting attacks.',
      focus: ['Handling and reflexes', 'Positioning and narrowing angles', 'Distribution under pressure'],
    },
    {
      id: 'international',
      name: 'International Immersion',
      for: 'Standout academy players',
      format: 'Selection-based pathway',
      summary:
        'For the academy’s top talents: a chance to experience overseas training methods and test themselves against international competition.',
      focus: ['Overseas training methods', 'International match exposure', 'Selection from academy squads'],
    },
  ],
  pathway: [
    { title: 'Training ground', body: 'Weekday sessions at Boghara School Ground build the foundations.' },
    { title: 'Match time', body: 'Academy squad players get regular, high-stakes game time to build confidence.' },
    { title: 'District trials', body: 'Registered players are put forward for official district selection trials.' },
    { title: 'Youth cups and leagues', body: 'Squads compete in corporate youth cups and regional league fixtures.' },
    { title: 'State scouts', body: 'Consistent match performances put players in front of state-level scouts.' },
  ],
}

// Why families choose the academy. Each point restates facts from above (the method, the four
// areas, the pathway, the programs, the review themes); nothing here is new information.
academy.reasons = [
  {
    title: 'Players who think for themselves',
    body: 'Coaches set the problem and players work out the answer, so they learn to read the game instead of waiting for a shout from the sideline.',
  },
  {
    title: 'A complete footballer, every session',
    body: 'Every session works on all four areas: technique, match conditioning, game awareness and resilience under pressure.',
  },
  {
    title: 'Real matches, in front of scouts',
    body: 'Registered players go forward for district selection trials, corporate youth cups and regional leagues, where consistent performances reach state-level scouts.',
  },
  {
    title: 'A next step for every level',
    body: 'From a pressure-free first kickabout to squad football, 1-on-1 sessions and specialist goalkeeping.',
  },
  {
    title: 'Confidence for every player',
    body: 'The theme parents’ reviews keep coming back to: coaches put real work into every player, not just the advanced ones.',
  },
  {
    title: 'A pathway beyond Surat',
    body: 'The academy’s top talents can be selected for International Immersion: overseas training methods and international competition.',
  },
]

// Questions parents ask before joining. Answers only use facts stated elsewhere in this file;
// anything not confirmed (fees, exact age groups) points people to the phone instead.
academy.faq = [
  {
    q: 'When and where is training?',
    a: `Monday to Friday, 6 PM to 9 PM, on the outdoor turf at ${academy.address.venue}, Adajan, Surat. There are no sessions at weekends, which are kept free for tournaments, league fixtures and recovery.`,
  },
  {
    q: 'What makes the coaching different?',
    a: `${academy.philosophy.name}. Instead of rigid drills where players only follow instructions, coaches set problems for players to solve, so they learn to read the game, make quick decisions and think ahead of the ball. Every session also covers technique, match conditioning, game awareness and resilience under pressure.`,
  },
  {
    q: 'My child has never played properly. Is that OK?',
    a: 'Yes. The Recreational Program is a pressure-free start that covers basic ball control, fitness and teamwork. Parents’ reviews say the coaches build confidence in every player, not just the advanced ones.',
  },
  {
    q: 'Which program should we choose?',
    a: 'Beginners and younger children usually start in the Recreational Program. Players ready to compete join the Academy Training Squads. 1-on-1 Personal Training targets a specific weakness, and keepers have their own Goalkeeping Program. International Immersion is by selection from the academy squads. If you’re unsure, send an enquiry and the academy will help you decide.',
  },
  {
    q: 'Will my child play real matches?',
    a: 'Match exposure is how the academy measures success. Academy squad players get regular game time, and registered players are put forward for district trials, corporate youth cups and regional leagues, where state scouts watch.',
  },
  {
    q: 'What does a session work on?',
    a: 'Every session covers four areas: technical footwork and ball skills, match conditioning, tactical awareness, and mental resilience under pressure. Coaches set problems for players to solve, so they learn to read the game and decide for themselves.',
  },
  {
    q: 'How do we join, and what are the fees?',
    a: `Book a visit with the form on this page, or call or WhatsApp ${academy.phone.display}. The academy will talk you through programs and fees and arrange a visit to the ground.`,
  },
]

export const programIds = academy.programs.map((p) => p.id)

export const experienceLevels = [
  { id: 'new', label: 'New to football' },
  { id: 'casual', label: 'Plays for fun or at school' },
  { id: 'club', label: 'Has played in a team or club' },
  { id: 'competitive', label: 'Plays competitively' },
]
