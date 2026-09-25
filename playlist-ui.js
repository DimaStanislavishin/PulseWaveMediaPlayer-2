/* Playlist UI and synchronization for dynamically rendered local/API tracks. */
(function () {
    'use strict';

    var STORAGE_KEY = 'pulseWavePlaylists';
    var COVER_KEY = 'pulseWavePlaylistCovers';
    var DEFAULT_COVER = 'playlist.jpeg';
    var picker = null;
    var activeTrack = null;

    function read(key, fallback) {
        try {
            var value = JSON.parse(localStorage.getItem(key));
            return value && typeof value === 'object' ? value : fallback;
        } catch (error) { return fallback; }
    }
    function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
    function getPlaylists() { return read(STORAGE_KEY, {}); }
    function trackKey(track) { return track && track.id ? String(track.id) : String(track && track.title || ''); }
    function sameTrack(a, b) { return trackKey(a) === trackKey(b); }
    function artistOf(track) { return track && (track.artist || (track.user && track.user.name)) || ''; }
    function coverOf(track) { return track && (track.cover || (track.artwork && track.artwork['150x150'])) || DEFAULT_COVER; }
    function playlistCover(name, tracks) {
        var covers = read(COVER_KEY, {});
        return covers[name] || coverOf(tracks[0]);
    }

    function notify(text) {
        var node = document.querySelector('.playlist-toast');
        if (!node) {
            node = document.createElement('div');
            node.className = 'playlist-toast';
            document.body.appendChild(node);
        }
        node.textContent = text;
        node.classList.add('visible');
        clearTimeout(notify.timer);
        notify.timer = setTimeout(function () { node.classList.remove('visible'); }, 2800);
    }

    function closePicker() {
        if (picker) picker.remove();
        picker = null;
    }

    function availableTracks() {
        var lists = [];
        try { if (Array.isArray(localTracks)) lists.push(localTracks); } catch (error) {}
        try { if (Array.isArray(activeTracks)) lists.push(activeTracks); } catch (error) {}
        try { if (Array.isArray(searchResults)) lists.push(searchResults); } catch (error) {}
        return lists;
    }

    function trackFromRow(row) {
        if (row && row._playlistTrack) return row._playlistTrack;
        var titleNode = row && row.querySelector('.song-title');
        var artistNode = row && row.querySelector('.song-artist');
        if (!titleNode) return null;
        var title = titleNode.textContent;
        var artist = artistNode ? artistNode.textContent : '';
        var lists = availableTracks();
        for (var i = 0; i < lists.length; i++) {
            for (var j = 0; j < lists[i].length; j++) {
                if (lists[i][j].title === title && (!artist || artistOf(lists[i][j]) === artist)) return lists[i][j];
            }
        }
        return { title: title, artist: artist };
    }

    function addButtonsToRows() {
        document.querySelectorAll('.song-row').forEach(function (row) {
            if (row.querySelector('[data-playlist-action]')) return;
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'song-action-btn playlist-action-btn';
            button.dataset.playlistAction = 'true';
            button.title = 'Add to playlist';
            button.setAttribute('aria-label', 'Add to playlist');
            button.innerHTML = '<span class="material-symbols-outlined">queue_music</span>';
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                openPicker(trackFromRow(row));
            });
            row.appendChild(button);
        });
    }

    function saveTrack(playlistName) {
        var data = getPlaylists();
        if (!data[playlistName]) data[playlistName] = [];
        if (data[playlistName].some(function (track) { return sameTrack(track, activeTrack); })) {
            notify('This track is already in the playlist \"' + playlistName + '\"');
            closePicker();
            return;
        }
        data[playlistName].push(activeTrack);
        write(STORAGE_KEY, data);
        renderCards();
        notify('Track \"' + (activeTrack.title || 'Untitled') + '\" added to the playlist');
        closePicker();
    }

    function createPlaylist() {
        var data = getPlaylists();
        var name = window.prompt('Playlist name:', activeTrack && activeTrack.title || 'New playlist');
        if (!name || !name.trim()) return;
        name = name.trim();
        if (data[name]) { notify('A playlist with this name already exists'); return; }
        data[name] = activeTrack ? [activeTrack] : [];
        write(STORAGE_KEY, data);
        renderCards();
        closePicker();
    }

    function openPicker(track) {
        if (!track) return;
        activeTrack = track;
        closePicker();
        picker = document.createElement('div');
        picker.className = 'playlist-picker-backdrop';
        picker.innerHTML = '<section class="playlist-picker" role="dialog" aria-modal="true"><div class="playlist-picker-left"><input class="playlist-search" type="search" placeholder="Search playlists..." /><div class="playlist-picker-list"></div></div><div class="playlist-picker-right"><div class="playlist-picker-header"><span>Selected track</span><button class="playlist-picker-close" type="button" aria-label="Close">×</button></div><div class="playlist-selected-track"></div><button class="playlist-create" type="button">Create new playlist</button><div class="playlist-choice-list"></div></div></section>';
        document.body.appendChild(picker);
        picker.querySelector('.playlist-selected-track').textContent = activeTrack.title || 'Untitled';
        picker.querySelector('.playlist-picker-close').addEventListener('click', closePicker);
        picker.addEventListener('click', function (event) { if (event.target === picker) closePicker(); });
        picker.querySelector('.playlist-create').addEventListener('click', createPlaylist);

        function render(filter) {
            var data = getPlaylists();
            var items = Object.keys(data).filter(function (name) { return name.toLowerCase().indexOf(String(filter || '').toLowerCase()) !== -1; });
            ['.playlist-picker-list', '.playlist-choice-list'].forEach(function (selector) {
                var list = picker.querySelector(selector);
                list.innerHTML = '';
                items.forEach(function (name) {
                    var button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'playlist-choice';
                    button.innerHTML = '<span class="material-symbols-outlined">queue_music</span><span><b></b><small></small></span>';
                    button.querySelector('b').textContent = name;
                    button.querySelector('small').textContent = data[name].length + ' track(s)';
                    button.addEventListener('click', function () { saveTrack(name); });
                    list.appendChild(button);
                });
            });
        }
        picker.querySelector('.playlist-search').addEventListener('input', function (event) { render(event.target.value); });
        render('');
    }

    function openPlaylist(name) {
        var data = getPlaylists();
        if (!data[name]) return;
        var tracks = data[name];
        var view = document.getElementById('playlist-detail-view') || document.createElement('div');
        view.id = 'playlist-detail-view';
        view.className = 'playlist-detail-view';
        view.innerHTML = '<div class="playlist-detail-header"><button class="playlist-back" type="button">← Library</button><button class="playlist-detail-more" type="button"><span class="material-symbols-outlined">delete</span></button></div><div class="playlist-detail-body"><img class="playlist-detail-cover"><div class="playlist-detail-info"><h1></h1><div class="playlist-detail-meta"></div><button class="playlist-add-track" type="button">Add track</button></div></div><div class="playlist-detail-list"></div>';
        if (!view.parentNode) document.body.appendChild(view);
        view.querySelector('.playlist-detail-cover').src = playlistCover(name, tracks);
        view.querySelector('h1').textContent = name;
        view.querySelector('.playlist-detail-meta').textContent = tracks.length + ' track(s)';
        view.querySelector('.playlist-back').addEventListener('click', function () { view.remove(); });
        view.querySelector('.playlist-add-track').addEventListener('click', function () {
    // Close the playlist details screen
    view.remove();

    // Navigate to the Home page
    if (typeof window.navigateTo === 'function') {
        window.navigateTo('home');
    } else {
        // Fallback navigation if navigateTo is unavailable
        document.querySelectorAll('.view').forEach(function (page) {
            page.classList.remove('active');
        });

        var homeView = document.getElementById('view-home');

        if (homeView) {
            homeView.classList.add('active');
        }

        document.querySelectorAll('aside nav .nav-btn').forEach(function (button) {
            button.classList.remove('active');
        });

        var homeButton = document.querySelector(
            'aside nav .nav-btn[onclick*="home"]'
        );

        if (homeButton) {
            homeButton.classList.add('active');
        }
    }

    // Scroll to the top of the Home page
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});
        view.querySelector('.playlist-detail-more').addEventListener('click', function () {
            if (window.confirm('Delete playlist \"' + name + '\"?')) { delete data[name]; write(STORAGE_KEY, data); view.remove(); renderCards(); }
        });
        var list = view.querySelector('.playlist-detail-list');
        tracks.forEach(function (track, index) {
            var row = document.createElement('div');
            row.className = 'playlist-detail-row';
            row.innerHTML = '<span>' + (index + 1) + '</span><img><div><b></b><small></small></div><button class="playlist-remove-track" type="button">×</button>';
            row.querySelector('img').src = coverOf(track);
            row.querySelector('b').textContent = track.title || 'Untitled';
            row.querySelector('small').textContent = artistOf(track);
            row.addEventListener('click', function (event) { if (!event.target.closest('button') && window.playSong) { window.setTrackList(tracks, index); window.playSong(track); } });
            row.querySelector('button').addEventListener('click', function () { tracks.splice(index, 1); write(STORAGE_KEY, data); openPlaylist(name); renderCards(); });
            list.appendChild(row);
        });
    }

    function renderCards() {
        var container = document.getElementById('library-playlists');
        if (!container) return;
        container.querySelectorAll('[data-user-playlist]').forEach(function (node) { node.remove(); });
        var data = getPlaylists();
        Object.keys(data).forEach(function (name) {
            var card = document.createElement('div');
            card.className = 'card user-playlist-card';
            card.dataset.userPlaylist = name;
            card.innerHTML = '<div class="card-img-wrapper"><img class="card-img"></div><div class="card-title"></div><div class="card-subtitle"></div>';
            card.querySelector('img').src = playlistCover(name, data[name]);
            card.querySelector('.card-title').textContent = name;
            card.querySelector('.card-subtitle').textContent = data[name].length + ' track(s)';
            card.addEventListener('click', function () { openPlaylist(name); });
            container.appendChild(card);
        });
    }

    var style = document.createElement('style');
    style.textContent = '.playlist-action-btn{margin-left:8px}.playlist-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:3000;background:#191923;color:#fff;padding:12px 18px;border-radius:999px;opacity:0;pointer-events:none;transition:opacity .2s ease}.playlist-toast.visible{opacity:1}.playlist-picker-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:2500}.playlist-picker{width:min(680px,92vw);background:#1b1c23;border:1px solid rgba(255,255,255,.06);border-radius:22px;padding:18px;display:grid;grid-template-columns:1.2fr 1fr;gap:16px;box-shadow:0 18px 50px rgba(0,0,0,.5)}.playlist-picker-left,.playlist-picker-right{display:flex;flex-direction:column;gap:12px}.playlist-search{background:#0f1016;border:1px solid rgba(255,255,255,.08);color:#fff;border-radius:12px;padding:12px 14px;outline:none}.playlist-picker-list,.playlist-choice-list{display:flex;flex-direction:column;gap:8px;max-height:250px;overflow:auto}.playlist-choice{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);color:#fff;border-radius:12px;padding:10px 12px;text-align:left}.playlist-choice span:first-child{color:var(--primary-light)}.playlist-choice b,.playlist-picker-header span,.playlist-selected-track{display:block}.playlist-picker-header{display:flex;justify-content:space-between;align-items:center;color:#b7b3c5}.playlist-picker-close{background:none;border:none;color:#fff;font-size:26px;cursor:pointer}.playlist-selected-track{background:rgba(255,255,255,.03);border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,.06);font-weight:600}.playlist-create{background:linear-gradient(135deg,var(--primary-color),#854dff);border:none;color:#fff;padding:10px 14px;border-radius:12px;font-weight:700;cursor:pointer}.playlist-detail-view{position:fixed;inset:0;background:rgba(11,12,18,.96);z-index:2400;padding:24px;overflow:auto}.playlist-detail-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.playlist-back,.playlist-detail-more{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#fff;border-radius:12px;padding:10px 14px;cursor:pointer}.playlist-detail-body{display:flex;gap:20px;align-items:center;margin-bottom:20px}.playlist-detail-cover{width:180px;height:180px;object-fit:cover;border-radius:18px}.playlist-detail-info h1{margin:0 0 8px;font-size:2rem}.playlist-detail-meta{color:#b7b3c5;margin-bottom:12px}.playlist-add-track{background:linear-gradient(135deg,#ff6b9d,#ff8d5c);border:none;color:#fff;padding:10px 18px;border-radius:12px;font-weight:700;cursor:pointer}.playlist-detail-list{display:flex;flex-direction:column;gap:10px}.playlist-detail-row{display:grid;grid-template-columns:34px 52px 1fr 40px;align-items:center;gap:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:8px 12px}.playlist-detail-row img{width:52px;height:52px;object-fit:cover;border-radius:10px}.playlist-detail-row b{display:block}.playlist-detail-row small{color:#b7b3c5}.playlist-remove-track{background:none;border:none;color:#fff;font-size:22px;cursor:pointer}';
    document.head.appendChild(style);

    function initialize() {
        if (!Object.keys(getPlaylists()).length) write(STORAGE_KEY, { 'My collection': [] });
        renderCards();
        addButtonsToRows();
        var observer = new MutationObserver(function () { addButtonsToRows(); });
        var target = document.getElementById('tracks-list') || document.body;
        observer.observe(target, { childList: true, subtree: true });
    }

    document.addEventListener('DOMContentLoaded', initialize);
    window.openPlaylistPicker = openPicker;
    window.renderPlaylistCards = renderCards;
    window.ensurePlaylistButtons = addButtonsToRows;
})();
