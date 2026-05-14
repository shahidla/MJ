// Adds new KB entries with embeddings to mj-HistoryEvents.csv
// Run: node scripts/add-kb-entries.js
require('dotenv').config({ path: '.env' });
const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const CSV_FILE = path.join(__dirname, '../db/data/mj-HistoryEvents.csv');
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ── New entries (not already in KB) ─────────────────────────────────────────
const NEW_ENTRIES = [
  {
    year: 1863,
    headline: 'Lincoln Gettysburg Address — government of the people by the people for the people',
    context: 'Abraham Lincoln delivered the Gettysburg Address on November 19 1863 to honor soldiers who died in the Civil War. He declared that the nation was dedicated to the proposition that all men are created equal. He called on the living to ensure that government of the people, by the people, for the people, shall not perish from the earth.'
  },
  {
    year: 1893,
    headline: 'Daniel Hale Williams performs first successful open-heart surgery',
    context: 'Daniel Hale Williams was an African American surgeon born in 1856 who performed one of the world\'s first successful open-heart surgeries in 1893. He founded Provident Hospital in Chicago, one of the first hospitals in the United States with interracial staff. He broke barriers in medicine at a time when African Americans were excluded from most hospitals and medical societies.'
  },
  {
    year: 1909,
    headline: 'Matthew Henson reaches the North Pole — African American explorer',
    context: 'Matthew Henson was an African American explorer who accompanied Robert Peary on expeditions to the North Pole. Despite facing severe racial discrimination, he played a crucial role in reaching the Arctic in 1909 and was eventually recognized for his contributions to exploration. He was one of the first people to reach the geographic North Pole.'
  },
  {
    year: 1920,
    headline: 'KDKA Pittsburgh airs first commercial radio broadcast',
    context: 'Radio station KDKA in Pittsburgh aired the first commercial radio broadcast on November 2 1920 covering the presidential election results. It was a turning point, bringing news and entertainment directly into people\'s homes and paving the way for the modern broadcasting industry. Radio would become the dominant mass medium for the next three decades.'
  },
  {
    year: 1927,
    headline: 'Charles Lindbergh first nonstop flight New York to Paris',
    context: 'Charles Lindbergh became the first person to fly nonstop from New York to Paris on May 20-21 1927 in his single-engine plane the Spirit of St. Louis. The 33.5-hour flight covered 3600 miles and made Lindbergh an international hero. His achievement proved the viability of transatlantic aviation and changed the future of travel forever.'
  },
  {
    year: 1928,
    headline: 'Walt Disney creates Mickey Mouse — animation revolutionized',
    context: 'Walt Disney was an American entrepreneur, animator, and film producer who created Mickey Mouse in 1928 and founded the iconic Walt Disney Company. His imaginative storytelling and pioneering work in animation revolutionized the entertainment industry. Steamboat Willie, the first synchronized sound cartoon, launched Mickey Mouse and changed popular culture worldwide.'
  },
  {
    year: 1940,
    headline: 'Princess Elizabeth speaks to children evacuated during World War II',
    context: 'In 1940 Princess Elizabeth, before she became Queen of the United Kingdom, gave a radio speech to encourage the children of Britain who had been evacuated from cities during World War II. She spoke directly to children separated from their families, offering comfort and reassurance during one of the most frightening periods in British history. Her words symbolized resilience and hope.'
  },
  {
    year: 1955,
    headline: 'Disneyland opens — fantasy adventure and entertainment combined',
    context: 'Disneyland opened in Anaheim California on July 17 1955, created by Walt Disney as a groundbreaking theme park that combined fantasy, adventure, and entertainment like never before. Its enduring legacy has inspired generations of visitors, sparking imagination and creating cherished memories for families around the world. It pioneered the modern theme park industry.'
  },
  {
    year: 1959,
    headline: 'Berry Gordy founds Motown Records — sound of young America',
    context: 'Berry Gordy founded Motown Records in Detroit in 1959, a groundbreaking record label that launched the careers of legendary musicians including The Jackson 5, Marvin Gaye, Diana Ross, Stevie Wonder, and The Temptations. His innovative approach to music production and promotion helped shape the sound of American popular music in the 20th century and broke racial barriers in the music industry.'
  },
  {
    year: 1960,
    headline: 'John Lennon co-founds The Beatles — most influential band in history',
    context: 'John Lennon was one of the founding members of The Beatles, the most influential band in music history, formed in Liverpool in 1960. Known for his songwriting talent, outspoken views on peace and justice, and iconic persona, Lennon\'s legacy extends far beyond his time with the band. He was a voice for a generation demanding peace, equality, and change.'
  },
  {
    year: 1961,
    headline: 'Yuri Gagarin first human in outer space',
    context: 'Yuri Gagarin became the first human to journey into outer space aboard the Vostok 1 spacecraft on April 12 1961. His 108-minute orbit of the Earth marked a significant milestone in human space exploration, inspiring generations and intensifying the Space Race between the Soviet Union and the United States. He became an international hero and symbol of human achievement.'
  },
  {
    year: 1964,
    headline: 'Beatles perform on Ed Sullivan Show — Beatlemania sweeps America',
    context: 'When The Beatles first performed on the Ed Sullivan Show on February 9 1964 an estimated 73 million viewers watched. Their energetic performance and catchy tunes captivated audiences, launching Beatlemania across the United States and beyond. The moment is considered one of the most significant cultural events in American broadcasting history and defined a generation.'
  },
  {
    year: 1964,
    headline: 'Malcolm X speech — by any means necessary',
    context: 'Malcolm X was a powerful civil rights leader who delivered influential speeches in 1964 advocating for African American rights and self-determination. Unlike the nonviolent approach of Martin Luther King Jr., Malcolm X argued that Black Americans had the right to defend themselves by any means necessary. His words challenged the status quo and gave voice to rage against systemic racism.'
  },
  {
    year: 1968,
    headline: 'Apollo 8 Christmas Eve — first humans orbit the moon',
    context: 'On Christmas Eve 1968 the Apollo 8 crew became the first humans to orbit the Moon. Astronauts Frank Borman, James Lovell, and William Anders broadcast a reading from the Book of Genesis to a worldwide audience estimated at one billion people. The mission produced the iconic Earthrise photograph, showing Earth as a fragile blue marble suspended in the blackness of space.'
  },
  {
    year: 1968,
    headline: 'Ted Kennedy eulogy for Robert F. Kennedy — dream shall never die',
    context: 'On June 8 1968 Ted Kennedy delivered a eulogy for his brother Robert F. Kennedy who had been assassinated two days earlier. RFK had been a presidential candidate and champion of the poor, of civil rights, and of ending the Vietnam War. Ted Kennedy quoted his brother: Some men see things as they are and say why — I dream things that never were and say why not.'
  },
  {
    year: 1971,
    headline: 'Michael Jackson interview — I only sing what I mean',
    context: 'In a 1971 interview as a member of The Jackson 5, Michael Jackson expressed his philosophy: Whatever I sing, that\'s what I really mean. I keep singing a song — I don\'t sing it if I don\'t mean it. He also said: Remember, it will be for us, the children of today that make the world tomorrow a better and happier place. Words he would live by throughout his entire career.'
  },
  {
    year: 1974,
    headline: 'Muhammad Ali defeats George Foreman — Rumble in the Jungle',
    context: 'Muhammad Ali was a legendary boxer who in 1974 defeated George Foreman in the Rumble in the Jungle in Kinshasa, Zaire. Ali was known for his incredible skill in the ring and charismatic personality outside of it. He became an icon of resistance against racial injustice, refusing military service on moral grounds, and a symbol of strength and resilience for people around the world.'
  },
  {
    year: 1877,
    headline: 'Edison phonograph — Mary had a little lamb first recorded words',
    context: 'Thomas Edison invented the phonograph in 1877, the first machine that could record and play back sound. The first words ever recorded were Edison reciting Mary had a little lamb. The Edison Phonograph Advertising Record was used to demonstrate the technology. This invention transformed music, communication, and entertainment, making it possible to preserve and reproduce the human voice for the first time.'
  },
  {
    year: 1895,
    headline: 'Rudyard Kipling publishes The Jungle Book — stories of imagination and courage',
    context: 'Rudyard Kipling was a British author famous for The Jungle Book published in 1894 and Just So Stories. His adventurous tales set in exotic places captured the imagination of readers around the world. Born in British India, his stories explored themes of identity, survival, and belonging. He became the first English-language writer to receive the Nobel Prize in Literature in 1907.'
  },
  {
    year: 1995,
    headline: 'They Don\'t Care About Us — MJ on systemic racism and police brutality',
    context: 'In They Don\'t Care About Us, Michael Jackson uses "They" to represent the government and particularly the police. Minorities like African Americans are often mistreated in the system, making them feel unloved and unwanted. The song is a direct response to years of negative press aimed at Michael and to systemic injustice against minorities. Eleanor Roosevelt, not FDR, was the one who consistently stood up against racism — FDR\'s civil rights record was mixed despite his popularity with African Americans.'
  },
  {
    year: 1995,
    headline: 'Earth Song — MJ on environmental destruction and human suffering',
    context: 'Earth Song by Michael Jackson asks humanity what we have done to the Earth. MJ references the economic and political benefits pursued at the cost of environmental destruction — pollution of oceans, poisoned air, species extinction, deforestation, war, and the suffering of children. The song ends with a view of Earth from the Moon, inciting the planet\'s inhabitants to change themselves in order to make the world a better place.'
  },
  {
    year: 1988,
    headline: 'Man in the Mirror — MJ on personal transformation as the start of global change',
    context: 'Man in the Mirror by Michael Jackson argues that lasting change in the world begins with the individual. MJ sees a view of the Earth from the surface of the Moon and calls on himself and all listeners to stand up and make a change. The song\'s message: you cannot change the world without first changing yourself. It remains one of the most powerful calls to personal accountability in popular music.'
  }
];

async function getEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
  });
  const json = await res.json();
  if (!json.data) throw new Error(JSON.stringify(json));
  return JSON.stringify(json.data[0].embedding);
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function main() {
  console.log(`Generating ${NEW_ENTRIES.length} new KB entries with embeddings...`);

  const lines = [];
  for (let i = 0; i < NEW_ENTRIES.length; i++) {
    const e = NEW_ENTRIES[i];
    console.log(`[${i+1}/${NEW_ENTRIES.length}] ${e.year} — ${e.headline}`);
    const embedding = await getEmbedding(`${e.year} ${e.headline} ${e.context}`);
    const id = randomUUID();
    lines.push([id, e.year, csvEscape(e.headline), csvEscape(e.context), csvEscape(embedding)].join(','));
  }

  fs.appendFileSync(CSV_FILE, '\n' + lines.join('\n') + '\n', 'utf8');
  console.log(`\nDone. ${lines.length} entries appended to ${CSV_FILE}`);
}

main().catch(console.error);
