

(function initPaginationGlobal(){
  if (window.Pagination) return;

  function safeNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function defaultPageWindow(current, total) {
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    return [start, end];
  }

  class Pagination {
    constructor(options) {
      this.container = typeof options.container === 'string'
        ? document.getElementById(options.container)
        : options.container;
      this.onPage = typeof options.onPage === 'function' ? options.onPage : () => {};
      this.getPageWindow = typeof options.getPageWindow === 'function' ? options.getPageWindow : defaultPageWindow;
      this.theme = options.theme || 'default';
    }

    render(pagination) {
      if (!this.container) return;

      const currentPage = safeNumber(pagination.currentPage, 1);
      const totalPages = Math.max(1, safeNumber(pagination.totalPages, 1));
      const limit = safeNumber(pagination.limit, 10);
      const totalItems = Math.max(0, safeNumber(pagination.totalItems ?? pagination.totalLogs, 0));

      if (totalPages <= 1) {
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        return;
      }

      const [startPage, endPage] = this.getPageWindow(currentPage, totalPages);
      const prevDisabled = currentPage <= 1 ? 'disabled' : '';
      const nextDisabled = currentPage >= totalPages ? 'disabled' : '';

      let html = '';
      html += `
        <button class="pagination-btn" ${prevDisabled} data-page="first" aria-label="First page">
          <i class="fas fa-angle-double-left"></i> <span class="hide-sm">First</span>
        </button>
        <button class="pagination-btn" ${prevDisabled} data-page="prev" aria-label="Previous page">
          <i class="fas fa-angle-left"></i> <span class="hide-sm">Previous</span>
        </button>
      `;

      for (let i = startPage; i <= endPage; i++) {
        const active = i === currentPage ? 'active' : '';
        html += `
          <button class="pagination-btn ${active}" data-page="${i}" aria-label="Page ${i}">${i}</button>
        `;
      }

      html += `
        <button class="pagination-btn" ${nextDisabled} data-page="next" aria-label="Next page">
          <span class="hide-sm">Next</span> <i class="fas fa-angle-right"></i>
        </button>
        <button class="pagination-btn" ${nextDisabled} data-page="last" aria-label="Last page">
          <span class="hide-sm">Last</span> <i class="fas fa-angle-double-right"></i>
        </button>
      `;

      const infoId = this.container.getAttribute('data-info-id');
      if (infoId) {
        const infoEl = document.getElementById(infoId);
        if (infoEl) {
          const from = (currentPage - 1) * limit + 1;
          const to = Math.min(currentPage * limit, totalItems);
          infoEl.innerHTML = totalItems === 0
            ? '<span class="pagination-info-text">No entries</span>'
            : `
              <span class="pagination-info-text">Showing ${from} to ${to} of ${totalItems} entries</span>
              <span class="pagination-info-text">Page ${currentPage} of ${totalPages}</span>
            `;
          infoEl.style.display = 'flex';
        }
      }

      this.container.innerHTML = html;
      this.container.style.display = 'flex';

      this.container.querySelectorAll('.pagination-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const token = e.currentTarget.getAttribute('data-page');
          if (!token || e.currentTarget.disabled) return;
          let next = currentPage;
          if (token === 'first') next = 1;
          else if (token === 'prev') next = Math.max(1, currentPage - 1);
          else if (token === 'next') next = Math.min(totalPages, currentPage + 1);
          else if (token === 'last') next = totalPages;
          else next = safeNumber(token, currentPage);
          if (next !== currentPage) this.onPage(next);
        });
      });
    }

    static create(options) {
      return new Pagination(options);
    }
  }

  window.Pagination = Pagination;
})();

