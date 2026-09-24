const appName = 'Pulse Wave';
const defaultCoverUrl = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&q=80';

let apiHost = 'https://discoveryprovider.audius.co';
let activeTracks = [];
let searchResults = [];
let favoriteTracks = [];
let tracksList = null;
let heroBanner = null;
let heroTitle = null;
let heroDescription = null;
let heroButton = null;
let searchInput = null;
let searchResultsBox = null;
let genresSection = null;
let loadMoreButton = null;
let tracksOffset = 0;
let tracksLimit = 20;

const localTracks = [
    { id: 1, title: 'Electric Moonlight', artist: 'Neon Horizon', album: 'After Dark', duration: '3:45', genre: 'Електроніка', cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80', stream: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { id: 2, title: 'Digital Soul', artist: 'Chrome Static', album: 'The Grid', duration: '4:12', genre: 'Електроніка', cover: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=300&q=80', stream: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
    { id: 3, title: 'Rainy Rooftops', artist: 'Lo-fi Echo', album: 'Cozy Vibes', duration: '2:58', genre: 'Лоу-фай', cover: 'https://images.unsplash.com/photo-1515462277126-270d878326e5?w=300&q=80', stream: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { id: 4, title: 'Midnight Lofi', artist: 'Chill Beats', album: 'Night Sessions', duration: '3:22', genre: 'Лоу-фай', cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80', stream: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
    { id: 5, title: 'Starlight Orbit', artist: 'Cosmic Voyager', album: 'Deep Space', duration: '4:05', genre: 'Електроніка', cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80', stream: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
    { id: 6, title: 'Neon Pulse', artist: 'Hyperion Dreams', album: 'Hyperion Dreams', duration: '3:30', genre: 'Поп', cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&q=80', stream: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' }
];

window.appName = appName;
window.apiHost = apiHost;
window.localTracks = localTracks;

function getSavedFavorites() {
    try {
        const saved = localStorage.getItem('favoriteTracks');

        if (saved) {
            favoriteTracks = JSON.parse(saved);
        }
    } catch (error) {
        favoriteTracks = [];
    }
}

function saveFavorites() {
    try {
        localStorage.setItem('favoriteTracks', JSON.stringify(favoriteTracks));
    } catch (error) {
    }
}

function getCoverUrl(track) {
    if (track.artwork && track.artwork['150x150']) {
        return track.artwork['150x150'];
    }

    if (track.cover) {
        return track.cover;
    }

    return defaultCoverUrl;
}

function getArtistName(track) {
    if (track.user && track.user.name) {
        return track.user.name;
    }

    if (track.artist) {
        return track.artist;
    }

    return 'Невідомий';
}

function getAlbumName(track) {
    return track.album || track.genre || '';
}

function formatTrackTime(seconds) {
    if (typeof seconds === 'string') {
        return seconds;
    }

    if (!seconds || isNaN(seconds)) {
        return '0:00';
    }

    const minutes = Math.floor(seconds / 60);
    const restSeconds = Math.floor(seconds % 60);

    if (restSeconds < 10) {
        return minutes + ':0' + restSeconds;
    }

    return minutes + ':' + restSeconds;
}

function isSameTrack(firstTrack, secondTrack) {
    if (firstTrack.id && secondTrack.id) {
        return String(firstTrack.id) === String(secondTrack.id);
    }

    return firstTrack.title === secondTrack.title;
}

function isFavorite(track) {
    for (let i = 0; i < favoriteTracks.length; i++) {
        if (isSameTrack(favoriteTracks[i], track)) {
            return true;
        }
    }

    return false;
}

function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
}

function createSongRow(track, number, list, index, action) {
    const rowTag = action === 'play' ? 'li' : 'div';
    const row = document.createElement(rowTag);
    const cover = document.createElement('img');
    const info = document.createElement('div');
    const button = document.createElement('button');
    const icon = document.createElement('span');

    row.className = 'song-row';
    row.style.cursor = 'pointer';

    cover.className = 'song-cover';
    cover.src = getCoverUrl(track);
    cover.alt = 'cover';

    info.className = 'song-info';
    info.appendChild(createTextElement('div', 'song-title', track.title || 'Без назви'));
    info.appendChild(createTextElement('div', 'song-artist', getArtistName(track)));

    icon.className = 'material-symbols-outlined';
    button.className = 'song-action-btn';
    button.appendChild(icon);

    if (action === 'favorite') {
        icon.textContent = 'favorite';

        if (isFavorite(track)) {
            icon.style.fontVariationSettings = "'FILL' 1";
            icon.style.color = '#ff6b9d';
        }

        button.addEventListener('click', function(event) {
            toggleFavorite(event, button, track);
        });
    } else {
        icon.textContent = 'play_arrow';
    }

    row.appendChild(createTextElement('div', 'song-num', number));
    row.appendChild(cover);
    row.appendChild(info);
    row.appendChild(createTextElement('div', 'song-album', getAlbumName(track)));
    row.appendChild(createTextElement('div', 'song-duration', formatTrackTime(track.duration)));
    row.appendChild(button);

    row.addEventListener('click', function() {
        setTrackList(list, index);
        playSong(track);
    });

    return row;
}

function showTracks(tracks) {
    tracksList.innerHTML = '';
    activeTracks = tracks;
    setTrackList(activeTracks, 0);

    for (let i = 0; i < activeTracks.length; i++) {
        tracksList.appendChild(createSongRow(activeTracks[i], i + 1, activeTracks, i, 'play'));
    }
}

function addTracks(tracks) {
    const oldLength = activeTracks.length;

    for (let i = 0; i < tracks.length; i++) {
        activeTracks.push(tracks[i]);
        tracksList.appendChild(createSongRow(tracks[i], oldLength + i + 1, activeTracks, oldLength + i, 'play'));
    }

    setTrackList(activeTracks, 0);
}

function updateHero(track) {
    if (!track) {
        return;
    }

    heroTitle.textContent = track.title || '';
    heroDescription.textContent = 'Найактуальніший хіт від ' + getArtistName(track);
    heroBanner.style.backgroundImage = 'linear-gradient(rgba(27,12,43,0.6), rgba(27,12,43,0.95)), url(' + getCoverUrl(track) + ')';

    if (heroButton) {
        heroButton.onclick = function() {
            setTrackList(activeTracks, 0);
            playSong(track);
        };
    }
}

function getTracksFromApiResult(result) {
    if (Array.isArray(result)) {
        return result;
    }

    if (result && Array.isArray(result.data)) {
        return result.data;
    }

    return [];
}

async function loadApiHost() {
    try {
        const response = await fetch('https://api.audius.co');
        const hosts = await response.json();

        if (hosts.length > 0) {
            apiHost = hosts[Math.floor(Math.random() * hosts.length)];
            window.apiHost = apiHost;
        }
    } catch (error) {
    }
}

async function loadTrendingTracks() {
    try {
        tracksOffset = 0;
        const url = apiHost + '/v1/tracks/trending?app_name=' + encodeURIComponent(appName) + '&limit=' + tracksLimit + '&offset=' + tracksOffset;
        const response = await fetch(url);
        const result = await response.json();
        const tracks = getTracksFromApiResult(result);

        if (tracks.length > 0) {
            showTracks(tracks);
            updateHero(tracks[0]);
            tracksOffset = tracksOffset + tracks.length;
        }
    } catch (error) {
    }
}

async function loadMoreTracks() {
    if (!loadMoreButton) {
        return;
    }

    loadMoreButton.disabled = true;
    loadMoreButton.textContent = 'Завантаження...';

    try {
        const url = apiHost + '/v1/tracks/trending?app_name=' + encodeURIComponent(appName) + '&limit=' + tracksLimit + '&offset=' + tracksOffset;
        const response = await fetch(url);
        const result = await response.json();
        const tracks = getTracksFromApiResult(result);

        if (tracks.length > 0) {
            addTracks(tracks);
            tracksOffset = tracksOffset + tracks.length;
            loadMoreButton.disabled = false;
            loadMoreButton.textContent = 'Показати більше';
        } else {
            loadMoreButton.style.display = 'none';
        }
    } catch (error) {
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = 'Показати більше';
    }
}

function showSearchBlocks(showSearch) {
    const trendsSection = document.getElementById('trends-section');

    if (showSearch) {
        searchResultsBox.style.display = 'block';
        genresSection.style.display = 'none';

        if (trendsSection) {
            trendsSection.style.display = 'none';
        }
    } else {
        searchResultsBox.style.display = 'none';
        genresSection.style.display = 'block';

        if (trendsSection) {
            trendsSection.style.display = 'block';
        }
    }
}

function searchLocalTracks(query) {
    const foundTracks = [];

    for (let i = 0; i < localTracks.length; i++) {
        const track = localTracks[i];
        const title = track.title.toLowerCase();
        const artist = track.artist.toLowerCase();
        const genre = track.genre.toLowerCase();

        if (title.includes(query) || artist.includes(query) || genre.includes(query)) {
            foundTracks.push(track);
        }
    }

    return foundTracks;
}

async function searchApiTracks(query) {
    try {
        const url = apiHost + '/v1/tracks/search?query=' + encodeURIComponent(query) + '&app_name=' + encodeURIComponent(appName) + '&limit=15';
        const response = await fetch(url);
        const result = await response.json();
        return getTracksFromApiResult(result);
    } catch (error) {
        return [];
    }
}

async function performSearch() {
    const query = searchInput.value.trim().toLowerCase();

    if (query === '') {
        showSearchBlocks(false);
        return;
    }

    showSearchBlocks(true);
    searchResultsBox.innerHTML = '<div style="padding: 20px; text-align: center; color: #cbc3da;">Пошук музики...</div>';

    const localResults = searchLocalTracks(query);
    const apiResults = await searchApiTracks(query);

    showSearchResults(localResults, apiResults);
}

function addSearchTitle(text) {
    const title = document.createElement('h3');
    title.style.cssText = 'margin: 16px 0 8px 0; font-size: 16px; color: #ff6b9d; font-weight: 600;';
    title.textContent = text;
    searchResultsBox.appendChild(title);
}

function addSearchList(tracks) {
    const list = document.createElement('div');
    list.className = 'song-list';

    for (let i = 0; i < tracks.length; i++) {
        searchResults.push(tracks[i]);
        list.appendChild(createSongRow(tracks[i], searchResults.length, searchResults, searchResults.length - 1, 'favorite'));
    }

    searchResultsBox.appendChild(list);
}

function showSearchResults(localResults, apiResults) {
    searchResults = [];
    searchResultsBox.innerHTML = '';

    if (localResults.length === 0 && apiResults.length === 0) {
        searchResultsBox.innerHTML = '<div style="padding: 20px; text-align: center; color: #dcbfc7;">Нічого не знайдено.</div>';
        return;
    }

    if (localResults.length > 0) {
        addSearchTitle('У вашій бібліотеці');
        addSearchList(localResults);
    }

    if (apiResults.length > 0) {
        addSearchTitle('Результати з мережі');
        addSearchList(apiResults);
    }
}

function quickSearch(keyword) {
    searchInput.value = keyword;
    performSearch();
}

function setActiveLibraryTab(tabName) {
    const buttons = document.querySelectorAll('.tab-btn');
    let activeIndex = 0;

    if (tabName === 'playlist') {
        activeIndex = 1;
    }

    if (tabName === 'favorites') {
        activeIndex = 2;
    }

    for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('active');
    }

    if (buttons[activeIndex]) {
        buttons[activeIndex].classList.add('active');
    }
}

function switchLibraryTab(tabName) {
    const libraryList = document.getElementById('library-songs-list');
    let tracks = localTracks;

    setActiveLibraryTab(tabName);
    libraryList.innerHTML = '';

    if (tabName === 'favorites') {
        tracks = favoriteTracks;
    }

    if (tracks.length === 0) {
        libraryList.innerHTML = '<p style="color: var(--text-muted); padding: 24px; text-align: center;">Тут порожньо</p>';
        return;
    }

    for (let i = 0; i < tracks.length; i++) {
        libraryList.appendChild(createSongRow(tracks[i], i + 1, tracks, i, 'favorite'));
    }
}

function findTrackInRow(button) {
    const row = button.closest('.song-row');

    if (!row) {
        return null;
    }

    const title = row.querySelector('.song-title');

    if (!title) {
        return null;
    }

    for (let i = 0; i < localTracks.length; i++) {
        if (localTracks[i].title === title.textContent) {
            return localTracks[i];
        }
    }

    return null;
}

function toggleFavorite(event, button, track) {
    if (event) {
        event.stopPropagation();
    }

    const selectedTrack = track || findTrackInRow(button);

    if (!selectedTrack) {
        return;
    }

    const icon = button.querySelector('span');
    let favoriteIndex = -1;

    for (let i = 0; i < favoriteTracks.length; i++) {
        if (isSameTrack(favoriteTracks[i], selectedTrack)) {
            favoriteIndex = i;
        }
    }

    if (favoriteIndex === -1) {
        favoriteTracks.push(selectedTrack);

        if (icon) {
            icon.style.fontVariationSettings = "'FILL' 1";
            icon.style.color = '#ff6b9d';
        }
    } else {
        favoriteTracks.splice(favoriteIndex, 1);

        if (icon) {
            icon.style.fontVariationSettings = '';
            icon.style.color = '';
        }
    }

    saveFavorites();

    const activeTab = document.querySelector('.tab-btn.active');

    if (activeTab && activeTab.textContent.trim() === 'Улюблені') {
        switchLibraryTab('favorites');
    }
}

async function startApp() {
    tracksList = document.getElementById('tracks-list');
    heroBanner = document.querySelector('.hero-banner');
    heroTitle = document.querySelector('.hero-title');
    heroDescription = document.querySelector('.hero-desc');
    heroButton = document.querySelector('.btn-play-hero');
    searchInput = document.getElementById('search-input');
    searchResultsBox = document.getElementById('search-results-container');
    genresSection = document.getElementById('genres-section');
    loadMoreButton = document.getElementById('load-more-tracks');

    getSavedFavorites();
    showTracks(localTracks);
    updateHero(localTracks[0]);
    switchLibraryTab('all');

    searchInput.addEventListener('input', performSearch);

    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', loadMoreTracks);
    }

    await loadApiHost();
    await loadTrendingTracks();
}

document.addEventListener('DOMContentLoaded', startApp);

window.performSearch = performSearch;
window.quickSearch = quickSearch;
window.switchLibraryTab = switchLibraryTab;
window.toggleFavorite = toggleFavorite;
