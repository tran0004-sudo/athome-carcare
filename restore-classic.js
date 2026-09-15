(() => {
  try {
    const marker = 'athomeForceClassicSections20260916v2';
    if (localStorage.getItem(marker) === '1') return;

    const storageKey = 'athomeCarCareDataV2';
    let keep = { inquiries: [] };

    try {
      const previous = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (previous.settings) keep.settings = previous.settings;
      if (Array.isArray(previous.inquiries)) keep.inquiries = previous.inquiries;
    } catch (_) {}

    // Remove only locally edited gallery/review/tip data. app.js will refill
    // those sections from the published data/content.json defaults.
    localStorage.setItem(storageKey, JSON.stringify(keep));
    localStorage.removeItem('athomeClassicSectionsRestore20260916');
    localStorage.setItem(marker, '1');
  } catch (error) {
    console.warn('기존 홈 콘텐츠 초기화 중 오류', error);
  }
})();
