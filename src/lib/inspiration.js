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
  // ---- more (Oct 2026) ----
  ['Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.', 'Joshua 1:9', ['faith', 'fitness']],
  ['Commit thy works unto the LORD, and thy thoughts shall be established.', 'Proverbs 16:3', ['planning', 'faith']],
  ['A man’s heart deviseth his way: but the LORD directeth his steps.', 'Proverbs 16:9', ['planning', 'faith']],
  ['The thoughts of the diligent tend only to plenteousness.', 'Proverbs 21:5', ['planning', 'growth']],
  ['Go to the ant, thou sluggard; consider her ways, and be wise.', 'Proverbs 6:6', ['growth', 'planning']],
  ['For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.', '2 Timothy 1:7', ['faith', 'growth']],
  ['Know ye not that they which run in a race run all, but one receiveth the prize? So run, that ye may obtain.', '1 Corinthians 9:24', ['fitness', 'growth']],
  ['I have fought a good fight, I have finished my course, I have kept the faith.', '2 Timothy 4:7', ['faith', 'growth', 'fitness']],
  ['And let us not be weary in well doing: for in due season we shall reap, if we faint not.', 'Galatians 6:9', ['growth', 'faith']],
  ['Forgetting those things which are behind, and reaching forth unto those things which are before, I press toward the mark.', 'Philippians 3:13–14', ['growth', 'fitness']],
  ['But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.', 'Matthew 6:33', ['faith', 'planning']],
  ['Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself.', 'Matthew 6:34', ['rest', 'faith']],
  ['Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.', 'Matthew 5:16', ['faith', 'growth']],
  ['Peace I leave with you, my peace I give unto you. Let not your heart be troubled, neither let it be afraid.', 'John 14:27', ['rest', 'faith']],
  ['In the world ye shall have tribulation: but be of good cheer; I have overcome the world.', 'John 16:33', ['faith']],
  ['And we know that all things work together for good to them that love God.', 'Romans 8:28', ['faith']],
  ['Be not conformed to this world: but be ye transformed by the renewing of your mind.', 'Romans 12:2', ['growth', 'faith']],
  ['Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee.', 'Isaiah 41:10', ['faith', 'fitness']],
  ['In quietness and in confidence shall be your strength.', 'Isaiah 30:15', ['rest', 'faith']],
  ['I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety.', 'Psalm 4:8', ['rest']],
  ['He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.', 'Psalm 23:2–3', ['rest', 'faith']],
  ['O sing unto the LORD a new song: sing unto the LORD, all the earth.', 'Psalm 96:1', ['music', 'faith']],
  ['Sing unto him a new song; play skilfully with a loud noise.', 'Psalm 33:3', ['music']],
  ['Let every thing that hath breath praise the LORD.', 'Psalm 150:6', ['music', 'faith']],
  ['Teaching and admonishing one another in psalms and hymns and spiritual songs, singing with grace in your hearts to the Lord.', 'Colossians 3:16', ['music', 'faith']],
  ['Whatsoever thy hand findeth to do, do it with thy might.', 'Ecclesiastes 9:10', ['growth', 'fitness', 'music']],
  ['Keep thy heart with all diligence; for out of it are the issues of life.', 'Proverbs 4:23', ['growth', 'faith']],
  ['Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.', 'Proverbs 27:17', ['fitness', 'growth']],
  ['For a just man falleth seven times, and riseth up again.', 'Proverbs 24:16', ['growth', 'fitness']],
  ['If thou canst believe, all things are possible to him that believeth.', 'Mark 9:23', ['faith']],
  ['If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.', 'James 1:5', ['faith', 'planning']],
  ['Now faith is the substance of things hoped for, the evidence of things not seen.', 'Hebrews 11:1', ['faith']],
  ['I give unto men weakness that they may be humble … then will I make weak things become strong unto them.', 'Ether 12:27', ['growth', 'faith', 'fitness']],
  ['Ye receive no witness until after the trial of your faith.', 'Ether 12:6', ['faith']],
  ['This life is the time for men to prepare to meet God; yea, behold the day of this life is the day for men to perform their labors.', 'Alma 34:32', ['planning', 'faith']],
  ['Faith is not to have a perfect knowledge of things; therefore if ye have faith ye hope for things which are not seen, which are true.', 'Alma 32:21', ['faith']],
  ['Learn wisdom in thy youth; yea, learn in thy youth to keep the commandments of God.', 'Alma 37:35', ['growth', 'faith']],
  ['In his strength I can do all things.', 'Alma 26:12', ['faith', 'fitness']],
  ['It is upon the rock of our Redeemer, who is Christ, the Son of God, that ye must build your foundation.', 'Helaman 5:12', ['faith']],
  ['Consider on the blessed and happy state of those that keep the commandments of God.', 'Mosiah 2:41', ['faith']],
  ['Ye must press forward with a steadfastness in Christ, having a perfect brightness of hope, and a love of God and of all men.', '2 Nephi 31:20', ['faith', 'growth']],
  ['My soul delighteth in the things of the Lord.', '2 Nephi 4:16', ['faith']],
  ['Come unto Christ, and be perfected in him.', 'Moroni 10:32', ['faith', 'growth']],
  ['Always returning thanks unto God for whatsoever things ye do receive.', 'Alma 7:23', ['faith']],
  ['Men should be anxiously engaged in a good cause, and do many things of their own free will, and bring to pass much righteousness.', 'D&C 58:27', ['growth', 'planning']],
  ['And shall run and not be weary, and shall walk and not faint.', 'D&C 89:20', ['fitness', 'rest']],
  ['Seek ye out of the best books words of wisdom; seek learning, even by study and also by faith.', 'D&C 88:118', ['growth', 'faith']],
  ['Search diligently, pray always, and be believing, and all things shall work together for your good.', 'D&C 90:24', ['faith']],
  ['Let us cheerfully do all things that lie in our power; and then may we stand still, with the utmost assurance, to see the salvation of God.', 'D&C 123:17', ['growth', 'faith', 'planning']],
  ['I will go before your face. I will be on your right hand and on your left, and my Spirit shall be in your hearts, and mine angels round about you, to bear you up.', 'D&C 84:88', ['faith']],
  ['Learn of me, and listen to my words; walk in the meekness of my Spirit, and you shall have peace in me.', 'D&C 19:23', ['faith', 'rest']],
  ['Whatever principle of intelligence we attain unto in this life, it will rise with us in the resurrection.', 'D&C 130:18', ['growth']],
  ['Draw near unto me and I will draw near unto you.', 'D&C 88:63', ['faith']],
  ['If thou art merry, praise the Lord with singing, with music, with dancing, and with a prayer of praise and thanksgiving.', 'D&C 136:28', ['music', 'faith']],
  ['That which is of God is light; and he that receiveth light, and continueth in God, receiveth more light; and that light groweth brighter and brighter until the perfect day.', 'D&C 50:24', ['growth', 'faith']],
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
  ['Keep trying. Be believing. Be happy. Don’t get discouraged. Things will work out.', 'Gordon B. Hinckley', ['faith', 'growth']],
  ['When we put God first, all other things fall into their proper place or drop out of our lives.', 'Ezra Taft Benson', ['faith', 'planning']],
  ['Men and women who turn their lives over to God will discover that He can make a lot more out of their lives than they can.', 'Ezra Taft Benson', ['faith']],
  ['Whatever Jesus lays His hands upon lives.', 'Howard W. Hunter', ['faith']],
  ['Keep on the covenant path.', 'Russell M. Nelson', ['faith']],
  ['Doubt your doubts before you doubt your faith.', 'Dieter F. Uchtdorf', ['faith']],
  ['Don’t you quit. You keep walking. You keep trying.', 'Jeffrey R. Holland', ['faith', 'growth', 'fitness']],
  ['When performance is measured, performance improves. When performance is measured and reported, the rate of improvement accelerates.', 'Thomas S. Monson', ['planning', 'growth']],
  ['Choose the harder right instead of the easier wrong.', 'Thomas S. Monson', ['growth', 'faith']],
  // Classics
  ['Waste no more time arguing about what a good man should be. Be one.', 'Marcus Aurelius', ['growth', 'faith']],
  ['The impediment to action advances action. What stands in the way becomes the way.', 'Marcus Aurelius', ['growth', 'fitness']],
  ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca', ['planning']],
  ['Well begun is half done.', 'Aristotle', ['planning', 'growth']],
  ['Energy and persistence conquer all things.', 'Benjamin Franklin', ['growth', 'fitness']],
  ['Early to bed and early to rise makes a man healthy, wealthy, and wise.', 'Benjamin Franklin', ['rest']],
  ['Either write something worth reading or do something worth writing.', 'Benjamin Franklin', ['growth']],
  ['I am not afraid of storms, for I am learning how to sail my ship.', 'Louisa May Alcott', ['growth', 'faith']],
  ['Strength does not come from physical capacity. It comes from an indomitable will.', 'Mahatma Gandhi', ['fitness', 'growth']],
  // Modern
  ['Nothing will work unless you do.', 'Maya Angelou', ['growth', 'fitness']],
  ['Do the best you can until you know better. Then when you know better, do better.', 'Maya Angelou', ['growth']],
  ['You will never change your life until you change something you do daily. The secret of your success is found in your daily routine.', 'John C. Maxwell', ['growth', 'planning']],
  ['Hard work beats talent when talent doesn’t work hard.', 'Tim Notke', ['fitness', 'music', 'growth']],
  ['Practice isn’t the thing you do once you’re good. It’s the thing you do that makes you good.', 'Malcolm Gladwell', ['music', 'fitness']],
  ['The beautiful thing about learning is that no one can take it away from you.', 'B.B. King', ['music', 'growth']],
  ['Without music, life would be a mistake.', 'Friedrich Nietzsche', ['music']],
  ['The best investment you can make is in yourself.', 'Warren Buffett', ['growth', 'planning']],
  ['Someone’s sitting in the shade today because someone planted a tree a long time ago.', 'Warren Buffett', ['planning', 'growth']],
  ['It is not the mountain we conquer, but ourselves.', 'Edmund Hillary', ['fitness', 'growth']],
  ['A good laugh and a long sleep are the best cures in the doctor’s book.', 'Irish proverb', ['rest']],
  // ---- more (Oct 2026) ----
  // Hyrum W. Smith — the rest of the 10 Natural Laws
  ['You satisfy your needs when your beliefs are in line with reality.', 'Hyrum W. Smith', ['growth']],
  ['Negative behaviors are overcome by changing incorrect beliefs.', 'Hyrum W. Smith', ['growth']],
  ['Self-esteem must ultimately come from within.', 'Hyrum W. Smith', ['growth', 'faith']],
  ['Give more and you’ll have more.', 'Hyrum W. Smith', ['faith', 'growth']],
  // Habits & systems
  ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear', ['planning', 'growth']],
  ['Every action you take is a vote for the type of person you wish to become.', 'James Clear', ['growth', 'fitness']],
  ['Habits are the compound interest of self-improvement.', 'James Clear', ['growth']],
  ['Either you run the day or the day runs you.', 'Jim Rohn', ['planning']],
  ['Don’t wish it were easier; wish you were better.', 'Jim Rohn', ['growth', 'fitness', 'music']],
  ['If you aim at nothing, you will hit it every time.', 'Zig Ziglar', ['planning']],
  ['You don’t have to be great to start, but you have to start to be great.', 'Zig Ziglar', ['growth', 'music']],
  ['We become what we think about.', 'Earl Nightingale', ['growth']],
  ['Discipline equals freedom.', 'Jocko Willink', ['growth', 'fitness']],
  // Planning & time
  ['Most of us spend too much time on what is urgent and not enough time on what is important.', 'Stephen R. Covey', ['planning']],
  ['I am not a product of my circumstances. I am a product of my decisions.', 'Stephen R. Covey', ['growth']],
  ['Live out of your imagination, not your history.', 'Stephen R. Covey', ['growth', 'planning']],
  ['Every minute you spend in planning saves ten minutes in execution.', 'Brian Tracy', ['planning']],
  ['Failing to plan is planning to fail.', 'Alan Lakein', ['planning']],
  ['There is nothing so useless as doing efficiently that which should not be done at all.', 'Peter Drucker', ['planning']],
  ['How we spend our days is, of course, how we spend our lives.', 'Annie Dillard', ['planning', 'growth']],
  ['Dost thou love life? Then do not squander time, for that’s the stuff life is made of.', 'Benjamin Franklin', ['planning']],
  ['Time is what we want most, but what we use worst.', 'William Penn', ['planning']],
  ['A man who dares to waste one hour of time has not discovered the value of life.', 'Charles Darwin', ['planning']],
  ['While we are postponing, life speeds by.', 'Seneca', ['planning']],
  ['Luck is what happens when preparation meets opportunity.', 'Seneca', ['planning', 'growth']],
  ['To achieve great things, two things are needed: a plan, and not quite enough time.', 'Leonard Bernstein', ['planning', 'music']],
  ['Be quick, but don’t hurry.', 'John Wooden', ['planning', 'fitness']],
  // Growth & grit
  ['Do not let what you cannot do interfere with what you can do.', 'John Wooden', ['growth']],
  ['Make each day your masterpiece.', 'John Wooden', ['growth', 'planning']],
  ['Far and away the best prize that life offers is the chance to work hard at work worth doing.', 'Theodore Roosevelt', ['growth']],
  ['Keep your eyes on the stars, and your feet on the ground.', 'Theodore Roosevelt', ['growth', 'planning']],
  ['Believe you can and you’re halfway there.', 'Theodore Roosevelt', ['growth']],
  ['Nothing in this world can take the place of persistence.', 'Calvin Coolidge', ['growth', 'fitness']],
  ['Start where you are. Use what you have. Do what you can.', 'Arthur Ashe', ['growth']],
  ['The most difficult thing is the decision to act; the rest is merely tenacity.', 'Amelia Earhart', ['growth']],
  ['Success is to be measured not so much by the position that one has reached in life as by the obstacles which he has overcome.', 'Booker T. Washington', ['growth']],
  ['The way to get started is to quit talking and begin doing.', 'Walt Disney', ['growth', 'planning']],
  ['The journey of a thousand miles begins with a single step.', 'Lao Tzu', ['growth', 'fitness']],
  ['Genius is one percent inspiration and ninety-nine percent perspiration.', 'Thomas Edison', ['growth', 'music']],
  ['I have not failed. I’ve just found 10,000 ways that won’t work.', 'Thomas Edison', ['growth']],
  ['Whether you think you can, or you think you can’t — you’re right.', 'Henry Ford', ['growth']],
  ['When we are no longer able to change a situation, we are challenged to change ourselves.', 'Viktor E. Frankl', ['growth', 'faith']],
  ['He who has a why to live can bear almost any how.', 'Friedrich Nietzsche', ['growth']],
  ['The first and best victory is to conquer self.', 'Plato', ['growth']],
  ['It’s not what happens to you, but how you react to it that matters.', 'Epictetus', ['growth']],
  ['The happiness of your life depends upon the quality of your thoughts.', 'Marcus Aurelius', ['growth', 'rest']],
  ['Go confidently in the direction of your dreams. Live the life you have imagined.', 'Henry David Thoreau', ['growth']],
  ['If you can’t fly then run, if you can’t run then walk, if you can’t walk then crawl, but whatever you do you have to keep moving forward.', 'Martin Luther King Jr.', ['growth', 'fitness']],
  ['Faith is taking the first step even when you don’t see the whole staircase.', 'Martin Luther King Jr.', ['faith', 'growth']],
  ['Alone we can do so little; together we can do so much.', 'Helen Keller', ['growth']],
  ['You miss 100% of the shots you don’t take.', 'Wayne Gretzky', ['growth', 'fitness']],
  ['I’ve failed over and over and over again in my life. And that is why I succeed.', 'Michael Jordan', ['growth', 'fitness']],
  // Training
  ['Rest at the end, not in the middle.', 'Kobe Bryant', ['fitness']],
  ['Only the disciplined ones in life are free. If you are undisciplined, you are a slave to your moods and your passions.', 'Eliud Kipchoge', ['fitness', 'growth']],
  ['I hated every minute of training, but I said, “Don’t quit. Suffer now and live the rest of your life as a champion.”', 'Muhammad Ali', ['fitness']],
  ['I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times.', 'Bruce Lee', ['fitness', 'music']],
  ['The Iron never lies to you.', 'Henry Rollins', ['fitness']],
  ['The last three or four reps is what makes the muscle grow.', 'Arnold Schwarzenegger', ['fitness']],
  ['Strong people are harder to kill than weak people, and more useful in general.', 'Mark Rippetoe', ['fitness']],
  ['The goal is to keep the goal the goal.', 'Dan John', ['fitness', 'planning']],
  ['Exercise is king. Nutrition is queen. Put them together and you’ve got a kingdom.', 'Jack LaLanne', ['fitness']],
  ['Physical fitness is the first requisite of happiness.', 'Joseph Pilates', ['fitness']],
  ['Physical fitness is not only one of the most important keys to a healthy body, it is the basis of dynamic and creative intellectual activity.', 'John F. Kennedy', ['fitness', 'growth']],
  ['To give anything less than your best is to sacrifice the gift.', 'Steve Prefontaine', ['fitness', 'music', 'growth']],
  ['Perfection is not attainable, but if we chase perfection we can catch excellence.', 'Vince Lombardi', ['fitness', 'music', 'growth']],
  // Music
  ['Because I think I’m making progress.', 'Pablo Casals, in his 90s, on why he still practiced every day', ['music', 'growth']],
  ['Where words fail, music speaks.', 'Hans Christian Andersen', ['music']],
  ['Music expresses that which cannot be said and on which it is impossible to be silent.', 'Victor Hugo', ['music']],
  ['Master your instrument, master the music, and then forget all that and just play.', 'Charlie Parker', ['music']],
  ['Do not fear mistakes. There are none.', 'Miles Davis', ['music', 'growth']],
  // Rest
  ['Almost everything will work again if you unplug it for a few minutes, including you.', 'Anne Lamott', ['rest']],
  ['Take rest; a field that has rested gives a bountiful crop.', 'Ovid', ['rest']],
  ['Sleep is that golden chain that ties health and our bodies together.', 'Thomas Dekker', ['rest', 'fitness']],
  ['It is a common experience that a problem difficult at night is resolved in the morning after the committee of sleep has worked on it.', 'John Steinbeck', ['rest']],
  ['Sleep is the single most effective thing we can do to reset our brain and body health each day.', 'Matthew Walker', ['rest', 'fitness']],
  // Latter-day leaders
  ['When the focus of our lives is on Jesus Christ and His gospel, we can feel joy regardless of what is happening — or not happening — in our lives.', 'Russell M. Nelson', ['faith']],
  ['Repentance is not an event; it is a process.', 'Russell M. Nelson', ['faith', 'growth']],
  ['Be patient with yourself. Perfection comes not in this life but in the next life.', 'Dieter F. Uchtdorf', ['growth', 'rest', 'faith']],
  ['However late you think you are, however many chances you think you have missed … you have not traveled beyond the reach of divine love.', 'Jeffrey R. Holland', ['faith']],
  ['Some blessings come soon, some come late, and some don’t come until heaven; but for those who embrace the gospel of Jesus Christ, they come.', 'Jeffrey R. Holland', ['faith']],
  ['God does not begin by asking us about our ability, but only about our availability, and if we then prove our dependability, he will increase our capability.', 'Neal A. Maxwell', ['faith', 'growth']],
  ['True doctrine, understood, changes attitudes and behavior.', 'Boyd K. Packer', ['faith', 'growth']],
  ['The future is as bright as your faith.', 'Thomas S. Monson', ['faith']],
  ['Never let a problem to be solved become more important than a person to be loved.', 'Thomas S. Monson', ['faith']],
  ['You can’t plow a field by turning it over in your mind.', 'Gordon B. Hinckley', ['growth', 'planning']],
  ['Lengthen your stride.', 'Spencer W. Kimball', ['growth', 'faith']],
  ['Aim at heaven and you will get earth thrown in. Aim at earth and you get neither.', 'C. S. Lewis', ['faith', 'planning']],
  // Rest of the classics
  ['Rest is not idleness.', 'John Lubbock', ['rest']],
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
