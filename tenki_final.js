const api = 'https://api.open-meteo.com/v1/forecast?latitude=35.6895&longitude=139.6917&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_mean,wind_speed_10m_max,apparent_temperature_max,apparent_temperature_min,relative_humidity_2m_mean';
const hourlyApi = 'https://api.open-meteo.com/v1/forecast?latitude=35.6895&longitude=139.6917&hourly=temperature_2m,precipitation,weather_code,relative_humidity_2m,apparent_temperature&timezone=Asia%2FTokyo&forecast_days=1';
const geocodeApi = 'https://geocoding-api.open-meteo.com/v1/search?name=__NAME__&count=1&language=ja&format=json';

const DEFAULT_LOCATIONS = [
  { name: '東京', lat: 35.6895, lng: 139.6917 }
];

let currentIndex = 0;

// ローカル保存の読み書き
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

function saveCurrentLocation(loc) {
  sessionStorage.setItem('selectedWeatherLocation', JSON.stringify(loc));
}

// 追加処理：緯度経度があればそのまま、なければ地名検索で解決する
function handleAdd() {
  const nameEl = document.querySelector('#add-form input[name="name"]');
  const latEl = document.querySelector('#add-form input[name="lat"]');
  const lngEl = document.querySelector('#add-form input[name="lng"]');

  const name = nameEl.value.trim();
  const lat = parseFloat(latEl.value);
  const lng = parseFloat(lngEl.value);

  if (!name) {
    alert('地名を入力してください。');
    return;
  }

  if (!isNaN(lat) && !isNaN(lng)) {
    addLocation({ name, lat, lng });
    return;
  }

  searchLocationByName(name);
}

function searchLocationByName(name) {
  const url = geocodeApi.replace('__NAME__', encodeURIComponent(name));
  fetch(url)
    .then(res => res.json())
    .then(data => {
      const result = data.results?.[0];
      if (!result) {
        alert('該当する場所が見つかりませんでした。');
        return;
      }
      addLocation({ name: result.name, lat: result.latitude, lng: result.longitude });
    })
    .catch(() => {
      alert('地名検索に失敗しました。');
    });
}

function addLocation(loc) {
  const locations = loadLocations();
  const exists = locations.some(function (item) {
    return item.name === loc.name && item.lat === loc.lat && item.lng === loc.lng;
  });

  if (!exists) {
    locations.push(loc);
    saveLocations(locations);
  }

  const index = locations.findIndex(function (item) {
    return item.name === loc.name && item.lat === loc.lat && item.lng === loc.lng;
  });

  renderLocationList();
  if (index >= 0) {
    switchLocation(index);
  }
}

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

function renderLocationList() {
  const locations = loadLocations();
  const list = document.getElementById('location-list');
  list.innerHTML = '';

  locations.forEach(function (loc, i) {
    const li = document.createElement('li');

    const switchBtn = document.createElement('button');
    switchBtn.className = 'loc-btn' + (i === currentIndex ? ' active' : '');
    switchBtn.textContent = loc.name;
    switchBtn.onclick = function () { switchLocation(i); };

    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '✕';
    delBtn.onclick = function () { removeLocation(i); };

    li.appendChild(switchBtn);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

function switchLocation(index) {
  currentIndex = index;
  renderLocationList();

  const locations = loadLocations();
  const loc = locations[index];
  if (!loc) return;

  document.getElementById('city-name').textContent = loc.name + 'の天気';
  saveCurrentLocation(loc);
  fetchWeather(loc);
  fetchHourlyWeather(loc);
}

// 3日分の情報を取得して、Hero と 5日予報を描画
function fetchWeather(loc) {
  const url = api
    .replace('latitude=35.6895', 'latitude=' + loc.lat)
    .replace('longitude=139.6917', 'longitude=' + loc.lng)
    + '&timezone=Asia%2FTokyo';

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (!data || !data.daily) return;
      makePage(data);
    })
    .catch(() => {
      alert('天気情報の取得に失敗しました。');
    });
}

function fetchHourlyWeather(loc) {
  const url = hourlyApi
    .replace('latitude=35.6895', 'latitude=' + loc.lat)
    .replace('longitude=139.6917', 'longitude=' + loc.lng);

  fetch(url)
    .then(res => res.json())
    .then(data => {
      renderHourlyWeather(data, loc.name);
    })
    .catch(() => {
      const status = document.getElementById('hourly-status');
      if (status) status.textContent = '詳細天気の取得に失敗しました。';
    });
}

function renderHourlyWeather(data, name) {
  const list = document.getElementById('hourly-list');
  const status = document.getElementById('hourly-status');
  if (!list || !status) return;

  list.innerHTML = '';
  status.textContent = (name || '現在地') + 'の1時間ごとの予報';

  const hourly = data?.hourly || {};
  const times = hourly.time || [];
  const temps = hourly.temperature_2m || [];
  const precip = hourly.precipitation || [];
  const weather = hourly.weather_code || [];

  times.slice(0, 24).forEach(function (time, index) {
    const card = document.createElement('div');
    card.className = 'hourly-card';

    const label = new Date(time).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric'
    });

    card.innerHTML = '<div class="hourly-time">' + label + '</div><div class="hourly-icon">' + getWMO(weather[index]) + '</div><div>' + (temps[index] ?? '--') + '℃</div><div class="temp-range">' + (precip[index] ?? '--') + 'mm</div>';
    list.appendChild(card);
  });
}

function makePage(data) {
  const daily = data.daily || {};
  const now = new Date();

  if (daily.time?.[0]) {
    const weatherCode = daily.weather_code?.[0];
    const maxTemp = daily.temperature_2m_max?.[0];
    const minTemp = daily.temperature_2m_min?.[0];
    const feelsLike = daily.apparent_temperature_max?.[0];
    const humidity = daily.relative_humidity_2m_mean?.[0];
    const wind = daily.wind_speed_10m_max?.[0];
    const precipitation = daily.precipitation_probability_mean?.[0];

    setText('today-icon', getWMO(weatherCode));
    setText('today-temp', (maxTemp ?? '--') + '°');
    setText('today-desc', getWeatherDescription(weatherCode) + ' · ' + (precipitation ?? '--') + '%の降水確率');
    setText('today-range', '↑ ' + (maxTemp ?? '--') + '° / ↓ ' + (minTemp ?? '--') + '°');
    setText('today-feels', (feelsLike ?? '--') + '°');
    setText('today-humidity', (humidity ?? '--') + '%');
    setText('today-wind', (wind ?? '--') + 'm/s');
    setWeatherScene(weatherCode, now);
  }

  renderForecastCards(daily);
}

function renderForecastCards(daily) {
  const container = document.getElementById('forecast-cards');
  if (!container) return;

  container.innerHTML = '';
  const days = daily.time || [];

  days.slice(0, 5).forEach(function (dateString, index) {
    const card = document.createElement('div');
    card.className = 'forecast-card';

    const weatherCode = daily.weather_code?.[index];
    const maxT = daily.temperature_2m_max?.[index];
    const minT = daily.temperature_2m_min?.[index];

    card.innerHTML = '<div class="forecast-day">' + getDayLabel(dateString) + '</div><div class="forecast-icon">' + getWMO(weatherCode) + '</div><div class="forecast-temp">↑ ' + (maxT ?? '--') + '° / ↓ ' + (minT ?? '--') + '°</div>';
    container.appendChild(card);
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

function getDayLabel(dateString) {
  const target = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  const weekday = target.toLocaleDateString('ja-JP', { weekday: 'short' });
  const month = target.getMonth() + 1;
  const day = target.getDate();

  if (diff === 0) return '今日（' + weekday + '）';
  if (diff === 1) return '明日（' + weekday + '）';
  if (diff === 2) return '明後日（' + weekday + '）';
  return month + '月' + day + '日（' + weekday + '）';
}

function dateFormat(date, mode) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = addZero(d.getHours());
  const minute = addZero(d.getMinutes());
  const second = addZero(d.getSeconds());

  if (mode === 1) return year + '年' + month + '月' + day + '日 ' + hour + ':' + minute + ':' + second;
  return month + '月' + day + '日';
}

function addZero(n) {
  return n < 10 ? '0' + n : String(n);
}

function getWeatherDescription(w) {
  if (w === 0) return '快晴';
  if (w === 1) return '晴れ';
  if (w === 2) return '一部曇り';
  if (w === 3) return '曇り';
  if (w === 45 || w === 48) return '霧';
  if (w >= 51 && w <= 57) return '霧雨';
  if (w >= 61 && w <= 67) return '雨';
  if (w >= 71 && w <= 77) return '雪';
  if (w >= 80 && w <= 82) return 'にわか雨';
  if (w >= 85 && w <= 86) return 'にわか雪';
  if (w >= 95) return '雷雨';
  return '天気';
}

function getWMO(w) {
  if (w === 0) return '☀️';
  if (w === 1) return '🌤';
  if (w === 2) return '⛅️';
  if (w === 3) return '☁️';
  if (w === 45 || w === 48) return '🌫';
  if (w >= 51 && w <= 57) return '🌦';
  if (w >= 61 && w <= 67) return '🌧';
  if (w >= 71 && w <= 77) return '❄️';
  if (w >= 80 && w <= 82) return '🌦';
  if (w >= 85 && w <= 86) return '🌨';
  if (w >= 95) return '⛈';
  return '☁️';
}

function setWeatherScene(weatherCode, now) {
  const hour = now.getHours();
  const isNight = hour < 6 || hour >= 18;

  let scene = 'clear';
  if (isNight) {
    scene = 'night';
  } else if (weatherCode === 3 || weatherCode === 45 || weatherCode === 48 || weatherCode === 1 || weatherCode === 2) {
    scene = 'cloudy';
  } else if (weatherCode >= 51 && weatherCode <= 67 || weatherCode >= 80 && weatherCode <= 82 || weatherCode >= 95) {
    scene = 'rain';
  } else if (weatherCode >= 71 && weatherCode <= 77 || weatherCode >= 85 && weatherCode <= 86) {
    scene = 'snow';
  }

  document.body.className = scene;
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    alert('このブラウザでは位置情報が使えません。');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const loc = {
        name: '現在地',
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      saveCurrentLocation(loc);
      fetchWeather(loc);
      fetchHourlyWeather(loc);
      renderLocationList();
    },
    function () {
      alert('位置情報の取得に失敗しました。');
    }
  );
}

function setupSearch() {
  const input = document.getElementById('search-input');
  const button = document.getElementById('search-btn');
  if (!input || !button) return;

  button.addEventListener('click', function () {
    const value = input.value.trim();
    if (!value) return;
    searchLocationByName(value);
    input.value = '';
  });
}

window.addEventListener('DOMContentLoaded', function () {
  renderLocationList();
  setupSearch();

  const saved = sessionStorage.getItem('selectedWeatherLocation');
  if (saved) {
    try {
      const loc = JSON.parse(saved);
      document.getElementById('city-name').textContent = loc.name + 'の天気';
      fetchWeather(loc);
      fetchHourlyWeather(loc);
    } catch (e) {
      switchLocation(currentIndex);
    }
  } else {
    switchLocation(currentIndex);
  }

  const btn = document.getElementById('use-location-btn');
  if (btn) btn.addEventListener('click', useCurrentLocation);
});

setInterval(function () {
  setText('time', dateFormat(new Date(), 1));
}, 1000);

setInterval(function () {
  const locations = loadLocations();
  const loc = locations[currentIndex] || DEFAULT_LOCATIONS[0];
  if (loc) {
    fetchWeather(loc);
    fetchHourlyWeather(loc);
  }
}, 1000 * 60 * 60);
