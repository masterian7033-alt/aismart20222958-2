/**
 * HALLYM INVESTMENT - 3D E-BOOK CONTROLLER
 * Powered by StPageFlip & Web Audio API
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const bookEl = document.getElementById('book');
  const bookStage = document.getElementById('book-stage');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const floatingPrevBtn = document.getElementById('floating-prev-btn');
  const floatingNextBtn = document.getElementById('floating-next-btn');
  const pageCurrentEl = document.getElementById('current-page-num');
  const pageTotalEl = document.getElementById('total-page-num');
  const progressBar = document.getElementById('progress-bar-fill');
  const progressPercent = document.getElementById('progress-percent');
  const progressTrack = document.getElementById('progress-track');
  const tocBtn = document.getElementById('toc-btn');
  const tocDrawer = document.getElementById('toc-drawer');
  const tocCloseBtn = document.getElementById('toc-close-btn');
  const tocItems = document.querySelectorAll('.toc-item');
  const thumbsBtn = document.getElementById('thumbs-btn');
  const thumbsModal = document.getElementById('thumbs-modal');
  const thumbsCloseBtn = document.getElementById('thumbs-close-btn');
  const thumbsGrid = document.getElementById('thumbs-grid');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const zoomBtn = document.getElementById('zoom-btn');
  const soundBtn = document.getElementById('sound-btn');
  const helpBtn = document.getElementById('help-btn');
  const helpModal = document.getElementById('help-modal');
  const helpCloseBtn = document.getElementById('help-close-btn');

  // Audio state
  let soundEnabled = true;
  let audioCtx = null;
  let isZoomed = false;

  // Total pages: 16 (0: Cover, 1-13: Content 2-14, 14: Appendix, 15: Back Cover)
  const totalPages = 16;
  const contentPagesCount = 14;

  // Initialize StPageFlip
  const pageFlip = new St.PageFlip(bookEl, {
    width: 550,
    height: 778, // A4 ratio ~ 1 : 1.414
    size: 'stretch',
    minWidth: 340,
    maxWidth: 620,
    minHeight: 480,
    maxHeight: 880,
    maxShadowOpacity: 0.6,
    showCover: true,
    usePortrait: true,
    mobileScrollSupport: false,
    flippingTime: 700,
    useMouseEvents: true,
    swipeDistance: 30
  });

  // Load HTML Pages
  const pageElements = document.querySelectorAll('.page');
  pageFlip.loadFromHTML(pageElements);

  // Synthesize realistic paper flip sound with Web Audio API
  function playPaperRustle() {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const dur = 0.22;
      const bufferSize = audioCtx.sampleRate * dur;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate shaped noise burst
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const env = Math.sin((i / bufferSize) * Math.PI);
        data[i] = white * Math.pow(env, 2.5);
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter for authentic crisp paper rustle
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, audioCtx.currentTime);
      filter.Q.setValueAtTime(1.8, audioCtx.currentTime);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      noise.start();
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Update Navigation UI & Counters
  function updateUI(pageIndex) {
    // Current display page logic
    // Cover is Page 1
    // Spread 1: Page 2 & Page 3
    // Last page is Page 14 (or 15/16)
    let displayPageText = '';
    const orientation = pageFlip.getOrientation();

    if (pageIndex === 0) {
      displayPageText = 'Cover (표지)';
      if (prevBtn) prevBtn.disabled = true;
      if (floatingPrevBtn) floatingPrevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = false;
      if (floatingNextBtn) floatingNextBtn.disabled = false;
    } else if (pageIndex >= totalPages - 1) {
      displayPageText = 'Back Cover (뒷표지)';
      if (nextBtn) nextBtn.disabled = true;
      if (floatingNextBtn) floatingNextBtn.disabled = true;
      if (prevBtn) prevBtn.disabled = false;
      if (floatingPrevBtn) floatingPrevBtn.disabled = false;
    } else {
      if (orientation === 'landscape') {
        const leftPage = pageIndex % 2 === 1 ? pageIndex + 1 : pageIndex;
        const rightPage = leftPage + 1;
        if (rightPage <= contentPagesCount) {
          displayPageText = `P. ${leftPage} - ${rightPage}`;
        } else if (leftPage <= contentPagesCount) {
          displayPageText = `P. ${leftPage}`;
        } else {
          displayPageText = `부록 (P. 15)`;
        }
      } else {
        displayPageText = `P. ${pageIndex + 1}`;
      }
      if (prevBtn) prevBtn.disabled = false;
      if (floatingPrevBtn) floatingPrevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
      if (floatingNextBtn) floatingNextBtn.disabled = false;
    }

    if (pageCurrentEl) pageCurrentEl.textContent = displayPageText;
    if (pageTotalEl) pageTotalEl.textContent = `14 Pages`;

    // Progress percentage
    const pct = Math.round((pageIndex / (totalPages - 1)) * 100);
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPercent) progressPercent.textContent = `${pct}%`;

    // Update active TOC item
    tocItems.forEach((item) => {
      const targetPage = parseInt(item.getAttribute('data-page'), 10);
      if (pageIndex === targetPage - 1 || (pageIndex > 0 && targetPage === pageIndex)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update active thumbnail
    document.querySelectorAll('.thumb-card').forEach((card, idx) => {
      if (idx === pageIndex) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  // StPageFlip Events
  pageFlip.on('init', (e) => {
    updateUI(e.data.page);
  });

  pageFlip.on('flip', (e) => {
    playPaperRustle();
    updateUI(e.data);
  });

  pageFlip.on('changeState', (e) => {
    // When flipping begins
  });

  // Buttons Bindings
  if (prevBtn) prevBtn.addEventListener('click', () => pageFlip.flipPrev());
  if (nextBtn) nextBtn.addEventListener('click', () => pageFlip.flipNext());
  if (floatingPrevBtn) floatingPrevBtn.addEventListener('click', () => pageFlip.flipPrev());
  if (floatingNextBtn) floatingNextBtn.addEventListener('click', () => pageFlip.flipNext());

  // Click on Progress Track to Jump
  if (progressTrack) {
    progressTrack.addEventListener('click', (e) => {
      const rect = progressTrack.getBoundingClientRect();
      const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetPageIndex = Math.round(clickRatio * (totalPages - 1));
      pageFlip.flip(targetPageIndex);
    });
  }

  // TOC Drawer Open/Close
  if (tocBtn) {
    tocBtn.addEventListener('click', () => {
      tocDrawer.classList.toggle('open');
      thumbsModal.classList.remove('open');
    });
  }
  if (tocCloseBtn) {
    tocCloseBtn.addEventListener('click', () => {
      tocDrawer.classList.remove('open');
    });
  }

  // TOC Item Click Jump
  tocItems.forEach((item) => {
    item.addEventListener('click', () => {
      const pageNum = parseInt(item.getAttribute('data-page'), 10);
      const targetIndex = pageNum - 1; // 0-based index
      pageFlip.flip(targetIndex);
      tocDrawer.classList.remove('open');
    });
  });

  // Thumbnails Grid Generation & Click
  if (thumbsGrid) {
    for (let i = 1; i <= totalPages; i++) {
      const card = document.createElement('div');
      card.className = `thumb-card ${i === 1 ? 'active' : ''}`;
      card.setAttribute('data-index', i - 1);

      const numStr = String(i).padStart(2, '0');
      let label = `Page ${i}`;
      if (i === 1) label = '표지 (Cover)';
      else if (i === 15) label = '부록 (Appendix)';
      else if (i === 16) label = '뒷표지 (Back)';

      card.innerHTML = `
        <div class="thumb-image-wrap">
          <img src="assets/images/page-${numStr}.jpg" alt="${label}" loading="lazy" />
        </div>
        <div class="thumb-label">${label}</div>
      `;

      card.addEventListener('click', () => {
        pageFlip.flip(i - 1);
        thumbsModal.classList.remove('open');
      });

      thumbsGrid.appendChild(card);
    }
  }

  if (thumbsBtn) {
    thumbsBtn.addEventListener('click', () => {
      thumbsModal.classList.toggle('open');
      tocDrawer.classList.remove('open');
    });
  }
  if (thumbsCloseBtn) {
    thumbsCloseBtn.addEventListener('click', () => {
      thumbsModal.classList.remove('open');
    });
  }

  // Fullscreen Toggle
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn('Fullscreen request failed:', err);
        });
        fullscreenBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        `;
      } else {
        document.exitFullscreen();
        fullscreenBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
          </svg>
        `;
      }
    });
  }

  // Zoom In / Out Toggle
  if (zoomBtn) {
    zoomBtn.addEventListener('click', () => {
      isZoomed = !isZoomed;
      if (isZoomed) {
        bookStage.style.transform = 'scale(1.22)';
        zoomBtn.classList.add('primary');
      } else {
        bookStage.style.transform = 'scale(1)';
        zoomBtn.classList.remove('primary');
      }
    });
  }

  // Sound Toggle
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (soundEnabled) {
        soundBtn.classList.add('primary');
        soundBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 6v12l-4-4H5a1 1 0 01-1-1v-2a1 1 0 011-1h3l4-4z"/>
          </svg>
        `;
      } else {
        soundBtn.classList.remove('primary');
        soundBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>
          </svg>
        `;
      }
    });
  }

  // Help Modal Open/Close
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      helpModal.classList.add('open');
    });
  }
  if (helpCloseBtn) {
    helpCloseBtn.addEventListener('click', () => {
      helpModal.classList.remove('open');
    });
  }
  if (helpModal) {
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) helpModal.classList.remove('open');
    });
  }

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      pageFlip.flipNext();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      pageFlip.flipPrev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      pageFlip.flip(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      pageFlip.flip(totalPages - 1);
    } else if (e.key === 'Escape') {
      tocDrawer.classList.remove('open');
      thumbsModal.classList.remove('open');
      helpModal.classList.remove('open');
      if (isZoomed) {
        isZoomed = false;
        bookStage.style.transform = 'scale(1)';
        zoomBtn.classList.remove('primary');
      }
    }
  });

  // Handle window resizing
  window.addEventListener('resize', () => {
    // StPageFlip automatically handles resize via its internal listener
  });
});
