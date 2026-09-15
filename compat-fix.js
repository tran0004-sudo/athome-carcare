(() => {
  try {
    const marker = 'athomeCompatRestore20260916v3';
    const storageKey = 'athomeCarCareDataV2';

    if (localStorage.getItem(marker) !== '1') {
      try {
        const previous = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const keep = {
          settings: previous.settings || undefined,
          inquiries: Array.isArray(previous.inquiries) ? previous.inquiries : []
        };
        Object.keys(keep).forEach((key) => keep[key] === undefined && delete keep[key]);
        localStorage.setItem(storageKey, JSON.stringify(keep));
        localStorage.removeItem('athomeClassicSectionsRestore20260916');
      } catch (_) {
        localStorage.removeItem(storageKey);
        localStorage.removeItem('athomeClassicSectionsRestore20260916');
      }
      localStorage.setItem(marker, '1');
    }

    const settingsForm = document.querySelector('#settingsForm');
    if (settingsForm && !settingsForm.querySelector('[name="area"]')) {
      const area = document.createElement('input');
      area.type = 'hidden';
      area.name = 'area';
      area.value = '경산 중산지구 · 사월동 · 시지 · 신매동 · 대구 전지역';
      settingsForm.appendChild(area);
    }

    const galleryForm = document.querySelector('#galleryForm');
    if (galleryForm && !galleryForm.querySelector('[name="note"]')) {
      const note = document.createElement('input');
      note.type = 'hidden';
      note.name = 'note';
      galleryForm.appendChild(note);
      const description = galleryForm.querySelector('[name="description"]');
      if (description) {
        const sync = () => { note.value = description.value || ''; };
        description.addEventListener('input', sync);
        galleryForm.addEventListener('submit', sync, true);
      }
    }

    const ensure = (selector, tag, attrs = {}) => {
      if (document.querySelector(selector)) return;
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'type') el.type = value;
        else el.setAttribute(key, value);
      });
      el.style.display = 'none';
      document.body.appendChild(el);
    };

    ensure('#adminReviewForm', 'form', { id: 'adminReviewForm' });
    ensure('#exportBtn', 'button', { id: 'exportBtn', type: 'button' });
    ensure('#importInput', 'input', { id: 'importInput', type: 'file' });
    ensure('#resetBtn', 'button', { id: 'resetBtn', type: 'button' });
  } catch (error) {
    console.warn('호환성 보정 중 오류', error);
  }
})();