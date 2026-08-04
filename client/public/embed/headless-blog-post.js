;(function () {
  'use strict';

  function getAttr(el, name, fallback) {
    var value = el.getAttribute(name);
    return value == null || value === '' ? fallback : value;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function normalizeSlug(value) {
    return String(value || '').trim().replace(/^\/+/, '').toLowerCase();
  }

  function resolveApiOrigin(script) {
    var explicit = getAttr(script, 'data-api-origin', '');
    if (explicit) return explicit.replace(/\/$/, '');
    var src = script.src || '';
    var idx = src.indexOf('/embed/headless-blog-post.js');
    if (idx > 0) return src.slice(0, idx);
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
    return '';
  }

  var SUBTITLE_SIZES = { sm: true, md: true, lg: true, xl: true };
  var DEFAULT_HEADING_COLOR = '#111827';
  var DEFAULT_SUBHEADING_COLOR = '#4b5563';
  var OVERLAP_HEADING_COLOR = '#ffffff';
  var OVERLAP_SUBHEADING_COLOR = 'rgba(255,255,255,0.9)';

  function normalizeHexColor(value) {
    var raw = String(value || '').trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return '';
    if (raw.length === 4) {
      return '#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
    }
    return raw.toLowerCase();
  }

  function normalizePresentation(presentation) {
    var source = presentation && typeof presentation === 'object' ? presentation : {};
    var coverPosition = source.coverPosition === 'above-title' ? 'above-title' : 'below-title';
    var subtitleSize = SUBTITLE_SIZES[source.subtitleSize] ? source.subtitleSize : 'md';
    var titleOverlapCover = coverPosition === 'above-title' && Boolean(source.titleOverlapCover);
    return {
      coverFirst: coverPosition === 'above-title',
      useHeroOverlap: titleOverlapCover,
      subtitleSize: subtitleSize,
      headingColor: normalizeHexColor(source.headingColor),
      subheadingColor: normalizeHexColor(source.subheadingColor),
    };
  }

  function resolveChromeColors(presentation, heroOverlap) {
    return {
      heading: presentation.headingColor || (heroOverlap ? OVERLAP_HEADING_COLOR : DEFAULT_HEADING_COLOR),
      subheading: presentation.subheadingColor || (heroOverlap ? OVERLAP_SUBHEADING_COLOR : DEFAULT_SUBHEADING_COLOR),
    };
  }

  function colorStyleAttr(color) {
    return color ? ' style="color:' + color + '"' : '';
  }

  function buildTitle(text, options) {
    if (!text) return '';
    var classes = 'ld-article__title';
    if (options.overlap) classes += ' ld-article__title--overlap';
    if (options.afterCover) classes += ' ld-article__title--after-cover';
    return '<h1 class="' + classes + '"' + colorStyleAttr(options.color) + '>' + escapeHtml(text) + '</h1>';
  }

  function buildSubtitle(text, options) {
    if (!text) return '';
    var sizeClass = options.overlap
      ? 'ld-article__subtitle--overlap-' + options.size
      : 'ld-article__subtitle--' + options.size;
    var classes = 'ld-article__subtitle ' + sizeClass;
    if (options.overlap) classes += ' ld-article__subtitle--overlap';
    return '<p class="' + classes + '"' + colorStyleAttr(options.color) + '>' + escapeHtml(text) + '</p>';
  }

  function resolveEmbedFileOrigin(apiOrigin) {
    var explicit = '';
    try {
      if (typeof window !== 'undefined' && window.__ARIVU_FILE_ORIGIN) {
        explicit = String(window.__ARIVU_FILE_ORIGIN || '').replace(/\/$/, '');
      }
    } catch (e) { /* ignore */ }
    if (explicit) return explicit;
    var origin = String(apiOrigin || '').replace(/\/$/, '');
    if (!origin) return 'https://api.arivusystems.com';
    try {
      var host = new URL(origin).hostname.toLowerCase();
      if (host === 'www.arivusystems.com' || host === 'arivusystems.com') {
        return 'https://api.arivusystems.com';
      }
    } catch (e) { /* ignore */ }
    return origin;
  }

  function absolutizeEmbedAssetUrl(url, apiOrigin) {
    var common = window.LiteDeskHeadlessHelpCommon || window.ArivuHeadlessHelpCommon;
    if (common && common.absolutizeEmbedAssetUrl) {
      return common.absolutizeEmbedAssetUrl(url, apiOrigin);
    }
    var raw = String(url || '').trim();
    if (!raw) return raw;
    if (raw.indexOf('data:') === 0) return raw;
    var fileOrigin = resolveEmbedFileOrigin(apiOrigin);
    if (raw.indexOf('http://') === 0 || raw.indexOf('https://') === 0) {
      try {
        var parsed = new URL(raw);
        var path = parsed.pathname || '';
        if (
          (path.indexOf('/api/files/download') === 0 || path.indexOf('/api/uploads/') === 0)
          && (parsed.hostname.toLowerCase() === 'www.arivusystems.com'
            || parsed.hostname.toLowerCase() === 'arivusystems.com')
        ) {
          return fileOrigin + path + parsed.search;
        }
      } catch (e) { /* keep raw */ }
      return raw;
    }
    if (raw.indexOf('/api/files/download') === 0 || raw.indexOf('/api/uploads/') === 0) {
      return fileOrigin + raw;
    }
    return raw;
  }

  function absolutizeEmbedHtml(html, apiOrigin) {
    var common = window.LiteDeskHeadlessHelpCommon || window.ArivuHeadlessHelpCommon;
    if (common && common.absolutizeEmbedHtml) {
      return common.absolutizeEmbedHtml(html, apiOrigin);
    }
    if (!html || !apiOrigin) return html;
    var origin = String(apiOrigin).replace(/\/$/, '');
    return String(html).replace(
      /(\s(?:src|href)=["'])(\/api\/(?:files\/download|uploads)[^"']*)(["'])/gi,
      function (_match, prefix, path, suffix) {
        return prefix + origin + path + suffix;
      },
    );
  }

  function buildCover(coverImage, apiOrigin) {
    if (!coverImage || !coverImage.url) return '';
    var src = absolutizeEmbedAssetUrl(coverImage.url, apiOrigin);
    return (
      '<figure class="ld-blog-post__cover">' +
        '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(coverImage.alt || '') + '" loading="lazy" />' +
      '</figure>'
    );
  }

  function authorInitials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function formatCount(value) {
    var n = Math.max(0, Number(value) || 0);
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function pickNaturalVoice() {
    var voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    var preferred = [
      /samantha/i,
      /karen/i,
      /moira/i,
      /ava/i,
      /nicole/i,
      /google us english/i,
      /microsoft aria/i,
      /microsoft jenny/i,
      /natural/i,
      /enhanced/i,
      /premium/i,
    ];
    var i;
    var v;
    for (i = 0; i < preferred.length; i += 1) {
      v = voices.find(function (voice) {
        return preferred[i].test(voice.name) && /^en(-|$)/i.test(voice.lang || '');
      });
      if (v) return v;
    }
    v = voices.find(function (voice) {
      return /^en(-|$)/i.test(voice.lang || '')
        && !/compact|eloquence|robot|festival/i.test(voice.name || '');
    });
    return v || voices[0] || null;
  }

  function ensureVoicesReady() {
    return new Promise(function (resolve) {
      var voices = window.speechSynthesis.getVoices();
      if (voices && voices.length) {
        resolve(voices);
        return;
      }
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        window.speechSynthesis.removeEventListener('voiceschanged', finish);
        resolve(window.speechSynthesis.getVoices() || []);
      }
      window.speechSynthesis.addEventListener('voiceschanged', finish);
      window.setTimeout(finish, 600);
    });
  }

  function wrapListenWords(root) {
    if (root.getAttribute('data-ld-listen-ready') === '1') {
      return root.querySelectorAll('.ld-blog-post__w');
    }
    var targets = [
      root.querySelector('.ld-blog-post__title'),
      root.querySelector('.ld-blog-post__subtitle'),
      root.querySelector('.ld-blog-post__body'),
    ].filter(Boolean);
    var counter = { i: 0 };

    function shouldSkip(el) {
      if (!el || el.nodeType !== 1) return false;
      var tag = el.tagName;
      return tag === 'SCRIPT'
        || tag === 'STYLE'
        || tag === 'CODE'
        || tag === 'PRE'
        || tag === 'SVG'
        || tag === 'BUTTON'
        || el.classList.contains('ld-blog-post__w');
    }

    function walk(node) {
      if (node.nodeType === 3) {
        var text = node.nodeValue;
        if (!text || !/\S/.test(text)) return;
        var frag = document.createDocumentFragment();
        var re = /(\s+)|(\S+)/g;
        var match;
        while ((match = re.exec(text))) {
          if (match[1]) {
            frag.appendChild(document.createTextNode(match[1]));
          } else {
            var span = document.createElement('span');
            span.className = 'ld-blog-post__w';
            span.setAttribute('data-ld-w', String(counter.i));
            counter.i += 1;
            span.textContent = match[2];
            frag.appendChild(span);
          }
        }
        node.parentNode.replaceChild(frag, node);
        return;
      }
      if (node.nodeType !== 1 || shouldSkip(node)) return;
      var children = Array.prototype.slice.call(node.childNodes);
      children.forEach(walk);
    }

    targets.forEach(walk);
    root.setAttribute('data-ld-listen-ready', '1');
    return root.querySelectorAll('.ld-blog-post__w');
  }

  function clearSpeakingWord(root) {
    var active = root.querySelectorAll('.ld-blog-post__w.is-speaking');
    active.forEach(function (el) {
      el.classList.remove('is-speaking');
    });
  }

  function highlightWord(root, wordNodes, index) {
    clearSpeakingWord(root);
    var el = wordNodes[index];
    if (!el) return;
    el.classList.add('is-speaking');
    if (el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }

  function buildUtteranceFromWords(wordNodes, fromIndex) {
    var parts = [];
    var offsets = [];
    var pos = 0;
    var i;
    for (i = fromIndex; i < wordNodes.length; i += 1) {
      var word = String(wordNodes[i].textContent || '');
      if (!word) continue;
      if (parts.length) {
        // Light pause cues after sentence ends help softens robotic cadence.
        var prev = parts[parts.length - 1];
        if (/[.!?]["')\]]*$/.test(prev)) {
          parts.push('. ');
          pos += 2;
        } else {
          parts.push(' ');
          pos += 1;
        }
      }
      offsets.push({ start: pos, end: pos + word.length, absoluteIndex: i });
      parts.push(word);
      pos += word.length;
    }
    return { text: parts.join(''), offsets: offsets };
  }

  function wordIndexForChar(offsets, charIndex) {
    var i;
    for (i = offsets.length - 1; i >= 0; i -= 1) {
      if (charIndex >= offsets[i].start) return offsets[i].absoluteIndex;
    }
    return offsets.length ? offsets[0].absoluteIndex : 0;
  }

  var PLAY_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>';
  var PAUSE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z"/></svg>';
  var CLOSE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6.4 5l5.6 5.6L17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/></svg>';

  function formatPlayerProgress(index, total) {
    var pct = total > 0 ? Math.round((index / total) * 100) : 0;
    return pct + '% · word ' + Math.min(index + 1, total) + ' / ' + total;
  }

  function getOrCreateListenController(root, listenBtn, context) {
    if (root._ldListenController) return root._ldListenController;

    var state = {
      wordNodes: [],
      wordIndex: 0,
      playing: false,
      paused: false,
      rate: 0.92,
      voice: null,
      playerEl: null,
      usingNativePause: false,
      token: 0,
    };

    function ensurePlayer() {
      if (state.playerEl && state.playerEl.isConnected) return state.playerEl;
      var existing = document.querySelector('.ld-blog-player[data-ld-player]');
      if (existing) {
        state.playerEl = existing;
        return existing;
      }
      var el = document.createElement('div');
      el.className = 'ld-blog-player';
      el.setAttribute('data-ld-player', 'true');
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Audio player');
      el.innerHTML =
        '<button type="button" class="ld-blog-player__play" data-ld-player-toggle aria-label="Pause">' + PAUSE_ICON + '</button>' +
        '<div class="ld-blog-player__main">' +
          '<div class="ld-blog-player__title" data-ld-player-title></div>' +
          '<input class="ld-blog-player__seek" data-ld-player-seek type="range" min="0" max="100" value="0" aria-label="Seek" />' +
          '<div class="ld-blog-player__meta" data-ld-player-meta>0%</div>' +
        '</div>' +
        '<label class="ld-blog-player__rate">' +
          '<span class="ld-blog-post__sr">Speed</span>' +
          '<select data-ld-player-rate aria-label="Playback speed">' +
            '<option value="0.8">0.8×</option>' +
            '<option value="0.92" selected>Natural</option>' +
            '<option value="1.05">1.05×</option>' +
            '<option value="1.2">1.2×</option>' +
          '</select>' +
        '</label>' +
        '<button type="button" class="ld-blog-player__close" data-ld-player-close aria-label="Close player">' + CLOSE_ICON + '</button>';
      // Fixed to viewport — sticky at article end stays below the fold.
      document.body.appendChild(el);
      state.playerEl = el;

      el.querySelector('[data-ld-player-toggle]').addEventListener('click', function () {
        if (state.playing && !state.paused) controller.pause();
        else controller.resume();
      });
      el.querySelector('[data-ld-player-close]').addEventListener('click', function () {
        controller.close();
      });
      el.querySelector('[data-ld-player-rate]').addEventListener('change', function (event) {
        state.rate = Number(event.target.value) || 0.92;
        if (state.playing) {
          controller.speakFrom(state.wordIndex);
        }
      });
      el.querySelector('[data-ld-player-seek]').addEventListener('input', function (event) {
        var total = state.wordNodes.length || 1;
        var next = Math.round((Number(event.target.value) / 100) * (total - 1));
        state.wordIndex = Math.max(0, Math.min(next, total - 1));
        updatePlayerUi();
        highlightWord(root, state.wordNodes, state.wordIndex);
      });
      el.querySelector('[data-ld-player-seek]').addEventListener('change', function () {
        if (state.playing || state.paused) controller.speakFrom(state.wordIndex);
      });
      return el;
    }

    function syncListenButtons(active) {
      root.querySelectorAll('[data-ld-listen]').forEach(function (btn) {
        btn.classList.toggle('is-active', Boolean(active));
      });
    }

    function updatePlayerUi() {
      var el = ensurePlayer();
      var total = state.wordNodes.length || 1;
      var pct = Math.round((state.wordIndex / Math.max(total - 1, 1)) * 100);
      var toggle = el.querySelector('[data-ld-player-toggle]');
      var seek = el.querySelector('[data-ld-player-seek]');
      var meta = el.querySelector('[data-ld-player-meta]');
      var title = el.querySelector('[data-ld-player-title]');
      if (toggle) {
        toggle.innerHTML = (state.playing && !state.paused) ? PAUSE_ICON : PLAY_ICON;
        toggle.setAttribute('aria-label', (state.playing && !state.paused) ? 'Pause' : 'Play');
      }
      if (seek) seek.value = String(pct);
      if (meta) meta.textContent = formatPlayerProgress(state.wordIndex, total);
      if (title) title.textContent = context.title || 'Listening';
      el.hidden = false;
      root.classList.toggle('is-listening', state.playing || state.paused);
      syncListenButtons(state.playing || state.paused);
    }

    function cancelSpeech() {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        /* optional */
      }
      state.usingNativePause = false;
    }

    function speakFrom(startIndex) {
      if (!state.wordNodes.length) return;
      state.token += 1;
      var token = state.token;
      state.wordIndex = Math.max(0, Math.min(startIndex, state.wordNodes.length - 1));
      state.playing = true;
      state.paused = false;
      cancelSpeech();
      highlightWord(root, state.wordNodes, state.wordIndex);
      updatePlayerUi();

      var payload = buildUtteranceFromWords(state.wordNodes, state.wordIndex);
      if (!payload.text.trim()) {
        controller.finish();
        return;
      }

      var utterance = new SpeechSynthesisUtterance(payload.text.slice(0, 14000));
      if (state.voice) utterance.voice = state.voice;
      utterance.lang = (state.voice && state.voice.lang) || 'en-US';
      utterance.rate = state.rate;
      utterance.pitch = 1.02;
      utterance.volume = 1;

      utterance.onboundary = function (event) {
        if (token !== state.token) return;
        if (event.name && event.name !== 'word') return;
        var idx = wordIndexForChar(payload.offsets, event.charIndex || 0);
        state.wordIndex = idx;
        highlightWord(root, state.wordNodes, idx);
        updatePlayerUi();
      };
      utterance.onend = function () {
        if (token !== state.token) return;
        // Completed remaining text
        if (state.paused) return;
        controller.finish();
      };
      utterance.onerror = function () {
        if (token !== state.token) return;
        if (state.paused) return;
        // Keep player open at last word so user can resume.
        state.playing = false;
        state.paused = true;
        updatePlayerUi();
      };

      window.setTimeout(function () {
        if (token !== state.token) return;
        window.speechSynthesis.speak(utterance);
      }, 30);
    }

    var controller = {
      openAndPlay: function () {
        ensurePlayer();
        updatePlayerUi();
        ensureVoicesReady().then(function () {
          state.voice = pickNaturalVoice();
          state.wordNodes = Array.prototype.slice.call(wrapListenWords(root));
          if (!state.wordNodes.length) {
            updatePlayerUi();
            return;
          }
          speakFrom(state.wordIndex || 0);
        });
      },
      pause: function () {
        if (!state.playing || state.paused) return;
        state.paused = true;
        state.playing = false;
        // Native pause is flaky in Chrome; snapshot word and cancel so resume is reliable.
        try {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause();
            if (window.speechSynthesis.paused) {
              state.usingNativePause = true;
              state.playing = true;
              updatePlayerUi();
              return;
            }
          }
        } catch (err) {
          /* fall through */
        }
        cancelSpeech();
        state.usingNativePause = false;
        state.playing = false;
        state.paused = true;
        updatePlayerUi();
      },
      resume: function () {
        if (state.usingNativePause && window.speechSynthesis.paused) {
          try {
            window.speechSynthesis.resume();
            state.paused = false;
            state.playing = true;
            updatePlayerUi();
            return;
          } catch (err) {
            /* fall through to speakFrom */
          }
        }
        speakFrom(state.wordIndex || 0);
      },
      speakFrom: speakFrom,
      finish: function () {
        state.playing = false;
        state.paused = true;
        state.wordIndex = 0;
        cancelSpeech();
        clearSpeakingWord(root);
        // Keep dock visible at end so user can replay / seek.
        updatePlayerUi();
        root.classList.add('is-listening');
        syncListenButtons(true);
      },
      close: function () {
        state.token += 1;
        cancelSpeech();
        clearSpeakingWord(root);
        state.playing = false;
        state.paused = false;
        state.wordIndex = 0;
        root.classList.remove('is-listening');
        syncListenButtons(false);
        if (state.playerEl) {
          state.playerEl.hidden = true;
          if (state.playerEl.parentNode) state.playerEl.parentNode.removeChild(state.playerEl);
          state.playerEl = null;
        }
      },
      isActive: function () {
        return Boolean(state.playerEl && state.playerEl.isConnected && !state.playerEl.hidden);
      },
    };

    root._ldListenController = controller;
    return controller;
  }

  function iconSvg(pathData) {
    var paths = Array.isArray(pathData) ? pathData : [pathData];
    var body = paths.map(function (d) {
      return '<path d="' + d + '" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
    }).join('');
    return (
      '<span class="ld-blog-post__ico" aria-hidden="true">' +
        '<svg class="ld-blog-post__svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">' +
          body +
        '</svg>' +
      '</span>'
    );
  }

  // Heroicons outline 24 (MIT) — exact paths from headless-heroicon-paths.js
  var CLAP_ICON = iconSvg(
    'M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z'
  );
  var COMMENT_ICON = iconSvg(
    'M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z'
  );
  var RESPOND_ICON = iconSvg(
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99'
  );
  var BOOKMARK_ICON = iconSvg(
    'M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z'
  );
  var LISTEN_ICON = iconSvg([
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    'M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z',
  ]);
  var SHARE_ARROW_ICON = iconSvg(
    'M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z'
  );
  var MORE_ICON = iconSvg(
    'M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z'
  );
  var SHARE_ICONS = {
    facebook: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 8.5V6.8c0-.7.5-1.3 1.2-1.3h1.8V2h-2.4c-2.4 0-4 1.5-4 4v2.5H8v3.2h2.6V22h3.4v-10.3H18v-3.2h-4z"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23 22h-6.7l-5.2-6.8L5.2 22H2l7.3-8.4L1 2h6.9l4.7 6.2L18.9 2zm-1.2 18h1.8L7.1 3.9H5.2L17.7 20z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.5 8.8V21H2.8V8.8h3.7zM4.6 2c1.2 0 2.1 1 2.1 2.1S5.8 6.2 4.6 6.2 2.5 5.3 2.5 4.1 3.4 2 4.6 2zM21 21h-3.7v-5.9c0-1.4-.5-2.4-1.8-2.4-1 0-1.6.7-1.9 1.3-.1.2-.1.5-.1.8V21H10V8.8h3.5v1.6c.5-.8 1.4-1.9 3.4-1.9 2.5 0 4.4 1.6 4.4 5.1V21z"/></svg>',
  };

  function buildShareUrl(platform, pageUrl, title) {
    var encodedUrl = encodeURIComponent(pageUrl);
    var encodedTitle = encodeURIComponent(title || '');
    if (platform === 'facebook') {
      return 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl;
    }
    if (platform === 'linkedin') {
      return 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl;
    }
    return 'https://twitter.com/intent/tweet?url=' + encodedUrl + '&text=' + encodedTitle;
  }

  function buildAuthorRow(data, apiOrigin) {
    if (!data.authorName) return '';
    var avatar = absolutizeEmbedAssetUrl(String(data.authorAvatar || '').trim(), apiOrigin);
    var avatarHtml = avatar
      ? '<img class="ld-blog-post__avatar" src="' + escapeHtml(avatar) + '" alt="" width="44" height="44" loading="lazy" decoding="async" />'
      : '<span class="ld-blog-post__avatar ld-blog-post__avatar--fallback" aria-hidden="true">' + escapeHtml(authorInitials(data.authorName)) + '</span>';
    var readMinutes = Number(data.readMinutes) || 0;
    var metaBits = [];
    if (readMinutes > 0) metaBits.push(readMinutes + ' min read');
    if (data.publishedAt) metaBits.push(formatDate(data.publishedAt));
    return (
      '<div class="ld-blog-post__byline">' +
        avatarHtml +
        '<div class="ld-blog-post__byline-text">' +
          '<div class="ld-blog-post__byline-top">' +
            '<span class="ld-blog-post__author-name">' + escapeHtml(data.authorName) + '</span>' +
            '<button type="button" class="ld-blog-post__follow" data-ld-follow>Follow</button>' +
          '</div>' +
          (metaBits.length
            ? '<div class="ld-blog-post__byline-meta">' + escapeHtml(metaBits.join(' · ')) + '</div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  // Blog comments UI is temporarily hidden (local-only prototyping done; not public yet).
  var SHOW_BLOG_COMMENTS = false;

  function buildEngagementBar(options) {
    var claps = formatCount(options.claps);
    var comments = formatCount(options.comments);
    var shares = formatCount(options.shares);
    var shareUrl = options.pageUrl || '';
    var title = options.title || '';
    var placement = options.placement === 'footer' ? 'footer' : 'header';
    var rssHref = String(options.rssHref || '').trim();
    var rssItem = rssHref
      ? '<a class="ld-blog-post__share-item" href="' + escapeHtml(rssHref) + '" data-share="rss" target="_blank" rel="noopener noreferrer">RSS</a>'
      : '';
    var rssBtn = rssHref
      ? '<a class="ld-blog-post__rss" href="' + escapeHtml(rssHref) + '" target="_blank" rel="noopener noreferrer" aria-label="RSS">RSS</a>'
      : '';
    return (
      '<div class="ld-blog-post__toolbar ld-blog-post__toolbar--' + placement + '" data-ld-blog-toolbar role="toolbar" aria-label="Post actions">' +
        '<div class="ld-blog-post__toolbar-start">' +
          '<button type="button" class="ld-blog-post__action" data-ld-clap aria-label="Appreciate">' +
            CLAP_ICON + '<span data-ld-clap-count>' + escapeHtml(claps) + '</span>' +
          '</button>' +
          (SHOW_BLOG_COMMENTS
            ? (
              '<button type="button" class="ld-blog-post__action" data-ld-comment aria-label="Comments">' +
                COMMENT_ICON + '<span data-ld-comment-count>' + escapeHtml(comments) + '</span>' +
              '</button>'
            )
            : '') +
          '<span class="ld-blog-post__action ld-blog-post__action--static" title="Shares">' +
            RESPOND_ICON + '<span data-ld-share-count>' + escapeHtml(shares) + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="ld-blog-post__toolbar-end">' +
          rssBtn +
          '<button type="button" class="ld-blog-post__icon-btn" data-ld-listen aria-label="Listen">' + LISTEN_ICON + '</button>' +
          '<div class="ld-blog-post__share-wrap">' +
            '<button type="button" class="ld-blog-post__icon-btn" data-ld-share-toggle aria-expanded="false" aria-label="Share">' + SHARE_ARROW_ICON + '</button>' +
            '<div class="ld-blog-post__share-menu" data-ld-share-menu hidden>' +
              '<button type="button" class="ld-blog-post__share-item" data-share="copy">Copy link</button>' +
              rssItem +
              '<a class="ld-blog-post__share-item" href="' + escapeHtml(buildShareUrl('x', shareUrl, title)) + '" data-share="x" target="_blank" rel="noopener noreferrer">' + SHARE_ICONS.x + ' X</a>' +
              '<a class="ld-blog-post__share-item" href="' + escapeHtml(buildShareUrl('facebook', shareUrl, title)) + '" data-share="facebook" target="_blank" rel="noopener noreferrer">' + SHARE_ICONS.facebook + ' Facebook</a>' +
              '<a class="ld-blog-post__share-item" href="' + escapeHtml(buildShareUrl('linkedin', shareUrl, title)) + '" data-share="linkedin" target="_blank" rel="noopener noreferrer">' + SHARE_ICONS.linkedin + ' LinkedIn</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function formatCommentDate(value) {
    var date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function truncateCommentText(text, limit) {
    var raw = String(text || '').trim();
    if (raw.length <= limit) return { text: raw, truncated: false };
    var slice = raw.slice(0, limit);
    var lastSpace = slice.lastIndexOf(' ');
    if (lastSpace > Math.floor(limit * 0.6)) slice = slice.slice(0, lastSpace);
    return { text: slice.replace(/\s+$/, ''), truncated: true, full: raw };
  }

  function buildResponseAvatar(name, avatarUrl) {
    var label = escapeHtml(authorInitials(name || 'You'));
    if (avatarUrl) {
      return '<img class="ld-blog-responses__avatar" src="' + escapeHtml(avatarUrl) + '" alt="" width="36" height="36" loading="lazy" />';
    }
    return '<span class="ld-blog-responses__avatar ld-blog-responses__avatar--fallback" aria-hidden="true">' + label + '</span>';
  }

  var SHIELD_ICON = iconSvg(
    'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z'
  );

  function buildCommentsSection(initialCount) {
    var count = Math.max(0, Number(initialCount) || 0);
    return (
      '<section class="ld-blog-responses" id="ld-blog-comments" data-ld-comments>' +
        '<div class="ld-blog-responses__head">' +
          '<h2 class="ld-blog-responses__title">' +
            'Comments (<span data-ld-responses-count>' + escapeHtml(String(count)) + '</span>)' +
          '</h2>' +
          '<span class="ld-blog-responses__shield" title="Community guidelines" aria-hidden="true">' + SHIELD_ICON + '</span>' +
        '</div>' +
        '<form class="ld-blog-responses__composer" data-ld-comment-form>' +
          buildResponseAvatar('You', '') +
          '<div class="ld-blog-responses__composer-main">' +
            '<label class="ld-blog-post__sr" for="ld-blog-comment-input">What are your thoughts?</label>' +
            '<textarea id="ld-blog-comment-input" class="ld-blog-responses__input" rows="1" placeholder="What are your thoughts?" required></textarea>' +
            '<div class="ld-blog-responses__composer-actions" data-ld-composer-actions hidden>' +
              '<button type="button" class="ld-blog-responses__cancel" data-ld-composer-cancel>Cancel</button>' +
              '<button type="submit" class="ld-blog-responses__submit">Comment</button>' +
            '</div>' +
          '</div>' +
        '</form>' +
        '<ul class="ld-blog-responses__list" data-ld-comment-list></ul>' +
      '</section>'
    );
  }

  function buildBlogPostShell(data, bodyHtml, chrome, apiOrigin) {
    var engagement = data.engagement || {};
    var title = data.title || '';
    var subtitle = data.subtitle || '';
    var pageUrl = chrome.pageUrl || (typeof window !== 'undefined' ? window.location.href : '');
    var barOptions = {
      claps: engagement.claps,
      comments: engagement.comments,
      shares: engagement.shares,
      pageUrl: pageUrl,
      title: title,
      rssHref: chrome.rssHref || '',
    };

    return (
      '<article class="ld-blog-post" data-ld-blog-post>' +
        '<header class="ld-blog-post__header">' +
          '<h1 class="ld-blog-post__title">' + escapeHtml(title) + '</h1>' +
          (subtitle ? '<p class="ld-blog-post__subtitle">' + escapeHtml(subtitle) + '</p>' : '') +
          buildAuthorRow(data, apiOrigin) +
          buildEngagementBar(Object.assign({}, barOptions, { placement: 'header' })) +
          buildCover(data.coverImage, apiOrigin) +
        '</header>' +
        '<div class="ld-blog-post__body ld-article__body">' + bodyHtml + '</div>' +
        buildEngagementBar(Object.assign({}, barOptions, { placement: 'footer' })) +
        (SHOW_BLOG_COMMENTS ? buildCommentsSection(engagement.comments) : '') +
      '</article>'
    );
  }

  function feedbackStorageKey(org, slug) {
    return 'ld-blog-feedback:' + org + ':' + slug;
  }

  function bookmarkStorageKey(org, slug) {
    return 'ld-blog-bookmark:' + org + ':' + slug;
  }

  function commentsStorageKey(org, slug) {
    return 'ld-blog-comments:' + org + ':' + slug;
  }

  function readStoredVote(org, slug) {
    try {
      return sessionStorage.getItem(feedbackStorageKey(org, slug)) || '';
    } catch (err) {
      return '';
    }
  }

  function storeVote(org, slug, vote) {
    try {
      sessionStorage.setItem(feedbackStorageKey(org, slug), vote);
    } catch (err) {
      /* optional */
    }
  }

  function submitBlogFeedback(apiOrigin, org, slug, payload) {
    var url = apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org) + '/blog/' + encodeURIComponent(slug) + '/feedback';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok || !body || !body.success) {
          throw new Error((body && body.message) || ('HTTP ' + response.status));
        }
        return body;
      });
    });
  }

  function setCount(el, value) {
    if (el) el.textContent = formatCount(value);
  }

  function bindBlogToolbar(mountEl, context) {
    var root = mountEl.querySelector('[data-ld-blog-post]');
    if (!root) return;

    var followBtn = root.querySelector('[data-ld-follow]');
    var claps = Math.max(0, Number(context.claps) || 0);
    var shares = Math.max(0, Number(context.shares) || 0);
    var clapBusy = false;

    function syncClapUi(next, active) {
      root.querySelectorAll('[data-ld-clap]').forEach(function (btn) {
        if (active) {
          btn.classList.add('is-active');
          btn.setAttribute('aria-pressed', 'true');
          btn.disabled = true;
        }
        setCount(btn.querySelector('[data-ld-clap-count]'), next);
      });
    }

    function syncShareUi(next) {
      root.querySelectorAll('[data-ld-share-count]').forEach(function (el) {
        setCount(el, next);
      });
    }

    if (readStoredVote(context.org, context.slug) === 'yes') {
      syncClapUi(claps, true);
    }

    if (followBtn) {
      followBtn.addEventListener('click', function () {
        var on = followBtn.classList.toggle('is-active');
        followBtn.textContent = on ? 'Following' : 'Follow';
      });
    }

    root.addEventListener('click', function (event) {
      var clapEl = event.target.closest('[data-ld-clap]');
      if (clapEl && root.contains(clapEl)) {
        if (clapEl.classList.contains('is-active') || clapBusy) return;
        clapBusy = true;
        root.querySelectorAll('[data-ld-clap]').forEach(function (btn) { btn.disabled = true; });
        submitBlogFeedback(context.apiOrigin, context.org, context.slug, { helpful: true })
          .then(function (body) {
            storeVote(context.org, context.slug, 'yes');
            var next = body && body.data && body.data.analytics
              ? body.data.analytics.helpfulYes
              : claps + 1;
            claps = next;
            syncClapUi(next, true);
          })
          .catch(function () {
            root.querySelectorAll('[data-ld-clap]').forEach(function (btn) {
              if (!btn.classList.contains('is-active')) btn.disabled = false;
            });
          })
          .then(function () {
            clapBusy = false;
          });
        return;
      }

      var commentEl = event.target.closest('[data-ld-comment]');
      if (commentEl && root.contains(commentEl)) {
        var target = root.querySelector('[data-ld-comments]');
        if (target && target.scrollIntoView) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      var listenEl = event.target.closest('[data-ld-listen]');
      if (listenEl && root.contains(listenEl)) {
        if (!window.speechSynthesis) return;
        var controller = getOrCreateListenController(root, listenEl, context);
        if (controller.isActive()) {
          controller.close();
          return;
        }
        controller.openAndPlay();
        return;
      }

      var shareToggleEl = event.target.closest('[data-ld-share-toggle]');
      if (shareToggleEl && root.contains(shareToggleEl)) {
        var wrap = shareToggleEl.closest('.ld-blog-post__share-wrap');
        var menu = wrap && wrap.querySelector('[data-ld-share-menu]');
        if (!menu) return;
        root.querySelectorAll('[data-ld-share-menu]').forEach(function (other) {
          if (other !== menu) {
            other.hidden = true;
            var otherToggle = other.parentElement && other.parentElement.querySelector('[data-ld-share-toggle]');
            if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
          }
        });
        var open = menu.hidden;
        menu.hidden = !open;
        shareToggleEl.setAttribute('aria-expanded', open ? 'true' : 'false');
        return;
      }

      var shareEl = event.target.closest('[data-share]');
      if (!shareEl || !root.contains(shareEl)) return;
      var platform = shareEl.getAttribute('data-share');
      if (platform === 'copy') {
        event.preventDefault();
        var url = context.pageUrl || window.location.href;
        var done = navigator.clipboard && navigator.clipboard.writeText
          ? navigator.clipboard.writeText(url)
          : Promise.resolve();
        done.then(function () {
          shareEl.textContent = 'Link copied';
          return submitBlogFeedback(context.apiOrigin, context.org, context.slug, {
            action: 'share',
            platform: 'copy',
          });
        }).then(function (body) {
          if (body && body.data && body.data.analytics) {
            shares = body.data.analytics.sharesTotal;
            syncShareUi(shares);
          }
        }).catch(function () { /* optional */ });
        return;
      }
      void submitBlogFeedback(context.apiOrigin, context.org, context.slug, {
        action: 'share',
        platform: platform,
      }).then(function (body) {
        if (body && body.data && body.data.analytics) {
          shares = body.data.analytics.sharesTotal;
          syncShareUi(shares);
        }
      }).catch(function () { /* share still opens */ });
    });

    var commentForm = root.querySelector('[data-ld-comment-form]');
    var commentList = root.querySelector('[data-ld-comment-list]');
    var commentCountEl = root.querySelector('[data-ld-comment-count]');
    var responsesCountEl = root.querySelector('[data-ld-responses-count]');
    var composerActions = root.querySelector('[data-ld-composer-actions]');
    var composerCancel = root.querySelector('[data-ld-composer-cancel]');
    var composerInput = commentForm ? commentForm.querySelector('textarea') : null;
    var activeReplyId = null;
    var MAX_COMMENT_DEPTH = 8;

    function loadLocalComments() {
      try {
        var raw = JSON.parse(localStorage.getItem(commentsStorageKey(context.org, context.slug)) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw.map(function (item, index) {
          return {
            id: item.id || ('c_' + String(item.at || Date.now()) + '_' + index),
            parentId: item.parentId ? String(item.parentId) : null,
            author: item.author || 'You',
            text: String(item.text || ''),
            at: item.at || Date.now(),
            claps: Math.max(0, Number(item.claps) || 0),
            avatar: item.avatar || '',
          };
        });
      } catch (err) {
        return [];
      }
    }

    function saveLocalComments(items) {
      try {
        localStorage.setItem(commentsStorageKey(context.org, context.slug), JSON.stringify(items));
      } catch (err) {
        /* optional */
      }
    }

    function updateResponseCounts(total) {
      setCount(commentCountEl, total);
      if (responsesCountEl) responsesCountEl.textContent = String(total);
    }

    function childrenOf(items, parentId) {
      var pid = parentId || null;
      return items.filter(function (item) {
        return (item.parentId || null) === pid;
      }).sort(function (a, b) {
        return (a.at || 0) - (b.at || 0);
      });
    }

    function descendantCount(items, id) {
      var total = 0;
      childrenOf(items, id).forEach(function (child) {
        total += 1 + descendantCount(items, child.id);
      });
      return total;
    }

    function findComment(items, id) {
      for (var i = 0; i < items.length; i += 1) {
        if (items[i].id === id) return items[i];
      }
      return null;
    }

    function depthOf(items, id) {
      var depth = 0;
      var current = findComment(items, id);
      while (current && current.parentId) {
        depth += 1;
        current = findComment(items, current.parentId);
        if (depth > MAX_COMMENT_DEPTH) break;
      }
      return depth;
    }

    function buildReplyComposerHtml(parentItem) {
      return (
        '<form class="ld-blog-responses__reply-box" data-ld-reply-form data-parent-id="' + escapeHtml(parentItem.id) + '">' +
          '<div class="ld-blog-responses__reply-to">Replying to ' + escapeHtml(parentItem.author || 'comment') + '</div>' +
          '<textarea class="ld-blog-responses__reply-input" rows="3" placeholder="What are your thoughts?" required></textarea>' +
          '<div class="ld-blog-responses__reply-toolbar">' +
            '<div class="ld-blog-responses__reply-formats" aria-hidden="true">' +
              '<span class="ld-blog-responses__fmt">B</span>' +
              '<span class="ld-blog-responses__fmt ld-blog-responses__fmt--italic">i</span>' +
            '</div>' +
            '<div class="ld-blog-responses__composer-actions">' +
              '<button type="button" class="ld-blog-responses__cancel" data-ld-reply-cancel>Cancel</button>' +
              '<button type="submit" class="ld-blog-responses__submit">Comment</button>' +
            '</div>' +
          '</div>' +
        '</form>'
      );
    }

    function buildCommentCardHtml(item, items, depth) {
      var author = item.author || 'You';
      var clipped = truncateCommentText(item.text, 220);
      var claps = Math.max(0, Number(item.claps) || 0);
      var replies = descendantCount(items, item.id);
      var kids = childrenOf(items, item.id);
      var canReply = depth < MAX_COMMENT_DEPTH;
      return (
        '<li class="ld-blog-responses__item' + (depth > 0 ? ' ld-blog-responses__item--nested' : '') + '" ' +
          'data-ld-comment-id="' + escapeHtml(item.id) + '" data-depth="' + depth + '">' +
          '<div class="ld-blog-responses__card">' +
            '<div class="ld-blog-responses__item-top">' +
              buildResponseAvatar(author, item.avatar || '') +
              '<div class="ld-blog-responses__meta">' +
                '<div class="ld-blog-responses__name">' + escapeHtml(author) + '</div>' +
                '<div class="ld-blog-responses__date">' + escapeHtml(formatCommentDate(item.at)) + '</div>' +
              '</div>' +
              '<button type="button" class="ld-blog-responses__more" aria-label="More">' + MORE_ICON + '</button>' +
            '</div>' +
            '<div class="ld-blog-responses__body">' +
              '<p class="ld-blog-responses__text"' +
                (clipped.truncated ? ' data-ld-full="' + escapeHtml(clipped.full) + '"' : '') +
              '>' + escapeHtml(clipped.text) +
                (clipped.truncated
                  ? '<button type="button" class="ld-blog-responses__expand" data-ld-expand>…&nbsp;more</button>'
                  : '') +
              '</p>' +
            '</div>' +
            '<div class="ld-blog-responses__item-actions">' +
              '<button type="button" class="ld-blog-responses__action" data-ld-response-clap aria-label="Appreciate">' +
                CLAP_ICON + '<span>' + escapeHtml(formatCount(claps)) + '</span>' +
              '</button>' +
              '<button type="button" class="ld-blog-responses__action" data-ld-response-replies aria-label="Replies">' +
                COMMENT_ICON +
                '<span>' + escapeHtml(replies === 1 ? '1 reply' : (replies + ' replies')) + '</span>' +
              '</button>' +
              (canReply
                ? '<button type="button" class="ld-blog-responses__reply" data-ld-response-reply>Reply</button>'
                : '') +
            '</div>' +
            (activeReplyId === item.id ? buildReplyComposerHtml(item) : '') +
          '</div>' +
          (kids.length
            ? '<ul class="ld-blog-responses__children">' +
                kids.map(function (child) {
                  return buildCommentCardHtml(child, items, depth + 1);
                }).join('') +
              '</ul>'
            : '') +
        '</li>'
      );
    }

    function renderLocalComments() {
      if (!commentList) return;
      var items = loadLocalComments();
      updateResponseCounts(items.length);
      var roots = childrenOf(items, null);
      commentList.innerHTML = roots.map(function (item) {
        return buildCommentCardHtml(item, items, 0);
      }).join('');
    }

    function collapseComposer() {
      if (composerInput) {
        composerInput.value = '';
        composerInput.rows = 1;
        composerInput.blur();
      }
      if (composerActions) composerActions.hidden = true;
      if (commentForm) commentForm.classList.remove('is-expanded');
    }

    function openReplyComposer(commentId) {
      activeReplyId = commentId;
      collapseComposer();
      renderLocalComments();
      window.setTimeout(function () {
        var replyInput = commentList && commentList.querySelector(
          '[data-ld-reply-form][data-parent-id="' + commentId + '"] textarea'
        );
        if (replyInput) replyInput.focus();
      }, 0);
    }

    function closeReplyComposer() {
      activeReplyId = null;
      renderLocalComments();
    }

    function addComment(text, parentId) {
      var items = loadLocalComments();
      var parent = parentId ? findComment(items, parentId) : null;
      if (parentId && !parent) return;
      if (parent && depthOf(items, parent.id) >= MAX_COMMENT_DEPTH) return;
      items.unshift({
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        parentId: parentId || null,
        author: 'You',
        text: text,
        at: Date.now(),
        claps: 0,
        avatar: '',
      });
      saveLocalComments(items);
      activeReplyId = null;
      renderLocalComments();
    }

    renderLocalComments();

    if (composerInput) {
      composerInput.addEventListener('focus', function () {
        var hadReply = Boolean(activeReplyId);
        activeReplyId = null;
        if (composerActions) composerActions.hidden = false;
        composerInput.rows = 3;
        if (commentForm) commentForm.classList.add('is-expanded');
        if (hadReply) renderLocalComments();
      });
    }
    if (composerCancel) {
      composerCancel.addEventListener('click', collapseComposer);
    }

    if (commentList) {
      commentList.addEventListener('click', function (event) {
        var expandBtn = event.target.closest('[data-ld-expand]');
        if (expandBtn) {
          var textEl = expandBtn.closest('.ld-blog-responses__text');
          if (!textEl) return;
          var full = textEl.getAttribute('data-ld-full') || '';
          textEl.textContent = full;
          textEl.removeAttribute('data-ld-full');
          return;
        }

        var replyBtn = event.target.closest('[data-ld-response-reply]');
        if (replyBtn) {
          var replyItem = replyBtn.closest('[data-ld-comment-id]');
          if (!replyItem) return;
          openReplyComposer(replyItem.getAttribute('data-ld-comment-id'));
          return;
        }

        var replyCancel = event.target.closest('[data-ld-reply-cancel]');
        if (replyCancel) {
          closeReplyComposer();
          return;
        }

        var clapBtnLocal = event.target.closest('[data-ld-response-clap]');
        if (clapBtnLocal) {
          var clapItem = clapBtnLocal.closest('[data-ld-comment-id]');
          if (!clapItem) return;
          var all = loadLocalComments();
          var target = findComment(all, clapItem.getAttribute('data-ld-comment-id'));
          if (!target) return;
          target.claps = Math.max(0, Number(target.claps) || 0) + 1;
          saveLocalComments(all);
          renderLocalComments();
        }
      });

      commentList.addEventListener('submit', function (event) {
        var replyForm = event.target.closest('[data-ld-reply-form]');
        if (!replyForm) return;
        event.preventDefault();
        var input = replyForm.querySelector('textarea');
        var text = input && input.value ? String(input.value).trim() : '';
        if (!text) return;
        addComment(text, replyForm.getAttribute('data-parent-id'));
      });
    }

    if (commentForm) {
      commentForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var input = commentForm.querySelector('textarea');
        var text = input && input.value ? String(input.value).trim() : '';
        if (!text) return;
        addComment(text, null);
        collapseComposer();
      });
    }
  }

  function resolveEmbedOrigin(apiOrigin) {
    // /embed/* is served by the client/static host, not the API.
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin.replace(/\/$/, '');
    }
    return String(apiOrigin || '').replace(/\/$/, '');
  }

  function ensureStylesheet(apiOrigin) {
    if (
      document.querySelector('link[data-arivu-headless-blocks-css]')
      || document.querySelector('link[data-ld-headless-blocks-css]')
    ) {
      return;
    }
    var origin = resolveEmbedOrigin(apiOrigin);
    var href = origin + '/embed/headless-blocks.css';
    if (!document.querySelector('link[rel="preload"][href="' + href + '"]')) {
      var preload = document.createElement('link');
      preload.rel = 'preload';
      preload.as = 'style';
      preload.href = href;
      document.head.appendChild(preload);
    }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-arivu-headless-blocks-css', 'true');
    link.setAttribute('data-ld-headless-blocks-css', 'true');
    document.head.appendChild(link);
  }

  function ensureBlocksScript(apiOrigin) {
    return new Promise(function (resolve, reject) {
      if (window.LiteDeskHeadlessBlocks) {
        resolve(window.LiteDeskHeadlessBlocks);
        return;
      }
      var existing = document.querySelector('script[data-ld-headless-blocks-js]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.LiteDeskHeadlessBlocks); });
        existing.addEventListener('error', reject);
        return;
      }
      var origin = resolveEmbedOrigin(apiOrigin);
      var script = document.createElement('script');
      script.src = origin + '/embed/headless-blocks.js';
      script.async = true;
      script.setAttribute('data-ld-headless-blocks-js', 'true');
      script.onload = function () { resolve(window.LiteDeskHeadlessBlocks); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function ensureHelpCommonScript(apiOrigin) {
    return new Promise(function (resolve, reject) {
      if (window.LiteDeskHeadlessHelpCommon) {
        resolve(window.LiteDeskHeadlessHelpCommon);
        return;
      }
      var existing = document.querySelector('script[data-ld-headless-help-common-js]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.LiteDeskHeadlessHelpCommon); });
        existing.addEventListener('error', reject);
        return;
      }
      var script = document.createElement('script');
      script.src = resolveEmbedOrigin(apiOrigin) + '/embed/headless-help-common.js';
      script.async = true;
      script.setAttribute('data-ld-headless-help-common-js', 'true');
      script.onload = function () { resolve(window.LiteDeskHeadlessHelpCommon); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function normalizeLinkPrefix(value) {
    var prefix = String(value || '/help/').trim();
    if (!prefix) return '/help/';
    if (prefix.indexOf('?') >= 0) return prefix;
    if (!prefix.endsWith('/')) prefix += '/';
    if (!prefix.startsWith('/')) prefix = '/' + prefix;
    return prefix;
  }

  function buildArticleChromeMeta(article) {
    var categoryName = String(article.collectionName || '').trim();
    var readMinutes = Number(article.readMinutes) || 0;
    var readLabel = readMinutes > 0 ? readMinutes + ' min read' : '';
    if (!categoryName && !readLabel) return '';
    return (
      '<div class="ld-article-chrome__meta">' +
        (categoryName ? '<span class="ld-article-chrome__chip">' + escapeHtml(categoryName) + '</span>' : '') +
        (readLabel ? '<span class="ld-article-chrome__read">' + escapeHtml(readLabel) + '</span>' : '') +
      '</div>' +
      '<hr class="ld-article-chrome__divider" aria-hidden="true" />'
    );
  }

  function buildChromeShell(options) {
    return options.common.buildArticlePageHtml({
      topbarHtml: options.topbarHtml,
      navHtml: options.navHtml,
      mainHtml: options.articleHtml,
      railHtml: options.railHtml,
    });
  }

  function resolveChromeOptions(options) {
    var showSidebar = options.showSidebar === true || options.showSidebar === 'true';
    var showBreadcrumbs = showSidebar
      || options.showBreadcrumbs === true
      || options.showBreadcrumbs === 'true';
    return {
      enabled: showSidebar || showBreadcrumbs,
      showSidebar: showSidebar,
      showBreadcrumbs: showBreadcrumbs,
      homePrefix: normalizeLinkPrefix(options.homePrefix || '/help/'),
      categoryPrefix: normalizeLinkPrefix(options.categoryPrefix || options.linkPrefix || '/help/'),
      sectionPrefix: normalizeLinkPrefix(options.sectionPrefix || options.linkPrefix || '/help/'),
      articlePrefix: normalizeLinkPrefix(options.articlePrefix || options.linkPrefix || '/help/'),
      collectionSlug: normalizeSlug(options.collection || options.parent || ''),
      sectionSlug: normalizeSlug(options.section || ''),
      homeLabel: String(options.homeLabel || 'Support'),
      popularTitle: String(options.popularTitle || 'Popular articles'),
      recentTitle: String(options.recentTitle || 'Recent articles'),
      topicsTitle: String(options.topicsTitle || 'Topics'),
      popularEmptyLabel: String(options.popularEmptyLabel || 'No popular articles yet.'),
      recentEmptyLabel: String(options.recentEmptyLabel || 'No recent articles.'),
      recentLimit: Math.min(Math.max(Number(options.recentLimit) || 5, 1), 25),
      breadcrumbLabel: String(options.breadcrumbLabel || 'Breadcrumb'),
      showFeedbackFooter: options.showFeedbackFooter !== false && options.showFeedbackFooter !== 'false',
      helpfulLabel: String(options.helpfulLabel || 'Helpful?'),
      shareLabel: String(options.shareLabel || 'Share :'),
      yesLabel: String(options.yesLabel || 'Yes'),
      noLabel: String(options.noLabel || 'No'),
      thanksLabel: String(options.thanksLabel || 'Thanks for your feedback.'),
      pageUrl: String(options.pageUrl || ''),
      searchPlaceholder: String(options.searchPlaceholder || 'Search'),
    };
  }

  function mountArticle(options) {
    var org = String(options.org || '').trim();
    var slug = normalizeSlug(options.slug);
    var target = options.target;
    var apiOrigin = String(options.apiOrigin || '').replace(/\/$/, '');
    var mountEl = typeof target === 'string' ? document.querySelector(target) : target;
    var chrome = resolveChromeOptions(options);
    chrome.org = org;
    chrome.slug = slug;
    if (options.rssEnabled !== false) {
      chrome.rssHref = apiOrigin
        + '/api/public/v1/content/'
        + encodeURIComponent(org)
        + '/blog/'
        + encodeURIComponent(slug)
        + '/rss.xml';
    }

    if (!org || !slug) return Promise.reject(new Error('org and slug are required'));
    if (!mountEl) return Promise.reject(new Error('target element not found'));
    if (!apiOrigin) return Promise.reject(new Error('api origin could not be resolved'));

    var contentBase = apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org);
    var articleUrl = contentBase + '/blog/' + encodeURIComponent(slug);
    var renderUrl = apiOrigin + '/api/public/v1/content/render-blocks';
    var sectionSlug = chrome.sectionSlug;
    var parentSlug = chrome.collectionSlug;
    var widgetOptions = {
      collection: sectionSlug || '',
      deep: true,
      limit: chrome.recentLimit,
      articlePrefix: chrome.articlePrefix,
      sectionContext: { slug: sectionSlug, parentSlug: parentSlug, collectionSlug: sectionSlug },
      popularTitle: chrome.popularTitle,
      recentTitle: chrome.recentTitle,
      popularEmptyLabel: chrome.popularEmptyLabel,
      recentEmptyLabel: chrome.recentEmptyLabel,
    };

    if (!mountEl.querySelector('.ld-help-skeleton')) {
      var commonForSkeleton = window.LiteDeskHeadlessHelpCommon || window.ArivuHeadlessHelpCommon;
      mountEl.innerHTML = commonForSkeleton
        ? commonForSkeleton.buildMountSkeleton({ type: 'page', showRail: chrome.showSidebar })
        : '<div class="ld-help-site ld-help-skeleton" aria-busy="true" aria-label="Loading"></div>';
    }
    ensureStylesheet(apiOrigin);

    var collectionsPromise = chrome.enabled
      ? ensureHelpCommonScript(apiOrigin).then(function (common) {
        return common.fetchCollections(contentBase);
      })
      : Promise.resolve(null);

    return Promise.all([
      fetch(articleUrl).then(function (response) {
        return response.json().then(function (payload) {
          return { response: response, payload: payload };
        });
      }),
      collectionsPromise,
    ])
      .then(function (results) {
        var articleResult = results[0];
        var collectionsResult = results[1];

        if (!articleResult.response.ok || !articleResult.payload || !articleResult.payload.success) {
          throw new Error((articleResult.payload && articleResult.payload.message) || ('HTTP ' + articleResult.response.status));
        }

        var article = articleResult.payload.data;
        var publishing = articleResult.payload.publishing || {};
        if (publishing.rssEnabled === false) {
          chrome.rssHref = '';
        } else if (chrome.rssHref && typeof document !== 'undefined') {
          var existingRss = document.querySelector('link[data-arivu-blog-post-rss]');
          if (existingRss) {
            existingRss.setAttribute('href', chrome.rssHref);
            existingRss.setAttribute('title', article.title || 'Post RSS');
          } else {
            var rssLink = document.createElement('link');
            rssLink.rel = 'alternate';
            rssLink.type = 'application/rss+xml';
            rssLink.href = chrome.rssHref;
            rssLink.title = article.title || 'Post RSS';
            rssLink.setAttribute('data-arivu-blog-post-rss', 'true');
            document.head.appendChild(rssLink);
          }
        }
        var common = window.LiteDeskHeadlessHelpCommon || window.ArivuHeadlessHelpCommon;
        var resolvedSectionSlug = chrome.sectionSlug || normalizeSlug(article.collectionSlug);
        var resolvedParentSlug = chrome.collectionSlug;
        var collectionEntry = null;
        var sectionContext = { slug: resolvedSectionSlug, parentSlug: resolvedParentSlug, collectionSlug: resolvedSectionSlug };
        widgetOptions.collection = resolvedSectionSlug || normalizeSlug(article.collectionSlug) || '';
        widgetOptions.sectionContext = sectionContext;

        if (collectionsResult && common) {
          collectionEntry = common.findCollectionEntry(
            collectionsResult.index,
            resolvedSectionSlug,
            resolvedParentSlug || undefined,
          );
          if (collectionEntry) {
            sectionContext = collectionEntry.node;
            widgetOptions.sectionContext = sectionContext;
            widgetOptions.collection = sectionContext.slug || widgetOptions.collection;
          }
        }

        var articleLinkPrefix = common
          ? common.buildArticleBasePath(chrome.articlePrefix, sectionContext)
          : chrome.articlePrefix;

        return fetch(renderUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            blocks: article.blocks,
            bodyOnly: true,
            articleLinkPrefix: articleLinkPrefix,
          }),
        }).then(function (renderResponse) {
          return renderResponse.json().then(function (renderPayload) {
            return {
              article: article,
              publishing: articleResult.payload.publishing || {},
              renderPayload: renderPayload,
              renderResponse: renderResponse,
              collectionsResult: collectionsResult,
              collectionEntry: collectionEntry,
              sectionContext: sectionContext,
              common: common,
              sidebarWidgets: null,
            };
          });
        });
      })
      .then(function (result) {
        if (!result.renderResponse.ok || !result.renderPayload || !result.renderPayload.success) {
          throw new Error((result.renderPayload && result.renderPayload.message) || 'Failed to render article blocks');
        }

        var bodyHtml = absolutizeEmbedHtml(result.renderPayload.html, apiOrigin);
        if (chrome.showSidebar && result.common) {
          bodyHtml = result.common.injectHeadingIds(bodyHtml);
        }
        var articleHtml = buildBlogPostShell(
          result.article,
          bodyHtml,
          chrome,
          apiOrigin,
        );
        var pageHtml = articleHtml;

        if (chrome.enabled && result.common) {
          var breadcrumbsHtml = '';
          if (chrome.showBreadcrumbs) {
            breadcrumbsHtml = result.common.buildBreadcrumbHtml({
              path: result.collectionEntry ? result.collectionEntry.path : [],
              homePrefix: chrome.homePrefix,
              categoryPrefix: chrome.categoryPrefix,
              sectionPrefix: chrome.sectionPrefix,
              homeLabel: chrome.homeLabel,
              breadcrumbLabel: chrome.breadcrumbLabel,
              currentLabel: result.article.title || result.article.slug,
            });
          }

          var topbarHtml = result.common.buildHelpTopbar({
            breadcrumbsHtml: breadcrumbsHtml,
          });

          var railHtml = '';

          return paintChromePage();

          function paintChromePage() {
            var tocHtml = '';
            if (chrome.showSidebar) {
              tocHtml = result.common.buildTocHtml(bodyHtml);
            }
            railHtml = result.common.buildHelpRailHtml({
              tocHtml: tocHtml,
              searchPlaceholder: chrome.searchPlaceholder,
              homePrefix: chrome.homePrefix,
            });

            mountEl.innerHTML = buildChromeShell({
              common: result.common,
              topbarHtml: topbarHtml,
              navHtml: '',
              articleHtml: articleHtml,
              railHtml: railHtml,
            });

            var chromeRoot = mountEl.querySelector('[data-ld-help-article]');
            if (chromeRoot) {
              result.common.bindHelpSiteChrome(chromeRoot, {
                homePrefix: chrome.homePrefix,
                homeLabel: chrome.homeLabel,
                org: org,
                apiOrigin: apiOrigin,
                articlePrefix: chrome.articlePrefix,
                linkPrefix: chrome.articlePrefix,
                collectionIndex: result.collectionsResult ? result.collectionsResult.index : [],
              });
            }
            return finishMount(result.article, mountEl, apiOrigin, org, slug, chrome);
          }
        }

        mountEl.innerHTML = pageHtml;
        return finishMount(result.article, mountEl, apiOrigin, org, slug, chrome);
      })
      .catch(function (error) {
        mountEl.innerHTML = '<p class="ld-article__error">' + escapeHtml(error.message || 'Failed to load article') + '</p>';
        throw error;
      });
  }

  function finishMount(article, mountEl, apiOrigin, org, slug, chrome) {
    var engagement = article && article.engagement ? article.engagement : {};
    bindBlogToolbar(mountEl, {
      apiOrigin: apiOrigin,
      org: org,
      slug: slug,
      title: article.title || '',
      subtitle: article.subtitle || '',
      pageUrl: chrome.pageUrl || (typeof window !== 'undefined' ? window.location.href : ''),
      claps: engagement.claps,
      shares: engagement.shares,
      comments: engagement.comments,
    });
    return ensureBlocksScript(apiOrigin).then(function (blocks) {
      blocks.init(mountEl);
      var common = window.LiteDeskHeadlessHelpCommon || window.ArivuHeadlessHelpCommon;
      var chromeRoot = mountEl.querySelector('[data-ld-help-article]');
      if (chromeRoot && common) {
        if (common.bindArticleTocRail) common.bindArticleTocRail(chromeRoot);
        if (common.bindTocSmoothScroll) common.bindTocSmoothScroll(chromeRoot);
      }
      return article;
    });
  }

  var script = document.currentScript;
  if (!script) {
    script = document.querySelector('script[src*="/embed/headless-blog-post.js"]');
  }

  window.LiteDeskHeadlessBlogPost = {
    mount: mountArticle,
  };
  window.ArivuHeadlessBlogPost = window.LiteDeskHeadlessBlogPost;

  if (script) {
    var org = getAttr(script, 'data-org', '');
    var slug = getAttr(script, 'data-slug', '');
    var target = getAttr(script, 'data-target', '#ld-article');
    var apiOrigin = resolveApiOrigin(script);
    var linkPrefix = getAttr(script, 'data-link-prefix', '/blog/');
    var showSidebar = getAttr(script, 'data-show-sidebar', 'false') === 'true';
    var showBreadcrumbs = getAttr(script, 'data-show-breadcrumbs', showSidebar ? 'true' : 'false') === 'true';
    if (org && slug) {
      mountArticle({
        org: org,
        slug: slug,
        target: target,
        apiOrigin: apiOrigin,
        showSidebar: showSidebar,
        showBreadcrumbs: showBreadcrumbs,
        showFeedbackFooter: getAttr(script, 'data-show-feedback-footer', 'false') === 'true',
        linkPrefix: linkPrefix,
        homePrefix: getAttr(script, 'data-home-prefix', linkPrefix),
        categoryPrefix: getAttr(script, 'data-category-prefix', linkPrefix),
        sectionPrefix: getAttr(script, 'data-section-prefix', linkPrefix),
        articlePrefix: getAttr(script, 'data-article-prefix', linkPrefix),
        collection: getAttr(script, 'data-collection', ''),
        section: getAttr(script, 'data-section', ''),
        helpfulLabel: getAttr(script, 'data-helpful-label', ''),
        shareLabel: getAttr(script, 'data-share-label', ''),
        yesLabel: getAttr(script, 'data-feedback-yes-label', ''),
        noLabel: getAttr(script, 'data-feedback-no-label', ''),
        thanksLabel: getAttr(script, 'data-feedback-thanks-label', ''),
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      }).catch(function (error) {
        console.error('[LiteDeskHeadlessBlogPost]', error);
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
