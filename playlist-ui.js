/* Pulse Wave playlist UI: one track menu, multiple playlists, playlist pages and editing. */
(function () {
    'use strict';

    var STORAGE_KEY = 'pulseWavePlaylists';
    var COVER_KEY = 'pulseWavePlaylistCovers';
    var DEFAULT_COVER = 'playlist.jpeg';
    var picker = null;
    var activeTrack = null;
    var currentPlaylist = null;

    function read(key, fallback) {
        try {
            var value = JSON.parse(localStorage.getItem(key));
            return value && typeof value === 'object' ? value : fallback;
        } catch (error) { return fallback; }
    }

    function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
    function playlists() { return read(STORAGE_KEY, {}); }
    function key(track) { return track && track.id ? String(track.id) : (track && track.title) || ''; }
    function same(a, b) { return key(a) === key(b); }
    function coverForPlaylist(name, tracks) {
        var covers = read(COVER_KEY, {});
        return covers[name] || (tracks[0] && (tracks[0].cover || (tracks[0].artwork && tracks[0].artwork['150x150']))) || DEFAULT_COVER;
    }

    function toast(text) {
        var node = document.querySelector('.playlist-toast');
        if (!node) { node = document.createElement('div'); node.className = 'playlist-toast'; document.body.appendChild(node); }
        node.textContent = text;
        node.classList.add('visible');
        clearTimeout(toast.timer);
        toast.timer = setTimeout(function () { node.classList.remove('visible'); }, 3000);
    }

    function close() { if (picker) picker.remove(); picker = null; }

    function trackFromRow(row) {
        var title = row.querySelector('.song-title');
        var artist = row.querySelector('.song-artist');
        if (!title) return null;
        var lists = [window.localTracks || [], window.activeTracks || []];
        for (var i = 0; i < lists.length; i++) {
            for (var j = 0; j < lists[i].length; j++) {
                var item = lists[i][j];
                var itemArtist = item.artist || (item.user && item.user.name) || '';
                if (item.title === title.textContent && (!artist || itemArtist === artist.textContent)) return item;
            }
        }
        return { title: title.textContent, artist: artist ? artist.textContent : '' };
    }

    function addTrack(name) {
        var data = playlists();
        if (!data[name]) data[name] = [];
        if (!data[name].some(function (item) { return same(item, activeTrack); })) {
            data[name].push(activeTrack);
            write(STORAGE_KEY, data);
            toast('Трек «' + (activeTrack.title || 'Без названия') + '» был успешно добавлен!');
            renderCards();
        } else toast('Трек уже есть в плейлисте «' + name + '»');
        close();
    }

    function createPlaylist() {
        var data = playlists();
        var suggested = activeTrack && activeTrack.title ? activeTrack.title : 'Новый плейлист';
        var name = window.prompt('Название плейлиста:', suggested);
        if (!name || !name.trim()) return;
        name = name.trim();
        if (data[name]) { toast('Плейлист с таким названием уже существует'); return; }
        data[name] = activeTrack ? [activeTrack] : [];
        write(STORAGE_KEY, data);
        toast(activeTrack ? 'Трек «' + activeTrack.title + '» был успешно добавлен!' : 'Плейлист создан');
        renderCards();
        close();
    }

    function openPicker(track) {
        activeTrack = track;
        close();
        picker = document.createElement('div');
        picker.className = 'playlist-picker-backdrop';
        picker.innerHTML = '<section class="playlist-picker" role="dialog" aria-modal="true">' +
            '<div class="playlist-picker-left"><input class="playlist-search" type="search" placeholder="Поиск плейлиста"><button class="playlist-create" type="button"><span class="material-symbols-outlined">add</span>Создать плейлист</button><div class="playlist-picker-list"></div></div>' +
            '<div class="playlist-picker-right"><button class="playlist-picker-close" type="button">×</button><h3>Добавить в плейлист</h3><p class="playlist-selected-track"></p><div class="playlist-choice-list"></div></div></section>';
        document.body.appendChild(picker);
        picker.querySelector('.playlist-selected-track').textContent = track.title || 'Без названия';
        picker.querySelector('.playlist-picker-close').addEventListener('click', close);
        picker.addEventListener('click', function (event) { if (event.target === picker) close(); });

        function render(filter) {
            var data = playlists();
            var left = picker.querySelector('.playlist-picker-list');
            var right = picker.querySelector('.playlist-choice-list');
            left.innerHTML = ''; right.innerHTML = '';
            Object.keys(data).filter(function (name) { return name.toLowerCase().indexOf((filter || '').toLowerCase()) !== -1; }).forEach(function (name) {
                [left, right].forEach(function (parent) {
                    var button = document.createElement('button');
                    button.type = 'button'; button.className = 'playlist-choice';
                    button.innerHTML = '<span class="material-symbols-outlined">queue_music</span><span><b></b><small></small></span>';
                    button.querySelector('b').textContent = name;
                    button.querySelector('small').textContent = data[name].length + ' трек(ов)';
                    button.addEventListener('click', function () { addTrack(name); });
                    parent.appendChild(button);
                });
            });
        }
        picker.querySelector('.playlist-search').addEventListener('input', function (event) { render(event.target.value); });
        picker.querySelector('.playlist-create').addEventListener('click', createPlaylist);
        render('');
    }

    function openPlaylist(name) {
        var data = playlists();
        if (!data[name]) return;
        currentPlaylist = name;
        var view = document.getElementById('playlist-detail-view');
        if (!view) {
            view = document.createElement('div'); view.id = 'playlist-detail-view'; view.className = 'playlist-detail-view'; document.body.appendChild(view);
        }
        var tracks = data[name];
        view.innerHTML = '<div class="playlist-detail-header"><button class="playlist-back" type="button">← Бібліотека</button><button class="playlist-detail-more" type="button"><span class="material-symbols-outlined">more_horiz</span></button><img class="playlist-detail-cover"><div><div class="playlist-detail-label">Открытый плейлист</div><h1></h1><button class="playlist-add-track" type="button"><span class="material-symbols-outlined">add</span>Добавить</button><button class="playlist-edit" type="button"><span class="material-symbols-outlined">edit</span>Название и сведения</button></div></div><div class="playlist-detail-list"></div>';
        view.querySelector('.playlist-detail-cover').src = coverForPlaylist(name, tracks);
        view.querySelector('h1').textContent = name;
        view.querySelector('.playlist-back').addEventListener('click', function () { view.remove(); });
        view.querySelector('.playlist-add-track').addEventListener('click', function () { view.remove(); document.querySelector('.playlist-more-button') && document.querySelector('.playlist-more-button').click(); });
        view.querySelector('.playlist-edit').addEventListener('click', function () { editPlaylist(name); });
        view.querySelector('.playlist-detail-more').addEventListener('click', function () { playlistMenu(name, view.querySelector('.playlist-detail-more')); });
        var list = view.querySelector('.playlist-detail-list');
        tracks.forEach(function (track, index) {
            var row = document.createElement('div'); row.className = 'playlist-detail-row';
            row.innerHTML = '<span>' + (index + 1) + '</span><img><div><b></b><small></small></div><button class="playlist-remove-track" type="button">×</button>';
            row.querySelector('img').src = track.cover || (track.artwork && track.artwork['150x150']) || DEFAULT_COVER;
            row.querySelector('b').textContent = track.title || 'Без названия';
            row.querySelector('small').textContent = track.artist || (track.user && track.user.name) || '';
            row.addEventListener('click', function (event) { if (!event.target.closest('button') && window.playSong) { window.setTrackList(tracks, index); window.playSong(track); } });
            row.querySelector('button').addEventListener('click', function () { tracks.splice(index, 1); write(STORAGE_KEY, data); openPlaylist(name); renderCards(); });
            list.appendChild(row);
        });
    }

    function editPlaylist(oldName) {
        var data = playlists();
        var next = window.prompt('Название плейлиста:', oldName);
        if (!next || !next.trim() || next.trim() === oldName) return;
        next = next.trim(); if (data[next]) { toast('Плейлист с таким названием уже существует'); return; }
        data[next] = data[oldName]; delete data[oldName]; write(STORAGE_KEY, data);
        var covers = read(COVER_KEY, {}); if (covers[oldName]) { covers[next] = covers[oldName]; delete covers[oldName]; write(COVER_KEY, covers); }
        renderCards(); openPlaylist(next);
    }

    function playlistMenu(name, anchor) {
        var old = document.querySelector('.playlist-detail-menu'); if (old) old.remove();
        var menu = document.createElement('div'); menu.className = 'playlist-detail-menu';
        [['edit', 'Изменение сведений', function () { editPlaylist(name); }], ['delete', 'Удалить', function () { var data = playlists(); delete data[name]; write(STORAGE_KEY, data); var view = document.getElementById('playlist-detail-view'); if (view) view.remove(); renderCards(); }]].forEach(function (item) { var button = document.createElement('button'); button.type = 'button'; button.textContent = item[1]; button.addEventListener('click', function () { item[2](); menu.remove(); }); menu.appendChild(button); });
        document.body.appendChild(menu); var rect = anchor.getBoundingClientRect(); menu.style.top = rect.bottom + 6 + 'px'; menu.style.left = Math.max(8, rect.right - 190) + 'px';
    }

    function renderCards() {
        var container = document.getElementById('library-playlists'); if (!container) return;
        container.querySelectorAll('[data-user-playlist]').forEach(function (node) { node.remove(); });
        var data = playlists();
        Object.keys(data).forEach(function (name) {
            var card = document.createElement('div'); card.className = 'card user-playlist-card'; card.dataset.userPlaylist = name;
            card.innerHTML = '<div class="card-img-wrapper"><img class="card-img"><button class="card-play-btn" type="button"><span class="material-symbols-outlined">play_arrow</span></button></div><div class="card-title"></div><div class="card-subtitle"></div>';
            card.querySelector('img').src = coverForPlaylist(name, data[name]); card.querySelector('.card-title').textContent = name; card.querySelector('.card-subtitle').textContent = data[name].length + ' трек(ов)';
            card.addEventListener('click', function () { openPlaylist(name); }); container.appendChild(card);
        });
    }

    var style = document.createElement('style');
    style.textContent = '.playlist-picker-backdrop{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:18px}.playlist-picker{display:grid;grid-template-columns:42% 58%;width:min(780px,100%);max-height:88vh;overflow:hidden;background:#292929;border-radius:10px;box-shadow:0 20px 70px #000}.playlist-picker-left{padding:14px;border-right:1px solid rgba(255,255,255,.12);overflow:auto}.playlist-picker-right{position:relative;padding:32px 24px}.playlist-search{width:100%;padding:13px;background:#404040;border:0;border-radius:7px;color:#fff;font-size:16px}.playlist-create{width:100%;padding:14px 4px;background:none;border:0;border-bottom:1px solid rgba(255,255,255,.12);color:#fff;text-align:left;font-size:16px;cursor:pointer}.playlist-choice{display:flex;gap:12px;align-items:center;width:100%;padding:11px 8px;background:none;border:0;border-radius:6px;color:#fff;text-align:left;cursor:pointer}.playlist-choice:hover{background:#3b3b3b}.playlist-choice small{display:block;color:var(--text-muted);margin-top:3px}.playlist-picker-close{position:absolute;right:14px;top:8px;border:0;background:none;color:#fff;font-size:28px;cursor:pointer}.playlist-selected-track{color:var(--text-muted)}.playlist-toast{position:fixed;left:50%;bottom:calc(var(--player-height) + 18px);z-index:3000;transform:translate(-50%,18px);opacity:0;background:#2d1a55;color:#fff;border:1px solid #854dff;border-radius:8px;padding:12px 18px;transition:.2s;pointer-events:none}.playlist-toast.visible{opacity:1;transform:translate(-50%,0)}.user-playlist-card{cursor:pointer}.playlist-detail-view{position:fixed;inset:0 0 var(--player-height) 0;z-index:1500;overflow:auto;background:#151515;color:#fff;padding-bottom:40px}.playlist-detail-header{position:relative;min-height:390px;padding:70px 7%;display:flex;align-items:flex-end;gap:35px;background: linear-gradient(90deg,rgba(50, 0, 79, 1) 0%, rgba(76, 9, 121, 1) 35%, rgba(255, 0, 187, 1) 100%)}.playlist-detail-cover{width:260px;height:260px;object-fit:cover;box-shadow:0 15px 35px #000}.playlist-detail-label{font-size:16px}.playlist-detail-header h1{font-size:clamp(38px,7vw,90px);margin:18px 0}.playlist-back{position:absolute;left:24px;top:20px;background:none;border:0;color:#fff;font-size:16px;cursor:pointer}.playlist-detail-more{position:absolute;right:28px;top:20px;border:0;background:none;color:#fff;cursor:pointer}.playlist-add-track,.playlist-edit{border:0;border-radius:22px;padding:10px 17px;margin-right:8px;background:#444;color:#fff;cursor:pointer}.playlist-detail-list{padding:25px 7%}.playlist-detail-row{display:flex;align-items:center;gap:16px;padding:10px;border-bottom:1px solid rgba(255,255,255,.08);cursor:pointer}.playlist-detail-row img{width:48px;height:48px;object-fit:cover;border-radius:5px}.playlist-detail-row div{flex:1}.playlist-detail-row small{display:block;color:#aaa;margin-top:4px}.playlist-remove-track{background:none;border:0;color:#aaa;font-size:24px;cursor:pointer}.playlist-detail-menu{position:fixed;z-index:2500;background:#2b2b2b;box-shadow:0 10px 30px #000;border-radius:6px;padding:5px;min-width:190px}.playlist-detail-menu button{display:block;width:100%;padding:12px;background:none;border:0;color:#fff;text-align:left;cursor:pointer}.playlist-detail-menu button:hover{background:#444}@media(max-width:600px){.playlist-picker{grid-template-columns:1fr}.playlist-picker-right{display:none}.playlist-detail-header{min-height:340px;padding:50px 22px 28px;display:block}.playlist-detail-cover{width:150px;height:150px}.playlist-detail-header h1{font-size:42px}.playlist-detail-list{padding:20px 12px}}';
    document.head.appendChild(style);

    document.addEventListener('DOMContentLoaded', function () {
        renderCards();
    });

    window.openPlaylistPicker = openPicker;
})();