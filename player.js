const playerAppName = 'Pulse Wave';
const defaultApiHost = 'https://discoveryprovider.audius.co';
const defaultCover = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&q=80';
let audio = null;
let progressBar = null;
let volumeBar = null;
let currentTimeText = null;
let totalTimeText = null;
let currentTitle = null;
let currentArtist = null;
let currentCover = null;
let playButton = null;
let trackList = [];
let trackIndex = 0;
let shuffleEnabled = false;
let repeatEnabled = false;
let currentTrack = null;

function getPlayerApiHost() { return window.apiHost || defaultApiHost; }
function formatPlayerTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const restSeconds = Math.floor(seconds % 60);
    return minutes + ':' + (restSeconds < 10 ? '0' : '') + restSeconds;
}
function getPlayerCover(track) {
    if (track.artwork && track.artwork['150x150']) return track.artwork['150x150'];
    return track.cover || defaultCover;
}
function getPlayerArtist(track) {
    if (track.user && track.user.name) return track.user.name;
    return track.artist || 'Невідомий';
}
function getTrackStreamUrl(track) {
    if (!track) return '';
    if (typeof track.stream === 'string') return track.stream;
    if (track.stream && track.stream.url) return track.stream.url;
    if (track.stream_url) return track.stream_url;
    if (track.id) return getPlayerApiHost() + '/v1/tracks/' + track.id + '/stream?app_name=' + encodeURIComponent(playerAppName);
    return '';
}
function findTrackByTitle(title) {
    const lowerTitle = title.toLowerCase();
    const lists = [trackList, window.localTracks || []];
    for (let listIndex = 0; listIndex < lists.length; listIndex++) {
        const list = lists[listIndex];
        for (let i = 0; i < list.length; i++) {
            if (list[i].title && list[i].title.toLowerCase() === lowerTitle) {
                trackList = list;
                trackIndex = i;
                return list[i];
            }
        }
    }
    return null;
}
function findTrack(track) {
    if (typeof track === 'string') return findTrackByTitle(track);
    if (!track) return null;
    for (let i = 0; i < trackList.length; i++) {
        const item = trackList[i];
        if ((item.id && track.id && String(item.id) === String(track.id)) ||
            (item.title && track.title && item.title.toLowerCase() === track.title.toLowerCase())) {
            trackIndex = i;
            return item;
        }
    }
    return track;
}
function updatePlayer(track) {
    if (!track) return;
    currentTitle.textContent = track.title || '';
    currentArtist.textContent = getPlayerArtist(track);
    currentCover.src = getPlayerCover(track);
}
function updatePlayIcon() {
    if (!playButton) return;
    const icon = playButton.querySelector('span');
    if (icon) icon.textContent = audio && !audio.paused ? 'pause' : 'play_arrow';
}
function playCurrentAudio() { audio.play().then(updatePlayIcon).catch(updatePlayIcon); }
function playSong(track) {
    if (!audio) initializePlayer();
    const foundTrack = findTrack(track);
    if (!foundTrack) return;
    const streamUrl = getTrackStreamUrl(foundTrack);
    if (!streamUrl) return;
    currentTrack = foundTrack;
    updatePlayer(foundTrack);
    audio.src = streamUrl;
    updateProgress();
    playCurrentAudio();
    window.dispatchEvent(new CustomEvent('trackchange', { detail: foundTrack }));
}
function getCurrentTrack() { return currentTrack; }
function togglePlay() {
    if (!audio) initializePlayer();
    if (!audio.src && trackList.length > 0) playSong(trackList[trackIndex] || trackList[0]);
    else if (audio.paused) playCurrentAudio();
    else { audio.pause(); updatePlayIcon(); }
}
function playNext() {
    if (Array.isArray(window.queueTracks) && window.queueTracks.length > 0) {
        const nextQueuedTrack = window.queueTracks.shift();
        window.dispatchEvent(new CustomEvent('queuechange'));
        playSong(nextQueuedTrack);
        return;
    }
    if (trackList.length === 0) return;
    if (shuffleEnabled && trackList.length > 1) {
        let nextIndex = trackIndex;
        while (nextIndex === trackIndex) nextIndex = Math.floor(Math.random() * trackList.length);
        trackIndex = nextIndex;
    } else trackIndex = (trackIndex + 1) % trackList.length;
    playSong(trackList[trackIndex]);
}
function playPrevious() {
    if (trackList.length === 0) return;
    if (shuffleEnabled && trackList.length > 1) {
        let previousIndex = trackIndex;
        while (previousIndex === trackIndex) previousIndex = Math.floor(Math.random() * trackList.length);
        trackIndex = previousIndex;
    } else trackIndex = (trackIndex - 1 + trackList.length) % trackList.length;
    playSong(trackList[trackIndex]);
}
function updateRangeVisual(range, value, color) {
    if (!range) return;
    const percentage = Math.max(0, Math.min(100, Number(value) || 0));
    range.value = percentage;
    range.style.setProperty('background', 'linear-gradient(to right, ' + color + ' 0%, ' + color + ' ' + percentage + '%, rgba(255,255,255,0.22) ' + percentage + '%, rgba(255,255,255,0.22) 100%)', 'important');
}
function updateProgressVisual(value) { updateRangeVisual(progressBar, value, 'var(--primary-light)'); }
function updateVolumeVisual(value) { updateRangeVisual(volumeBar, value, 'var(--primary-light)'); }
function seekTrack(value) {
    if (audio && isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = audio.duration * (Number(value) / 100);
        updateProgress();
    }
}
function changeVolume(value) {
    const percentage = Math.max(0, Math.min(100, Number(value) || 0));
    if (audio) audio.volume = percentage / 100;
    updateVolumeVisual(percentage);
}
function setButtonActive(buttonId, isActive) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.style.color = isActive ? '#ff6b9d' : '';
    button.style.fontWeight = isActive ? 'bold' : '';
}
function toggleShuffle() { shuffleEnabled = !shuffleEnabled; setButtonActive('shuffle-icon', shuffleEnabled); }
function toggleRepeat() { repeatEnabled = !repeatEnabled; setButtonActive('repeat-icon', repeatEnabled); }
function updateProgress() {
    if (!audio) return;
    const duration = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (currentTrack && Number(currentTrack.duration)) || 0;
    const currentTime = isFinite(audio.currentTime) ? audio.currentTime : 0;
    updateProgressVisual(duration > 0 ? currentTime / duration * 100 : 0);
    currentTimeText.textContent = formatPlayerTime(currentTime);
    totalTimeText.textContent = formatPlayerTime(duration);
}
function onSongEnded() {
    updateProgressVisual(100);
    updatePlayIcon();
    if (repeatEnabled) { audio.currentTime = 0; playCurrentAudio(); } else playNext();
}
function setTrackList(tracks, startIndex) {
    if (!Array.isArray(tracks)) return;
    trackList = tracks;
    trackIndex = startIndex || 0;
}
function navigateTo(pageName, event) {
    if (event) event.preventDefault();
    document.querySelectorAll('.view').forEach(function(view) { view.classList.remove('active'); });
    const currentView = document.getElementById('view-' + pageName);
    if (currentView) currentView.classList.add('active');
    const buttons = document.querySelectorAll('aside nav .nav-btn');
    buttons.forEach(function(button) { button.classList.remove('active'); });
    const indexes = { home: 0, search: 1, library: 2 };
    if (buttons[indexes[pageName]]) buttons[indexes[pageName]].classList.add('active');
}
function initializePlayer() {
    audio = document.getElementById('audio');
    progressBar = document.getElementById('progress-bar');
    volumeBar = document.querySelector('.volume-controls input[type="range"]');
    currentTimeText = document.getElementById('current-time');
    totalTimeText = document.getElementById('total-time');
    currentTitle = document.getElementById('current-title');
    currentArtist = document.getElementById('current-artist');
    currentCover = document.getElementById('current-cover');
    playButton = document.getElementById('play-btn');
    if (!audio) { audio = document.createElement('audio'); audio.id = 'audio'; audio.preload = 'metadata'; document.body.appendChild(audio); }
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('durationchange', updateProgress);
    audio.addEventListener('seeked', updateProgress);
    audio.addEventListener('play', updatePlayIcon);
    audio.addEventListener('pause', updatePlayIcon);
    audio.addEventListener('ended', onSongEnded);
    changeVolume(volumeBar ? volumeBar.value : 75);
    updateProgress();
    updatePlayIcon();
}
