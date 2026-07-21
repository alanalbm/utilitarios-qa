(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const root = document.body?.dataset.root || '';
  const tools = Array.isArray(window.UQ_TOOLS) ? window.UQ_TOOLS : [];

  const storage = {
    get(key, fallback = null) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (_) { /* Storage can be blocked. */ }
    }
  };

  const parseList = (key) => {
    try {
      const value = JSON.parse(storage.get(key, '[]'));
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  };

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const showStatus = (message, type = 'success', target = '#status') => {
    const element = typeof target === 'string' ? $(target) : target;
    if (!element) return;
    element.textContent = message;
    element.className = `status show ${type}`;
  };

  const copyText = async (text) => {
    const value = String(text ?? '');
    if (!value) throw new Error('Não há conteúdo para copiar.');
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const temp = document.createElement('textarea');
    temp.value = value;
    temp.setAttribute('readonly', '');
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    const ok = document.execCommand('copy');
    temp.remove();
    if (!ok) throw new Error('Não foi possível copiar automaticamente.');
  };

  const downloadText = (content, filename = 'arquivo.txt', type = 'text/plain;charset=utf-8') => {
    const blob = content instanceof Blob ? content : new Blob([String(content ?? '')], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const trackAction = (action, params = {}) => {
    if (typeof window.gtag !== 'function') return;
    try {
      window.gtag('event', action, {
        tool_slug: document.body?.dataset.toolSlug || undefined,
        ...params
      });
    } catch (_) { /* Analytics must never break the product. */ }
  };

  Object.assign(window, { $, $$, escapeHtml, showStatus, copyText, downloadText, trackAction });

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  const navToggle = $('.nav-toggle');
  const navLinks = $('.nav-links');
  navToggle?.addEventListener('click', () => {
    const open = navLinks?.classList.toggle('open') || false;
    navToggle.setAttribute('aria-expanded', String(open));
  });

  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    storage.set('uq-theme', theme);
    $$('[data-theme-toggle]').forEach((button) => {
      button.textContent = theme === 'dark' ? '☀' : '☾';
      button.setAttribute('aria-label', theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro');
    });
  };

  const preferredTheme = storage.get('uq-theme') ||
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(preferredTheme);
  $$('[data-theme-toggle]').forEach((button) => button.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }));

  let favorites = parseList('uq-favorites');
  const saveFavorites = () => storage.set('uq-favorites', JSON.stringify(favorites));

  const toolBySlug = (slug) => tools.find((tool) => tool.slug === slug);

  const toolCardHtml = (tool, compact = false) => {
    const active = favorites.includes(tool.slug);
    return `<article class="card tool-card${compact ? ' compact' : ''}" data-tool-card data-search="${escapeHtml(`${tool.title} ${tool.short} ${tool.keywords}`.toLowerCase())}" data-category="${escapeHtml(tool.category)}">
      <div class="tool-card-head"><span class="tool-icon">${escapeHtml(tool.icon)}</span><button class="favorite-btn${active ? ' active' : ''}" data-favorite="${escapeHtml(tool.slug)}" aria-label="${active ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">${active ? '★' : '☆'}</button></div>
      <span class="tool-category">${escapeHtml(tool.category)}</span>
      <h3>${escapeHtml(tool.title)}</h3>
      <p>${escapeHtml(tool.short)}</p>
      <a class="tool-link" href="${root}${tool.path}">Abrir ferramenta <span>→</span></a>
    </article>`;
  };

  const refreshFavoriteButtons = () => {
    $$('[data-favorite]').forEach((button) => {
      const active = favorites.includes(button.dataset.favorite);
      button.classList.toggle('active', active);
      button.textContent = active ? '★' : '☆';
      button.setAttribute('aria-label', active ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
    });
  };

  const renderFavorites = () => {
    const area = $('#favorite-tools');
    if (!area) return;
    const selected = favorites.map(toolBySlug).filter(Boolean);
    area.innerHTML = selected.length
      ? selected.slice(0, 6).map((tool) => toolCardHtml(tool, true)).join('')
      : '<div class="empty-state">Clique na estrela de uma ferramenta para encontrá-la rapidamente aqui.</div>';
  };

  const rememberCurrentTool = () => {
    const slug = document.body?.dataset.toolSlug;
    if (!slug || !toolBySlug(slug)) return;
    const recent = parseList('uq-recent').filter((item) => item !== slug);
    recent.unshift(slug);
    storage.set('uq-recent', JSON.stringify(recent.slice(0, 6)));
  };

  const renderRecent = () => {
    const area = $('#recent-tools');
    if (!area) return;
    const recent = parseList('uq-recent').map(toolBySlug).filter(Boolean);
    const fallback = tools.filter((tool) => tool.featured).slice(0, 4);
    area.innerHTML = (recent.length ? recent : fallback).slice(0, 6)
      .map((tool) => toolCardHtml(tool, true)).join('');
  };

  rememberCurrentTool();
  renderFavorites();
  renderRecent();
  refreshFavoriteButtons();

  document.addEventListener('click', async (event) => {
    const favoriteButton = event.target.closest('[data-favorite]');
    if (favoriteButton) {
      event.preventDefault();
      const slug = favoriteButton.dataset.favorite;
      favorites = favorites.includes(slug)
        ? favorites.filter((item) => item !== slug)
        : [...favorites, slug];
      saveFavorites();
      refreshFavoriteButtons();
      renderFavorites();
      renderRecent();
      trackAction('favorite_tool', { item_id: slug, state: favorites.includes(slug) ? 'added' : 'removed' });
      return;
    }

    const copyButton = event.target.closest('[data-copy-target]');
    if (copyButton) {
      event.preventDefault();
      const target = $(copyButton.dataset.copyTarget);
      const value = target?.value ?? target?.textContent ?? '';
      try {
        await copyText(value);
        showStatus('Conteúdo copiado para a área de transferência.', 'success', copyButton.dataset.statusTarget || '#status');
        trackAction('copy_result');
      } catch (error) {
        showStatus(error.message, 'error', copyButton.dataset.statusTarget || '#status');
      }
      return;
    }

    const downloadButton = event.target.closest('[data-download-target]');
    if (downloadButton) {
      event.preventDefault();
      const target = $(downloadButton.dataset.downloadTarget);
      const value = target?.value ?? target?.textContent ?? '';
      if (!String(value).trim()) {
        showStatus('Gere ou informe um conteúdo antes de baixar.', 'warning', downloadButton.dataset.statusTarget || '#status');
        return;
      }
      downloadText(value, downloadButton.dataset.filename || 'resultado.txt', downloadButton.dataset.mime || 'text/plain;charset=utf-8');
      trackAction('download_result');
    }
  });

  const createSearchModal = () => {
    if ($('#global-search-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'global-search-modal';
    modal.className = 'search-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Buscar ferramentas');
    modal.innerHTML = `<div class="search-dialog">
      <div class="search-dialog-head"><span aria-hidden="true">⌕</span><input id="global-search-input" type="search" placeholder="Busque por JSON, CPF, XPath, JWT..." autocomplete="off"><button class="icon-btn" id="close-global-search" aria-label="Fechar busca">×</button></div>
      <div class="search-results" id="global-search-results"></div>
    </div>`;
    document.body.appendChild(modal);

    const input = $('#global-search-input');
    const results = $('#global-search-results');

    const render = (query = '') => {
      const normalized = query.trim().toLowerCase();
      const matches = tools.filter((tool) => !normalized || `${tool.title} ${tool.short} ${tool.keywords} ${tool.category}`.toLowerCase().includes(normalized)).slice(0, 12);
      results.innerHTML = matches.length
        ? matches.map((tool) => `<a class="search-result" href="${root}${tool.path}"><span class="tool-icon">${escapeHtml(tool.icon)}</span><span><strong>${escapeHtml(tool.title)}</strong><span>${escapeHtml(tool.category)} · ${escapeHtml(tool.short)}</span></span></a>`).join('')
        : '<div class="search-empty">Nenhuma ferramenta encontrada. Tente outro termo.</div>';
    };

    input.addEventListener('input', () => render(input.value));
    $('#close-global-search').addEventListener('click', () => closeSearch());
    modal.addEventListener('click', (event) => { if (event.target === modal) closeSearch(); });
    render('');
  };

  const openSearch = (initialValue = '') => {
    createSearchModal();
    const modal = $('#global-search-modal');
    const input = $('#global-search-input');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    input.value = initialValue;
    input.dispatchEvent(new Event('input'));
    setTimeout(() => input.focus(), 30);
  };

  const closeSearch = () => {
    $('#global-search-modal')?.classList.remove('open');
    document.body.style.overflow = '';
  };

  $$('[data-open-search]').forEach((button) => button.addEventListener('click', () => openSearch()));
  $('#hero-search-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    openSearch($('#hero-search-input')?.value || '');
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
    }
    if (event.key === 'Escape') closeSearch();
  });

  const catalogInput = $('#catalog-search') || $('#tool-search');
  const categoryButtons = $$('[data-category]');
  const categorySections = $$('[data-catalog-category]');
  const categoryGrids = $$('[data-tool-grid]');
  let activeCategory = 'all';

  if (categoryGrids.length) {
    categoryGrids.forEach((grid) => {
      const category = grid.dataset.categoryName;
      grid.innerHTML = tools.filter((tool) => tool.category === category).map((tool) => toolCardHtml(tool)).join('');
    });
  }

  const filterCatalog = () => {
    const cards = $$('[data-tool-card]');
    if (!cards.length) return;
    const query = (catalogInput?.value || '').trim().toLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const categoryOk = activeCategory === 'all' || card.dataset.category === activeCategory;
      const queryOk = !query || (card.dataset.search || '').includes(query);
      const show = categoryOk && queryOk;
      card.hidden = !show;
      if (show) visible += 1;
    });
    categorySections.forEach((section) => {
      section.hidden = !$$('[data-tool-card]', section).some((card) => !card.hidden);
    });
    const empty = $('#catalog-empty');
    if (empty) empty.hidden = visible !== 0;
  };

  const selectCategory = (value) => {
    activeCategory = value || 'all';
    categoryButtons.forEach((button) => button.classList.toggle('active', button.dataset.category === activeCategory));
    filterCatalog();
  };

  catalogInput?.addEventListener('input', filterCatalog);
  categoryButtons.forEach((button) => button.addEventListener('click', () => selectCategory(button.dataset.category)));
  if (catalogInput || categoryButtons.length) {
    const params = new URLSearchParams(location.search);
    const qParam = params.get('q');
    const categoryParam = params.get('categoria');
    if (qParam && catalogInput) catalogInput.value = qParam;
    if (categoryParam && tools.some((tool) => tool.category === categoryParam)) activeCategory = categoryParam;
    selectCategory(activeCategory);
  }


  const cookieBanner = $('#cookie-banner');
  const updateConsent = (choice) => {
    storage.set('uq-consent', choice);
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: choice === 'accepted' ? 'granted' : 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
    cookieBanner?.classList.remove('show');
  };
  if (!storage.get('uq-consent')) cookieBanner?.classList.add('show');
  $('#accept-analytics')?.addEventListener('click', () => updateConsent('accepted'));
  $('#reject-analytics')?.addEventListener('click', () => updateConsent('rejected'));
  $$('[data-cookie-settings]').forEach((button) => button.addEventListener('click', () => cookieBanner?.classList.add('show')));

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register(`${root}service-worker.js`).catch(() => {}));
  }
})();

// Global v5 enhancements: language switcher, lightweight locale suggestion and product feedback.
(() => {
  'use strict';
  const $ = (s, scope = document) => scope.querySelector(s);
  const $$ = (s, scope = document) => [...scope.querySelectorAll(s)];
  const lang = document.body?.dataset.lang || 'pt';
  const labels = {
    pt: { helpful: 'Esta ferramenta resolveu sua tarefa?', yes: 'Sim, resolveu', no: 'Ainda não', thanks: 'Obrigado pelo feedback.', share: 'Compartilhar', copied: 'Link copiado.', suggest: 'Parece que seu navegador está em outro idioma.', open: 'Abrir versão em português', dismiss: 'Agora não' },
    en: { helpful: 'Did this tool solve your task?', yes: 'Yes, it did', no: 'Not yet', thanks: 'Thanks for your feedback.', share: 'Share', copied: 'Link copied.', suggest: 'A version that matches your browser language is available.', open: 'Open English version', dismiss: 'Not now' },
    es: { helpful: '¿Esta herramienta resolvió tu tarea?', yes: 'Sí, la resolvió', no: 'Todavía no', thanks: 'Gracias por tu opinión.', share: 'Compartir', copied: 'Enlace copiado.', suggest: 'Hay una versión que coincide con el idioma de tu navegador.', open: 'Abrir versión en español', dismiss: 'Ahora no' }
  }[lang] || {};

  const languageMenu = $('.language-menu');
  const languageToggle = $('.language-toggle');
  languageToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    languageMenu?.classList.toggle('open');
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.language-menu')) languageMenu?.classList.remove('open');
  });

  // Keep language switch links aligned with hreflang equivalents on every page.
  const alternates = Object.fromEntries($$('link[rel="alternate"][hreflang]').map((link) => [link.hreflang, link.href]));
  $$('.language-popover a').forEach((anchor) => {
    const target = anchor.lang === 'pt-BR' ? 'pt-BR' : anchor.lang;
    if (alternates[target]) anchor.href = alternates[target];
  });

  const toolPanel = $('.tool-panel');
  const toolSlug = document.body?.dataset.toolSlug;
  if (toolPanel && toolSlug && !$('.tool-feedback')) {
    const feedback = document.createElement('section');
    feedback.className = 'tool-feedback';
    feedback.innerHTML = `<div><strong>${labels.helpful}</strong><span class="small muted">Feedback anônimo, sem enviar o conteúdo usado na ferramenta.</span></div><div class="feedback-actions"><button class="btn btn-secondary" data-feedback="yes">${labels.yes}</button><button class="btn btn-secondary" data-feedback="no">${labels.no}</button><button class="btn btn-secondary" data-share-tool>${labels.share}</button></div>`;
    toolPanel.appendChild(feedback);
    feedback.addEventListener('click', async (event) => {
      const answer = event.target.closest('[data-feedback]');
      if (answer) {
        window.trackAction?.('tool_feedback', { response: answer.dataset.feedback });
        feedback.querySelector('strong').textContent = labels.thanks;
        feedback.querySelectorAll('[data-feedback]').forEach((button) => button.disabled = true);
      }
      if (event.target.closest('[data-share-tool]')) {
        try {
          if (navigator.share) await navigator.share({ title: document.title, url: location.href });
          else { await navigator.clipboard.writeText(location.href); window.showStatus?.(labels.copied, 'success'); }
          window.trackAction?.('share_tool');
        } catch (_) { /* User may cancel share. */ }
      }
    });
  }

  // Suggest, never force, the matching language. This avoids intrusive redirects and preserves crawlable URLs.
  try {
    const browser = (navigator.language || '').toLowerCase();
    const desired = browser.startsWith('es') ? 'es' : browser.startsWith('en') ? 'en' : 'pt-BR';
    const current = lang === 'pt' ? 'pt-BR' : lang;
    const key = `uq-language-suggestion-${desired}`;
    if (desired !== current && alternates[desired] && !sessionStorage.getItem(key)) {
      const banner = document.createElement('aside');
      banner.className = 'language-suggestion';
      banner.innerHTML = `<span>🌐 ${labels.suggest}</span><a class="btn btn-primary" href="${alternates[desired]}">${desired === 'en' ? 'Open English version' : desired === 'es' ? 'Abrir versión en español' : 'Abrir em português'}</a><button class="icon-btn" aria-label="${labels.dismiss}">×</button>`;
      document.body.appendChild(banner);
      banner.querySelector('button').addEventListener('click', () => { sessionStorage.setItem(key, '1'); banner.remove(); });
    }
  } catch (_) { /* Session storage may be blocked. */ }

  // Reading progress for long guides.
  if ($('.guide-article')) {
    const progress = document.createElement('div'); progress.className = 'reading-progress'; progress.innerHTML = '<span></span>'; document.body.appendChild(progress);
    const update = () => {
      const article = $('.guide-article'); if (!article) return;
      const rect = article.getBoundingClientRect();
      const total = article.offsetHeight - innerHeight;
      const done = Math.max(0, Math.min(1, (-rect.top + 90) / Math.max(1, total)));
      progress.firstElementChild.style.transform = `scaleX(${done})`;
    };
    addEventListener('scroll', update, { passive: true }); update();
  }
})();
