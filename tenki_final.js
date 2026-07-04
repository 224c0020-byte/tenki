const api = 'https://api.open-meteo.com/v1/forecast?latitude=35.6895&longitude=139.6917&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum';

const DEFAULT_LOCATIONS = [
  { name: '東京', lat: 35.6895, lng: 139.6917 }
];

let currentIndex = 0;

// -------------------- location --------------------

function loadLocations() {
  const saved = localStorage.getItem('weather_locations');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  return DEFAULT_LOCATIONS.slice();
}

function saveLocations(locations) {
  localStorage.setItem('weather_locations', JSON.stringify(locations));
}

// -------------------- add / remove --------------------

function handleAdd() {
  const nameEl = document.querySelector('#add-form input[name="name"]');
  const latEl = document.querySelector('#add-form input[name="lat"]');
  const lngEl = document.querySelector('#add-form input[name="lng"]');

  const name = nameEl.value.trim();
  const lat = parseFloat(latEl.value);
  const lng = parseFloat(lngEl.value);

  if (!name || isNaN(lat) || isNaN(lng)) {
    alert('地名・緯度・経度をすべて入力してください。');
    return;
  }

  const locations = loadLocations();
  locations.push({ name, lat, lng });
  saveLocations(locations);

  nameEl.value = '';
  latEl.value = '';
  lngEl.value = '';

  renderLocationList();
}

// -------------------- delete --------------------

function removeLocation(index) {
  const locations = loadLocations();

  if (locations.length <= 1) {
    alert('最後の1件は削除できません。');
    return;
  }

  locations.splice(index, 1);
  saveLocations(locations);

  if (currentIndex >= locations.length) {
    currentIndex = locations.length - 1;
  }

  renderLocationList();
  switchLocation(currentIndex);
}

// -------------------- render list --------------------

function renderLocationList() {
  const locations = loadLocations();
  const list = document.getElementById('location-list');
  list.innerHTML = '';

  locations.forEach((loc, i) => {
    const li = document.createElement('li');

    const switchBtn = document.createElement('button');
    switchBtn.className = 'loc-btn' + (i === currentIndex ? ' active' : '');
    switchBtn.textContent = loc.name;
    switchBtn.onclick = () => switchLocation(i);

    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '✕';
    delBtn.onclick = () => removeLocation(i);

    li.appendChild(switchBtn);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

// -------------------- switch location --------------------

function switchLocation(index) {
  currentIndex = index;
  renderLocationList();

  const locations = loadLocations();
  const loc = locations[index];
  if (!loc) return;

  document.getElementById('city-name').textContent = loc.name + 'の天気';

  const url =
    api
      .replace('latitude=35.6895', 'latitude=' + loc.lat)
      .replace('longitude=139.6917', 'longitude=' + loc.lng)
    + '&timezone=Asia%2FTokyo';

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (!data || !data.daily) return;
      makePage(data);
    });
}

// -------------------- render weather --------------------

function makePage(data) {
  for (let i = 0; i < 3; i++) {
    if (!data.daily.time?.[i]) continue;

    setData('day' + i, dateFormat(data.daily.time[i]));
    setData('weathercode' + i, getWMO(data.daily.weather_code?.[i]));
    setData('temperature_2m_max' + i, (data.daily.temperature_2m_max?.[i] ?? '--') + '℃');
    setData('temperature_2m_min' + i, (data.daily.temperature_2m_min?.[i] ?? '--') + '℃');
    setData('precipitation_sum' + i, (data.daily.precipitation_sum?.[i] ?? '--') + 'mm');
  }

  const rainy =
    (data.daily.precipitation_sum?.[0] ?? 0) > 0 ||
    (data.daily.precipitation_sum?.[1] ?? 0) > 0 ||
    (data.daily.precipitation_sum?.[2] ?? 0) > 0;

  document.getElementById('body').style.backgroundColor =
    rainy ? '#cff' : '#ffc';
}

// -------------------- helpers --------------------

function setData(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

function dateFormat(date, mode) {
  const d = new Date(date);

  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  const hh = addZero(d.getHours());
  const mm = addZero(d.getMinutes());
  const ss = addZero(d.getSeconds());

  if (mode === 1) {
    return `${y}年${m}月${day}日 ${hh}:${mm}:${ss}`;
  }
  return `${m}月${day}日`;
}

function addZero(n) {
  return n < 10 ? '0' + n : String(n);
}

function getWMO(w) {
  if (w === 0) return '☀️';
  if (w === 1) return '🌤';
  if (w === 2) return '⛅️';
  if (w === 3) return '☁️';
  if (w === 45 || w === 48) return '霧';
  if (w >= 51 && w <= 57) return '霧雨';
  if (w >= 61 && w <= 67) return '☔️';
  if (w >= 71 && w <= 77) return '❄️';
  if (w >= 80 && w <= 82) return '☔️';
  if (w >= 85 && w <= 86) return '❄️';
  if (w >= 95) return '⚡️☔️';
  return String(w);
}

// -------------------- init --------------------

window.addEventListener('DOMContentLoaded', () => {
  renderLocationList();
  switchLocation(currentIndex);
});

// time update
setInterval(() => {
  setData('time', dateFormat(new Date(), 1));
}, 1000);

// refresh weather
setInterval(() => {
  switchLocation(currentIndex);
}, 1000 * 60 * 60);
