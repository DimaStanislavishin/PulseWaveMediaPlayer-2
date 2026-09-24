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
            button.title = 'Добавить в плейлист';
            button.setAttribute('aria-label', 'Добавить в плейлист');
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
            notify('Трек уже есть в плейлисте «' + playlistName + '»');
            closePicker();
            return;
        }
        data[playlistName].push(activeTrack);
        write(STORAGE_KEY, data);
        renderCards();
        notify('Трек «' + (activeTrack.title || 'Без названия') + '» добавлен в плейлист');
        closePicker();
    }

    function createPlaylist() {
        var data = getPlaylists();
        var name = window.prompt('Название плейлиста:', activeTrack && activeTrack.title || 'Новый плейлист');
        if (!name || !name.trim()) return;
        name = name.trim();
        if (data[name]) { notify('Плейлист с таким названием уже существует'); return; }
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
        picker.innerHTML = '<section class="playlist-picker" role="dialog" aria-modal="true"><div class="playlist-picker-left"><input class="playlist-search" type="search" placeholder="Поиск плейлиста"><button class="playlist-create" type="button"><span class="material-symbols-outlined">add</span>Новый плейлист</button><div class="playlist-picker-list"></div></div><div class="playlist-picker-right"><button class="playlist-picker-close" type="button">×</button><h3>Добавить в плейлист</h3><p class="playlist-selected-track"></p><div class="playlist-choice-list"></div></div></section>';
        document.body.appendChild(picker);
        picker.querySelector('.playlist-selected-track').textContent = activeTrack.title || 'Без названия';
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
                    button.querySelector('small').textContent = data[name].length + ' трек(ов)';
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
        view.innerHTML = '<div class="playlist-detail-header"><button class="playlist-back" type="button">← Бібліотека</button><button class="playlist-detail-more" type="button"><span class="material-symbols-outlined">more_horiz</span></button></div><div class="playlist-detail-cover-wrap"><img class="playlist-detail-cover" alt=""></div><div class="playlist-detail-copy"><h1></h1><p class="playlist-detail-meta"></p></div><div class="playlist-detail-actions"><button class="playlist-add-track" type="button">+ Додати трек</button></div><div class="playlist-detail-list"></div>';
        if (!view.parentNode) document.body.appendChild(view);
        view.querySelector('.playlist-detail-cover').src = playlistCover(name, tracks);
        view.querySelector('h1').textContent = name;
        view.querySelector('.playlist-detail-meta').textContent = tracks.length + ' трек(ів)';
        view.querySelector('.playlist-back').addEventListener('click', function () { view.remove(); });
        view.querySelector('.playlist-add-track').addEventListener('click', function () { if (window.localTracks && window.localTracks[0]) openPicker(window.localTracks[0]); });
        view.querySelector('.playlist-detail-more').addEventListener('click', function () {
            if (window.confirm('Удалить плейлист «' + name + '»?')) { delete data[name]; write(STORAGE_KEY, data); view.remove(); renderCards(); }
        });
        var list = view.querySelector('.playlist-detail-list');
        tracks.forEach(function (track, index) {
            var row = document.createElement('div');
            row.className = 'playlist-detail-row';
            row.innerHTML = '<span>' + (index + 1) + '</span><img><div><b></b><small></small></div><button class="playlist-remove-track" type="button">×</button>';
            row.querySelector('img').src = coverOf(track);
            row.querySelector('b').textContent = track.title || 'Без названия';
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
            card.querySelector('.card-subtitle').textContent = data[name].length + ' трек(ів)';
            card.addEventListener('click', function () { openPlaylist(name); });
            container.appendChild(card);
        });
    }

    var style = document.createElement('style');
    style.textContent = '.playlist-action-btn{margin-left:8px}.playlist-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:3000;background:#191923;color:#fff;padding:12px 16px;border-radius:12px;opacity:0;transition:opacity .2s}.playlist-toast.visible{opacity:1}.playlist-picker-backdrop{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:18px}.playlist-picker{display:grid;grid-template-columns:1fr 1fr;gap:18px;max-width:760px;width:min(90vw,760px);background:#121215;border-radius:22px;padding:18px}.playlist-picker-left,.playlist-picker-right,.playlist-picker-list,.playlist-choice-list{display:flex;flex-direction:column;gap:10px}.playlist-picker-list,.playlist-choice-list{max-height:300px;overflow:auto}.playlist-choice{display:flex;align-items:center;gap:12px;padding:10px;border-radius:12px;background:rgba(255,255,255,.05);border:0;color:#fff;text-align:left}.playlist-choice b,.playlist-choice small{display:block}.playlist-choice small{color:#aaa}.playlist-search{padding:12px;border-radius:12px;background:#222;color:#fff;border:1px solid #444}.playlist-create,.playlist-picker-close,.playlist-back,.playlist-add-track,.playlist-detail-more,.playlist-remove-track{padding:10px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:#fff}.playlist-picker-close{align-self:flex-end;font-size:22px}.playlist-detail-view{position:fixed;inset:0;z-index:1500;overflow:auto;background:rgba(11,11,16,.97);padding:24px 18px}.playlist-detail-header,.playlist-detail-copy,.playlist-detail-actions,.playlist-detail-list,.playlist-detail-cover-wrap{max-width:820px;margin-left:auto;margin-right:auto}.playlist-detail-header{display:flex;justify-content:space-between}.playlist-detail-cover{width:100%;max-height:260px;object-fit:cover;border-radius:20px;margin:18px 0}.playlist-detail-row{display:grid;grid-template-columns:42px 52px 1fr 42px;gap:12px;align-items:center;padding:12px;border-radius:14px;background:rgba(255,255,255,.05);margin-top:8px}.playlist-detail-row img{width:52px;height:52px;object-fit:cover;border-radius:10px}.playlist-detail-row b,.playlist-detail-row small{display:block}.playlist-detail-row small{color:#aaa}@media(max-width:720px){.playlist-picker{grid-template-columns:1fr}.playlist-detail-row{grid-template-columns:30px 42px 1fr 30px}}';
    document.head.appendChild(style);

    function initialize() {
        if (!Object.keys(getPlaylists()).length) write(STORAGE_KEY, { 'Моя колекція': [] });
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
