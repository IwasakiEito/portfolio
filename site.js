// Shared navigation, project discovery and media controls. No build step required.
(() => {
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.global-nav');
  const closeMenu = () => {
    menu?.setAttribute('aria-expanded', 'false');
    nav?.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  };
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
  });
  nav?.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (menu?.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') { closeMenu(); menu.focus(); }
    if (event.key === 'Tab') {
      const links = [...nav.querySelectorAll('a')];
      if (event.shiftKey && document.activeElement === menu) {
        event.preventDefault(); links.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === links.at(-1)) {
        event.preventDefault(); menu.focus();
      }
    }
  });
  matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);

  const filters = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('.works-grid .work-card')];
  const count = document.getElementById('work-count');
  const filterToolbar = document.querySelector('.works-toolbar');
  if (filterToolbar) filterToolbar.hidden = false;
  function filterWorks(value, persist = true) {
    if (!filters.length) return;
    const selected = filters.some(button => button.dataset.filter === value) ? value : 'all';
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === selected)));
    cards.forEach(card => { card.hidden = selected !== 'all' && !card.dataset.category.split(' ').includes(selected); });
    // Carry the chosen field into details so the list return keeps its context.
    cards.forEach(card => {
      const link = card.querySelector('.work-card-link');
      const path = link.getAttribute('href').split('?')[0];
      link.setAttribute('href', selected === 'all' ? path : `${path}?field=${selected}`);
    });
    count.textContent = `${cards.filter(card => !card.hidden).length}作品を表示`;
    if (persist) {
      const url = new URL(location.href);
      if (selected === 'all') url.searchParams.delete('field');
      else url.searchParams.set('field', selected);
      history.replaceState(null, '', url);
    }
  }
  filters.forEach(button => button.addEventListener('click', () => filterWorks(button.dataset.filter)));
  document.querySelectorAll('[data-filter-link]').forEach(link => link.addEventListener('click', () => filterWorks(link.dataset.filterLink)));
  filterWorks(new URLSearchParams(location.search).get('field') || 'all', false);
  window.addEventListener('popstate', () => filterWorks(new URLSearchParams(location.search).get('field') || 'all', false));

  // Direct list links and returns from a project reveal the compact homepage archive.
  const archive = document.getElementById('project-archive');
  const revealArchive = () => {
    if (archive && (location.hash === '#works' || new URLSearchParams(location.search).has('field'))) archive.open = true;
  };
  revealArchive();
  window.addEventListener('hashchange', revealArchive);
  window.addEventListener('popstate', revealArchive);
  document.querySelectorAll('a[href="#works"]').forEach(link => link.addEventListener('click', () => { if (archive) archive.open = true; }));

  const returnField = new URLSearchParams(location.search).get('field');
  if (!filters.length && ['game', 'audio', 'tool'].includes(returnField)) {
    document.querySelectorAll('a[href]').forEach(link => {
      const url = new URL(link.getAttribute('href'), location.href);
      if (url.origin !== location.origin) return;
      const list = url.pathname.endsWith('/index.html') && url.hash === '#works';
      const project = /\/works\/[a-z-]+\.html$/.test(url.pathname) && url.pathname !== location.pathname;
      if (!list && !project) return;
      url.searchParams.set('field', returnField);
      link.setAttribute('href', url.href);
    });
  }

  // Preserve bookmarks to the original single-page project sections.
  const projectIds = ['butto-bash', 'resonance-hunt', 'animaly', 'voice-filter', 'soundlib', 'kurutto', 'planet', 'kitten', 'gravity', 'stealth'];
  function resolveLegacyAnchor() {
    if (!cards.length) return;
    const id = location.hash.slice(1);
    if (projectIds.includes(id)) location.replace(`works/${id}.html`);
    else if (id === 'implementation') { location.hash = 'expertise'; }
  }
  resolveLegacyAnchor();
  window.addEventListener('hashchange', resolveLegacyAnchor);

  // Highlight the section currently being read in the project contents.
  const tocLinks = [...document.querySelectorAll('.project-toc a')];
  const tocTargets = tocLinks.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
  if (tocTargets.length) {
    const markCurrent = () => {
      let current = tocTargets[0];
      tocTargets.forEach(target => { if (target.getBoundingClientRect().top <= 180) current = target; });
      tocLinks.forEach(link => {
        const active = link.hash === '#' + current.id;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    let scheduled = false;
    window.addEventListener('scroll', () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { markCurrent(); scheduled = false; });
    }, { passive: true });
    markCurrent();
  }

  // Load the official API on demand so playback errors are visible to visitors.
  let youtubeApi;
  const loadYouTubeApi = () => {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtubeApi) return youtubeApi;
    youtubeApi = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const previousReady = window.onYouTubeIframeAPIReady;
      const timeout = setTimeout(() => { script.remove(); reject(new Error('YouTube API timeout')); }, 15000);
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timeout);
        previousReady?.();
        resolve(window.YT);
      };
      script.src = 'https://www.youtube.com/iframe_api';
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('YouTube API unavailable')); };
      document.head.append(script);
    }).catch(error => { youtubeApi = undefined; throw error; });
    return youtubeApi;
  };

  // HTTP previews and the published site identify their actual origin. A file://
  // preview has no HTTP identity, so it uses the ordinary YouTube watch page.
  document.querySelectorAll('.youtube-embed').forEach(container => {
    const button = container.querySelector('.youtube-start');
    const status = container.querySelector('.youtube-status');
    if (!['http:', 'https:'].includes(location.protocol)) {
      const link = document.createElement('a');
      link.className = button.className;
      link.innerHTML = button.innerHTML;
      link.href = `https://www.youtube.com/watch?v=${container.dataset.videoId}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', `${container.dataset.videoTitle}をYouTubeで再生`);
      link.querySelector('.youtube-start-label').textContent = '▶ YouTubeで再生';
      button.replaceWith(link);
      return;
    }
    let timer;
    let player;
    let attempt = 0;
    button.addEventListener('click', async () => {
      const currentAttempt = ++attempt;
      clearTimeout(timer);
      player?.destroy();
      player = undefined;
      container.querySelector('iframe')?.remove();
      const frame = document.createElement('iframe');
      frame.className = 'youtube-player';
      frame.title = container.dataset.videoTitle;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      const params = new URLSearchParams({ playsinline: '1', autoplay: '1', enablejsapi: '1', origin: location.origin });
      frame.src = `https://www.youtube.com/embed/${container.dataset.videoId}?${params}`;
      status.textContent = 'YouTubeプレーヤーを読み込んでいます…';
      status.hidden = false;
      button.hidden = true;
      container.prepend(frame);
      const showFallback = message => {
        if (currentAttempt !== attempt) return;
        clearTimeout(timer);
        status.textContent = message;
        status.hidden = false;
        button.querySelector('.youtube-start-label').textContent = 'プレーヤーを再読み込み';
        button.classList.add('youtube-retry');
        button.setAttribute('aria-label', `${container.dataset.videoTitle}のプレーヤーを再読み込み`);
        button.hidden = false;
      };
      const discardPlayer = () => {
        player?.destroy();
        player = undefined;
        frame.remove();
      };
      timer = setTimeout(() => {
        if (currentAttempt !== attempt) return;
        discardPlayer();
        showFallback('動画を読み込めませんでした。再読み込みするか、下のYouTubeリンクからご覧ください。');
      }, 20000);
      try {
        const api = await loadYouTubeApi();
        if (currentAttempt !== attempt) return;
        player = new api.Player(frame, { events: {
          onReady: () => {
            if (currentAttempt !== attempt) return;
            clearTimeout(timer);
            status.hidden = true;
          },
          onStateChange: event => {
            if (currentAttempt !== attempt) return;
            if (event.data === api.PlayerState.PLAYING) {
              clearTimeout(timer);
              status.hidden = true;
              button.hidden = true;
              document.querySelectorAll('audio, video').forEach(media => media.pause());
            }
          },
          onAutoplayBlocked: () => {
            if (currentAttempt !== attempt) return;
            clearTimeout(timer);
            status.textContent = '動画内の再生ボタンを押してご覧ください。';
            status.hidden = false;
          },
          onError: event => {
            if (currentAttempt !== attempt) return;
            player?.destroy();
            player = undefined;
            frame.remove();
            const message = event.data === 153
              ? 'このブラウザではサイト内で再生できません（エラー153）。下のYouTubeリンクからご覧ください。'
              : [101, 150].includes(event.data)
                ? 'この動画はサイト内での再生が許可されていません。下のYouTubeリンクからご覧ください。'
                : '動画を再生できませんでした。下のYouTubeリンクからご覧ください。';
            showFallback(message);
          }
        } });
      } catch {
        if (currentAttempt !== attempt) return;
        discardPlayer();
        showFallback('プレーヤーとの接続を確認できませんでした。再生できない場合は、下のYouTubeリンクからご覧ください。');
      }
    });
  });

  // A native dialog supplies focus containment, Escape, and focus restoration.
  const dialog = document.querySelector('.image-lightbox');
  if (dialog) {
    const preview = dialog.querySelector('img');
    const caption = dialog.querySelector('.lightbox-caption');
    let opener;
    document.querySelectorAll('.project-detail img:not(.youtube-start img)').forEach(img => {
      if (img.closest('a, button')) return;
      img.classList.add('zoomable-image');
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', (img.alt || '画像') + 'を拡大表示');
      const open = () => {
        opener = img;
        preview.src = img.currentSrc || img.src;
        preview.alt = img.alt;
        const imageWidth = img.naturalWidth || Number(img.getAttribute('width'));
        const imageHeight = img.naturalHeight || Number(img.getAttribute('height'));
        dialog.classList.toggle('portrait-image', imageHeight > imageWidth);
        caption.textContent = img.closest('figure')?.querySelector('figcaption')?.textContent || img.alt;
        document.body.classList.add('lightbox-open');
        dialog.showModal();
        dialog.scrollTop = 0;
      };
      img.addEventListener('click', open);
      img.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
      });
    });
    dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('lightbox-open');
      preview.removeAttribute('src');
      opener?.focus({ preventScroll: true });
    });
  }

  // One click compares the same source with a processed sample, in that order.
  const original = document.querySelector('.audio-original audio');
  const comparisonStatus = document.querySelector('.audio-comparison-status');
  let comparison;
  const finishComparison = message => {
    if (!comparison) return;
    const run = comparison;
    comparison = undefined;
    run.cleanup();
    run.button.textContent = '原音 → 加工音で聴く';
    run.button.setAttribute('aria-pressed', 'false');
    run.button.setAttribute('aria-label', `${run.button.dataset.compareAudio}を原音と続けて比較`);
    comparisonStatus.textContent = message;
  };
  if (original && comparisonStatus) {
    comparisonStatus.hidden = false;
    document.querySelectorAll('[data-compare-audio]').forEach(button => {
      const processed = button.closest('.audio-demo-card').querySelector('audio');
      button.hidden = false;
      button.setAttribute('aria-label', `${button.dataset.compareAudio}を原音と続けて比較`);
      button.addEventListener('click', () => {
        const previous = comparison;
        const stopping = previous?.button === button;
        finishComparison('比較試聴を停止しました。');
        previous?.current.pause();
        if (stopping) return;
        const run = { button, current: original, cleanup: () => {} };
        comparison = run;
        button.textContent = '比較試聴を停止';
        button.setAttribute('aria-pressed', 'true');
        button.setAttribute('aria-label', `${button.dataset.compareAudio}の比較試聴を停止`);
        const failed = () => {
          if (comparison === run) finishComparison('音声を再生できませんでした。下の音声プレーヤーからお試しください。');
        };
        const play = media => {
          run.current = media;
          comparisonStatus.textContent = `${button.dataset.compareAudio}：${media === original ? '原音' : '加工音'}を再生中`;
          media.currentTime = 0;
          media.play().catch(failed);
        };
        const ended = event => {
          if (comparison !== run || event.target !== run.current) return;
          if (run.current === original) play(processed);
          else finishComparison(`${button.dataset.compareAudio}の比較試聴が終わりました。`);
        };
        const paused = event => {
          if (comparison === run && event.target === run.current && run.current.paused && !run.current.ended) finishComparison('比較試聴を停止しました。');
        };
        [original, processed].forEach(media => {
          media.addEventListener('ended', ended);
          media.addEventListener('pause', paused);
          media.addEventListener('error', failed);
        });
        run.cleanup = () => [original, processed].forEach(media => {
          media.removeEventListener('ended', ended);
          media.removeEventListener('pause', paused);
          media.removeEventListener('error', failed);
        });
        play(original);
      });
    });
  }

  // The homepage uses one processed player; changing its effect never starts playback.
  document.querySelectorAll('[data-audio-effect]').forEach(select => {
    const card = select.closest('.audio-demo-card');
    const processed = card.querySelector('audio');
    const button = card.querySelector('[data-compare-audio]');
    const picker = select.closest('[data-audio-picker]');
    picker.hidden = false;
    select.addEventListener('change', () => {
      const current = comparison?.current;
      finishComparison('比較試聴を停止しました。');
      current?.pause();
      original?.pause();
      processed.pause();
      const option = select.selectedOptions[0];
      processed.querySelector('source').src = option.dataset.src;
      const fallbackLink = processed.querySelector('a');
      if (fallbackLink) fallbackLink.href = option.dataset.src;
      processed.load();
      processed.setAttribute('aria-label', `${option.dataset.label}の試聴`);
      button.dataset.compareAudio = option.dataset.label;
      button.setAttribute('aria-label', `${option.dataset.label}を原音と続けて比較`);
      comparisonStatus.textContent = `${option.textContent}を選択しました。「原音 → 加工音で聴く」で比較できます。`;
    });
  });

  // Keep page media from talking over one another.
  document.addEventListener('play', event => {
    if (!(event.target instanceof HTMLMediaElement)) return;
    if (comparison && event.target !== comparison.current) finishComparison('比較試聴を停止しました。');
    document.querySelectorAll('audio, video').forEach(media => { if (media !== event.target) media.pause(); });
  }, true);
})();
