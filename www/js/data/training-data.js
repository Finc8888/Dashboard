// Training data loader — fetches CSV files from /data/ (mounted via docker-compose)
// CSV sources configured in .env: TRAINING_SCHEDULE_CSV, RECORDS_CSV

let TRAINING_SCHEDULE = [];
let RECORDS_DATA = [];

const TRAINING_PLAN_META = {
  startDate: '2026-03-23',
  endDate: '2026-10-04',
  totalWeeks: 28,
  currentRecord: '21:17',
  finalTarget: '18:30',
  phases: [
    { id: 2, name: 'Развитие скорости', weeks: [1, 10],  target5k: '20:00-21:00' },
    { id: 3, name: 'Выход за МАС',      weeks: [11, 20], target5k: '19:00-19:45' },
    { id: 4, name: 'Пиковая подготовка', weeks: [21, 28], target5k: '18:30-18:45' },
  ],
};

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

function parseDateDMY(dmy) {
  // DD.MM.YYYY → YYYY-MM-DD
  const [d, m, y] = dmy.split('.');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

async function loadTrainingSchedule() {
  try {
    const resp = await fetch('data/training_schedule.csv?_=' + Date.now());
    if (!resp.ok) return [];
    const text = await resp.text();
    const lines = text.trim().split('\n');
    // header: Фаза,Неделя,Дата,День,Тренировка
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 5) continue;
      const weekMatch = cols[1].match(/\d+/);
      data.push({
        phase: cols[0],
        week: weekMatch ? parseInt(weekMatch[0]) : 0,
        date: parseDateDMY(cols[2]),
        day: cols[3],
        workout: cols[4],
      });
    }
    return data;
  } catch (e) {
    console.warn('Failed to load training schedule:', e);
    return [];
  }
}

async function loadRecordsCSV() {
  try {
    const resp = await fetch('data/records_sorted.csv?_=' + Date.now());
    if (!resp.ok) return [];
    const text = await resp.text();
    const lines = text.trim().split('\n');
    // header: Старт,Время,Имя атлета,Пол,Дата,Темп
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 6) continue;
      data.push({
        location: cols[0],
        time: cols[1],
        athlete: cols[2],
        gender: cols[3],
        date: cols[4],
        pace: cols[5],
      });
    }
    return data;
  } catch (e) {
    console.warn('Failed to load records:', e);
    return [];
  }
}

async function initTrainingData() {
  TRAINING_SCHEDULE = await loadTrainingSchedule();
  RECORDS_DATA = await loadRecordsCSV();
}
