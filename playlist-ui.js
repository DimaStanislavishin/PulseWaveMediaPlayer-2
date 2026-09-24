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

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function playlists() {
        return read(STORAGE_KEY, {});
    }

    function key(track) {
        return track && track.id ? String(track.id) : (track && track.title) || '';
    }

    function same(a, b) {
        return key(a) === key(b);
    }

    function coverForPlaylist(name, tracks) {
        var covers = read(COVER_KEY, {});
        return covers[name] || (tracks[0] && (tracks[0].cover || (tracks[0].artwork && tracks[0].artwork['150x150']))) || DEFAULT_COVER;
    }

    function ensureSeedPlaylists() {
        var data = playlists();
        if (Object.keys(data).length > 0) return;

        var baseTracks = Array.isArray(window.localTracks) ? window.localTracks.slice() : [];
        var first = baseTracks.slice(0, 3);
        var second = baseTracks.slice(Math.max(0, baseTracks.length - 3), baseTracks.length);

        var seeded = {};
        if (first.length) seeded['Night Drive'] = first;
        if (second.length) seeded['Chill Mix'] = second;

        if (Object.keys(seeded).length > 0) {
            write(STORAGE_KEY, seeded);
            return;
        }

        write(STORAGE_KEY, { 'Моя колекція': [] });
    }

    function toast(text) {
        var node = document.querySelector('.playlist-toast');
        if (!node) {
            node = document.createElement('div');
            node.className = 'playlist-toast';
            document.body.appendChild(node);
        }
        node.textContent = text;
        node.classList.add('visible');
        clearTimeout(toast.timer);
        toast.timer = setTimeout(function () {
            node.classList.remove('visible');
        }, 3000);
    }

    function close() {
        if (picker) {
            picker.remove();
            picker = null;
        }
    }

    function trackFromRow(row) {
        var title = row && row.querySelector('.song-title');
        var artist = row && row.querySelector('.song-artist');
        if (!title) return null;

        var lists = [window.localTracks || [], window.activeTracks || []];
        for (var i = 0; i < lists.length; i++) {
            for (var j = 0; j < lists[i].length; j++) {
                var item = lists[i][j];
                var itemArtist = item.artist || (item.user && item.user.name) || '';
                if (item.title === title.textContent && (!artist || itemArtist === artist.textContent)) {
                    return item;
                }
            }
        }

        return { title: title.textContent, artist: artist ? artist.textContent : '' };
    }

    function ensurePlaylistButtons() {
        if (!document.querySelectorAll) return;
        var rows = document.querySelectorAll('.song-row');
        rows.forEach(function (row) {
            if (row.querySelector('[data-playlist-action]')) return;

            var actionButton = document.createElement('button');
            actionButton.type = 'button';
            actionButton.className = 'song-action-btn playlist-action-btn';
            actionButton.dataset.playlistAction = '1';
            actionButton.title = 'Добавить в плейлист';
            actionButton.setAttribute('aria-label', 'Добавить в плейлист');
            actionButton.innerHTML = '<span class="material-symbols-outlined">queue_music</span>';
            actionButton.addEventListener('click', function (event) {
                event.stopPropagation();
                var track = trackFromRow(row);
                if (track) openPicker(track);
            });
            row.appendChild(actionButton);
        });
    }

    function addTrack(name) {
        var data = playlists();
        if (!data[name]) data[name] = [];
        if (!data[name].some(function (item) { return same(item, activeTrack); })) {
            data[name].push(activeTrack);
            write(STORAGE_KEY, data);
            toast('Трек «' + (activeTrack.title || 'Без названия') + '» був успішно доданий!');
            renderCards();
        } else {
            toast('Трек уже є в плейлисті «' + name + '»');
        }
        close();
    }

    function createPlaylist() {
        var data = playlists();
        var suggested = activeTrack && activeTrack.title ? activeTrack.title : 'Новий плейлист';
        var name = window.prompt('Назва плейлиста:', suggested);
        if (!name || !name.trim()) return;
        name = name.trim();
        if (data[name]) {
            toast('Плейлист з такою назвою вже існує');
            return;
        }
        data[name] = activeTrack ? [activeTrack] : [];
        write(STORAGE_KEY, data);
        toast(activeTrack ? 'Трек «' + activeTrack.title + '» був успішно доданий!' : 'Плейлист створено');
        renderCards();
        close();
    }

    function openPicker(track) {
        if (!track) return;
        activeTrack = track;
        close();

        picker = document.createElement('div');
        picker.className = 'playlist-picker-backdrop';
        picker.innerHTML = '<section class="playlist-picker" role="dialog" aria-modal="true">' +
            '<div class="playlist-picker-left"><input class="playlist-search" type="search" placeholder="Пошук плейлиста"><button class="playlist-create" type="button"><span class="material-symbols-outlined">add</span>Новий плейлист</button><div class="playlist-picker-list"></div></div>' +
            '<div class="playlist-picker-right"><button class="playlist-picker-close" type="button">×</button><h3>Додати в плейлист</h3><p class="playlist-selected-track"></p><div class="playlist-choice-list"></div></div>' +
            '</section>';

        document.body.appendChild(picker);
        picker.querySelector('.playlist-selected-track').textContent = track.title || 'Без названия';
        picker.querySelector('.playlist-picker-close').addEventListener('click', close);
        picker.addEventListener('click', function (event) {
            if (event.target === picker) close();
        });

        function render(filter) {
            var data = playlists();
            var left = picker.querySelector('.playlist-picker-list');
            var right = picker.querySelector('.playlist-choice-list');
            left.innerHTML = ''; right.innerHTML = '';

            Object.keys(data).filter(function (name) {
                return name.toLowerCase().indexOf((filter || '').toLowerCase()) !== -1;
            }).forEach(function (name) {
                [left, right].forEach(function (parent) {
                    var button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'playlist-choice';
                    button.innerHTML = '<span class="material-symbols-outlined">queue_music</span><span><b></b><small></small></span>';
                    button.querySelector('b').textContent = name;
                    button.querySelector('small').textContent = data[name].length + ' трек(ів)';
                    button.addEventListener('click', function () {
                        addTrack(name);
                    });
                    parent.appendChild(button);
                });
            });
        }

        picker.querySelector('.playlist-search').addEventListener('input', function (event) {
            render(event.target.value);
        });
        picker.querySelector('.playlist-create').addEventListener('click', createPlaylist);
        render('');
    }

    function openPlaylist(name) {
        var data = playlists();
        if (!data[name]) return;
        currentPlaylist = name;

        var view = document.getElementById('playlist-detail-view');
        if (!view) {
            view = document.createElement('div');
            view.id = 'playlist-detail-view';
            view.className = 'playlist-detail-view';
            document.body.appendChild(view);
        }

        var tracks = data[name];
        view.innerHTML = '<div class="playlist-detail-header"><button class="playlist-back" type="button">← Бібліотека</button><button class="playlist-detail-more" type="button"><span class="material-symbols-outlined">more_horiz</span></button></div><div class="playlist-detail-cover-wrap"><img class="playlist-detail-cover" src="' + coverForPlaylist(name, tracks) + '" alt="" /></div><div class="playlist-detail-copy"><h1></h1><p class="playlist-detail-meta">' + tracks.length + ' трек(ів)</p></div><div class="playlist-detail-actions"><button class="playlist-add-track" type="button">+ Додати трек</button><button class="playlist-edit" type="button">Редагувати</button></div><div class="playlist-detail-list"></div>';
        view.querySelector('.playlist-detail-cover').src = coverForPlaylist(name, tracks);
        view.querySelector('h1').textContent = name;
        view.querySelector('.playlist-back').addEventListener('click', function () {
            view.remove();
        });
        view.querySelector('.playlist-add-track').addEventListener('click', function () {
            view.remove();
            if (window.openPlaylistPicker && window.localTracks && window.localTracks[0]) {
                window.openPlaylistPicker(window.localTracks[0]);
            }
        });
        view.querySelector('.playlist-edit').addEventListener('click', function () {
            editPlaylist(name);
        });
        view.querySelector('.playlist-detail-more').addEventListener('click', function () {
            playlistMenu(name, view.querySelector('.playlist-detail-more'));
        });

        var list = view.querySelector('.playlist-detail-list');
        tracks.forEach(function (track, index) {
            var row = document.createElement('div');
            row.className = 'playlist-detail-row';
            row.innerHTML = '<span>' + (index + 1) + '</span><img><div><b></b><small></small></div><button class="playlist-remove-track" type="button">×</button>';
            row.querySelector('img').src = track.cover || (track.artwork && track.artwork['150x150']) || DEFAULT_COVER;
            row.querySelector('b').textContent = track.title || 'Без названия';
            row.querySelector('small').textContent = track.artist || (track.user && track.user.name) || '';
            row.addEventListener('click', function (event) {
                if (!event.target.closest('button') && window.playSong) {
                    window.setTrackList(tracks, index);
                    window.playSong(track);
                }
            });
            row.querySelector('button').addEventListener('click', function () {
                tracks.splice(index, 1);
                write(STORAGE_KEY, data);
                openPlaylist(name);
                renderCards();
            });
            list.appendChild(row);
        });
    }

    function editPlaylist(oldName) {
        var data = playlists();
        var next = window.prompt('Назва плейлиста:', oldName);
        if (!next || !next.trim() || next.trim() === oldName) return;
        next = next.trim();
        if (data[next]) {
            toast('Плейлист з такою назвою вже існує');
            return;
        }
        data[next] = data[oldName];
        delete data[oldName];
        write(STORAGE_KEY, data);

        var covers = read(COVER_KEY, {});
        if (covers[oldName]) {
            covers[next] = covers[oldName];
            delete covers[oldName];
            write(COVER_KEY, covers);
        }

        renderCards();
        openPlaylist(next);
    }

    function playlistMenu(name, anchor) {
        var old = document.querySelector('.playlist-detail-menu');
        if (old) old.remove();

        var menu = document.createElement('div');
        menu.className = 'playlist-detail-menu';
        menu.innerHTML = '<button data-action="edit" type="button">Змінити</button><button data-action="delete" type="button">Видалити</button>';
        menu.querySelector('[data-action="edit"]').addEventListener('click', function () {
            editPlaylist(name);
            menu.remove();
        });
        menu.querySelector('[data-action="delete"]').addEventListener('click', function () {
            var data = playlists();
            delete data[name];
            write(STORAGE_KEY, data);
            menu.remove();
            renderCards();
            var view = document.getElementById('playlist-detail-view');
            if (view) view.remove();
        });

        document.body.appendChild(menu);
        var rect = anchor.getBoundingClientRect();
        menu.style.top = rect.bottom + 6 + 'px';
        menu.style.left = Math.max(8, rect.right - 190) + 'px';
    }

    function renderCards() {
        var container = document.getElementById('library-playlists');
        if (!container) return;

        container.querySelectorAll('[data-user-playlist]').forEach(function (node) {
            node.remove();
        });

        var data = playlists();
        Object.keys(data).forEach(function (name) {
            var card = document.createElement('div');
            card.className = 'card user-playlist-card';
            card.dataset.userPlaylist = name;
            card.innerHTML = '<div class="card-img-wrapper"><img class="card-img"><button class="card-play-btn" type="button"><span class="material-symbols-outlined">play_arrow</span></button></div><div class="card-title"></div><div class="card-subtitle"></div>';
            card.querySelector('img').src = coverForPlaylist(name, data[name]);
            card.querySelector('.card-title').textContent = name;
            card.querySelector('.card-subtitle').textContent = data[name].length + ' трек(ів)';
            card.addEventListener('click', function () { openPlaylist(name); });
            container.appendChild(card);
        });
    }

    var style = document.createElement('style');
    style.textContent = '.playlist-picker-backdrop{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:18px}.playlist-picker{display:grid;grid-template-columns:1.1fr .9fr;gap:18px;max-width:760px;width:min(90vw,760px);background:rgba(18,18,21,.96);border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:18px;box-shadow:0 25px 80px rgba(0,0,0,.5)}.playlist-picker-left,.playlist-picker-right{display:flex;flex-direction:column;gap:12px}.playlist-picker-list,.playlist-choice-list{display:flex;flex-direction:column;gap:10px;max-height:300px;overflow:auto}.playlist-choice{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid transparent;color:#fff;text-align:left}.playlist-choice:hover{border-color:rgba(255,107,157,.5)}.playlist-choice .material-symbols-outlined{font-size:22px;color:var(--primary-light)}.playlist-choice b{display:block}.playlist-choice small{display:block;color:var(--text-muted);font-size:11px}.playlist-create,.playlist-back,.playlist-add-track,.playlist-edit,.playlist-detail-more,.playlist-remove-track,.playlist-picker-close{border:none;border-radius:12px;background:rgba(255,255,255,.05);color:#fff;cursor:pointer}.playlist-search{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 14px;color:#fff}.playlist-picker-close{font-size:24px;padding:8px 10px;align-self:flex-end}.playlist-selected-track{color:var(--primary-light);font-weight:600}.playlist-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(12px);padding:12px 16px;background:rgba(25,25,35,.98);color:#fff;border:1px solid rgba(255,255,255,.08);border-radius:12px;opacity:0;pointer-events:none;transition:.2s ease;z-index:3000}.playlist-toast.visible{opacity:1;transform:translateX(-50%) translateY(0)}.playlist-detail-view{position:fixed;inset:0;background:rgba(11,11,16,.92);z-index:1500;padding:24px 18px;overflow:auto}.playlist-detail-header{display:flex;align-items:center;justify-content:space-between;max-width:820px;margin:0 auto 18px}.playlist-detail-cover-wrap{max-width:820px;margin:0 auto 18px}.playlist-detail-cover{width:100%;max-height:260px;object-fit:cover;border-radius:24px}.playlist-detail-copy{max-width:820px;margin:0 auto}.playlist-detail-copy h1{margin:0 0 8px}.playlist-detail-meta{color:var(--text-muted);margin:0 0 18px}.playlist-detail-actions{max-width:820px;margin:0 auto 18px;display:flex;gap:10px}.playlist-detail-list{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:10px}.playlist-detail-row{display:grid;grid-template-columns:42px 52px 1fr 42px;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.03);cursor:pointer}.playlist-detail-row img{width:52px;height:52px;border-radius:12px;object-fit:cover}.playlist-detail-row b{display:block}.playlist-detail-row small{color:var(--text-muted)}.playlist-remove-track{background:transparent;color:#fff;font-size:22px;border:none;cursor:pointer}.playlist-detail-menu{position:fixed;z-index:1700;background:#171b22;border-radius:12px;border:1px solid rgba(255,255,255,.08);padding:8px;display:flex;flex-direction:column;gap:4px}.playlist-detail-menu button{background:transparent;color:#fff;border:none;padding:10px 12px;border-radius:8px;text-align:left;cursor:pointer}.playlist-detail-menu button:hover{background:rgba(255,255,255,.04)}.playlist-action-btn{margin-left:8px}.playlist-create .material-symbols-outlined{font-size:18px;vertical-align:middle;margin-right:8px}.@media (max-width: 720px){.playlist-picker{grid-template-columns:1fr}.playlist-detail-row{grid-template-columns:32px 42px 1fr 26px}}';
    document.head.appendChild(style);

    document.addEventListener('DOMContentLoaded', function () {
        ensureSeedPlaylists();
        renderCards();
        ensurePlaylistButtons();
    });

    document.addEventListener('click', function (event) {
        var target = event.target.closest('[data-playlist-action]');
        if (!target) return;
        event.stopPropagation();
        var row = target.closest('.song-row');
        var track = row ? trackFromRow(row) : null;
        if (track) openPicker(track);
    });

    window.openPlaylistPicker = openPicker;
    window.ensurePlaylistButtons = ensurePlaylistButtons;
    window.renderPlaylistCards = renderCards;
})();
