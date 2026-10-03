// Daily scripture + daily quote, picked to match what you're working on.
// Each entry is tagged with topics; topics are inferred from your habit and
// goal names, and the day decides which topic leads.
//
// Hyrum W. Smith lines are the Natural Laws from "The 10 Natural Laws of
// Successful Time and Life Management" (verified against Franklin Planner's
// site) and his book titles.

// faith | fitness | music | planning | rest | growth (general)
export const SCRIPTURES = [
  ['Men are, that they might have joy.', '2 Nephi 2:25', ['faith', 'growth']],
  ['I can do all things through Christ which strengtheneth me.', 'Philippians 4:13', ['faith', 'fitness', 'growth']],
  ['Be still, and know that I am God.', 'Psalm 46:10', ['faith', 'rest']],
  ['By small and simple things are great things brought to pass.', 'Alma 37:6', ['growth', 'faith', 'music']],
  ['Let us run with patience the race that is set before us.', 'Hebrews 12:1', ['fitness', 'growth']],
  ['This is the day which the LORD hath made; we will rejoice and be glad in it.', 'Psalm 118:24', ['faith']],
  ['Trust in the LORD with all thine heart; and lean not unto thine own understanding.', 'Proverbs 3:5', ['faith']],
  [
    'Be not weary in well-doing, for ye are laying the foundation of a great work. And out of small things proceedeth that which is great.',
    'D&C 64:33',
    ['growth', 'faith'],
  ],
  ['Organize yourselves; prepare every needful thing.', 'D&C 88:119', ['planning']],
  [
    'Retire to thy bed early, that ye may not be weary; arise early, that your bodies and your minds may be invigorated.',
    'D&C 88:124',
    ['rest'],
  ],
  [
    'Know ye not that ye are the temple of God, and that the Spirit of God dwelleth in you?',
    '1 Corinthians 3:16',
    ['fitness', 'rest', 'faith'],
  ],
  [
    'They that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.',
    'Isaiah 40:31',
    ['fitness', 'faith'],
  ],
  [
    'Feast upon the words of Christ; for behold, the words of Christ will tell you all things what ye should do.',
    '2 Nephi 32:3',
    ['faith'],
  ],
  ['Pray always, that you may come off conqueror.', 'D&C 10:5', ['faith']],
  ['Look unto me in every thought; doubt not, fear not.', 'D&C 6:36', ['faith']],
  ['Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.', 'Matthew 7:7', ['faith', 'growth']],
  ['I will go and do the things which the Lord hath commanded.', '1 Nephi 3:7', ['faith', 'growth']],
  ['Make a joyful noise unto the LORD, all ye lands.', 'Psalm 100:1', ['music', 'faith']],
  ['My soul delighteth in the song of the heart; yea, the song of the righteous is a prayer unto me.', 'D&C 25:12', ['music', 'faith']],
  ['And Jesus increased in wisdom and stature, and in favour with God and man.', 'Luke 2:52', ['growth', 'fitness', 'faith']],
  ['Whatsoever ye do, do it heartily, as to the Lord, and not unto men.', 'Colossians 3:23', ['growth', 'fitness', 'music']],
  ['When ye are in the service of your fellow beings ye are only in the service of your God.', 'Mosiah 2:17', ['faith']],
  ['Ye shall seek me, and find me, when ye shall search for me with all your heart.', 'Jeremiah 29:13', ['faith']],
  ['Come unto me, all ye that labour and are heavy laden, and I will give you rest.', 'Matthew 11:28', ['rest', 'faith']],
  [
    'See that all these things are done in wisdom and order; for it is not requisite that a man should run faster than he has strength.',
    'Mosiah 4:27',
    ['planning', 'rest'],
  ],
  [
    'Let virtue garnish thy thoughts unceasingly; then shall thy confidence wax strong in the presence of God.',
    'D&C 121:45',
    ['faith', 'growth'],
  ],
  ['In the morning sow thy seed, and in the evening withhold not thine hand.', 'Ecclesiastes 11:6', ['planning', 'growth']],
  ['Counsel with the Lord in all thy doings, and he will direct thee for good.', 'Alma 37:37', ['planning', 'faith']],
  ['Faith without works is dead.', 'James 2:26', ['growth', 'faith']],
  ['To every thing there is a season, and a time to every purpose under the heaven.', 'Ecclesiastes 3:1', ['planning', 'rest']],
]

export const QUOTES = [
  // Hyrum W. Smith
  ['You control your life by controlling your time.', 'Hyrum W. Smith', ['planning', 'growth']],
  ['Your governing values are the foundation of personal fulfillment.', 'Hyrum W. Smith', ['faith', 'growth']],
  ['When your daily practices reflect your governing values, you experience inner peace.', 'Hyrum W. Smith', ['faith', 'growth', 'planning']],
  ['To reach any significant goal, you must leave your comfort zone.', 'Hyrum W. Smith', ['fitness', 'music', 'growth']],
  ['Daily planning leverages time through increased focus.', 'Hyrum W. Smith', ['planning']],
  ['Your behavior is a reflection of what you truly believe.', 'Hyrum W. Smith', ['growth', 'faith']],
  ['Pain is inevitable, misery is optional.', 'Hyrum W. Smith', ['fitness', 'growth']],
  ['You are what you believe.', 'Hyrum W. Smith', ['growth']],
  // Planning & time
  ['Begin with the end in mind.', 'Stephen R. Covey', ['planning', 'growth']],
  ["The key is not to prioritize what's on your schedule, but to schedule your priorities.", 'Stephen R. Covey', ['planning']],
  ['Things which matter most must never be at the mercy of things which matter least.', 'Johann Wolfgang von Goethe', ['planning', 'faith']],
  ['Plans are worthless, but planning is everything.', 'Dwight D. Eisenhower', ['planning']],
  ['Lost time is never found again.', 'Benjamin Franklin', ['planning', 'rest']],
  ['Well done is better than well said.', 'Benjamin Franklin', ['growth']],
  // Discipline & growth
  ['We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Will Durant', ['growth', 'music', 'fitness']],
  ['Discipline is the bridge between goals and accomplishment.', 'Jim Rohn', ['growth', 'planning']],
  ['Motivation is what gets you started. Habit is what keeps you going.', 'Jim Rohn', ['growth', 'fitness']],
  ['We must all suffer one of two things: the pain of discipline or the pain of regret.', 'Jim Rohn', ['growth', 'fitness']],
  ["Take care of your body. It's the only place you have to live.", 'Jim Rohn', ['fitness', 'rest']],
  ['Success is the sum of small efforts, repeated day in and day out.', 'Robert Collier', ['growth', 'music']],
  ['Do what you can, with what you have, where you are.', 'Theodore Roosevelt', ['growth']],
  ['No man is free who is not master of himself.', 'Epictetus', ['growth', 'faith']],
  ['First say to yourself what you would be; and then do what you have to do.', 'Epictetus', ['growth', 'fitness']],
  ['Act as if what you do makes a difference. It does.', 'William James', ['growth', 'faith']],
  ["Don't watch the clock; do what it does. Keep going.", 'Sam Levenson', ['growth', 'fitness']],
  ['Practice does not make perfect. Only perfect practice makes perfect.', 'Vince Lombardi', ['music', 'fitness']],
  // Latter-day prophets
  ['Joy comes from and because of Him.', 'Russell M. Nelson', ['faith']],
  ['Decisions determine destiny.', 'Thomas S. Monson', ['growth', 'planning']],
  ['Without hard work, nothing grows but weeds.', 'Gordon B. Hinckley', ['growth', 'fitness', 'music']],
  ['Try a little harder to be a little better.', 'Gordon B. Hinckley', ['growth', 'faith']],
]

const TOPIC_PATTERNS = {
  faith: /christ|church|pray|scripture|temple|disciple|faith|god|minister|covenant|tithing|gospel|spirit/i,
  fitness: /lift|strength|gym|workout|run|physical|body|protein|train|fitness|muscle|cardio/i,
  music: /guitar|music|song|piano|chord|sing|instrument/i,
  planning: /plan|calendar|schedule|organi[sz]|week|procrastinat|time/i,
  rest: /sleep|bed|rest|alarm/i,
}

export const TOPIC_LABELS = {
  faith: 'Discipleship',
  fitness: 'Strength',
  music: 'Practice',
  planning: 'Planning',
  rest: 'Rest',
  growth: 'Growth',
}

function hash(str) {
  let h = 0
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

// Topics you're actively working on, from habit and goal names/whys.
// Returns [{ topic, source }] where source is the habit/goal name.
export function topicsFor(items) {
  const found = new Map()
  for (const it of items) {
    const text = `${it.name ?? it.title ?? ''} ${it.why ?? ''} ${it.system ?? ''}`
    for (const [topic, re] of Object.entries(TOPIC_PATTERNS))
      if (re.test(text) && !found.has(topic)) found.set(topic, it.name ?? it.title)
  }
  const list = [...found].map(([topic, source]) => ({ topic, source }))
  list.push({ topic: 'growth', source: null })
  return list
}

// One scripture and one quote for the day, each leaning toward a different
// one of your focus areas. Same picks all day; new ones tomorrow.
export function dailyInspiration(items, iso) {
  const topics = topicsFor(items)
  const day = hash(iso)
  const pickFrom = (pool, focus, salt) => {
    const matching = pool.filter(([, , tags]) => tags.includes(focus.topic))
    const list = matching.length ? matching : pool
    const [text, source] = list[hash(iso + salt) % list.length]
    return { text, source, focus }
  }
  const quoteFocus = topics[day % topics.length]
  const scriptureFocus = topics[(day + 1) % topics.length]
  return {
    scripture: pickFrom(SCRIPTURES, scriptureFocus, 's'),
    quote: pickFrom(QUOTES, quoteFocus, 'q'),
  }
}
