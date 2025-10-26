

(async function(){
  try {
    const root = document.getElementById('breadcrumb-root');
    if(!root) return;
    const resp = await fetch('../html/components/breadcrumb.html');
    if(!resp.ok) return;
    const template = await resp.text();
    root.innerHTML = template;

    const current = String(root.getAttribute('data-breadcrumb-current') || root.dataset.breadcrumbCurrent || '').trim();
    const parent = String(root.getAttribute('data-breadcrumb-parent') || root.dataset.breadcrumbParent || '').trim();
    const parentHref = String(root.getAttribute('data-breadcrumb-parent-href') || root.dataset.breadcrumbParentHref || '').trim();

    const restContainer = root.querySelector('#breadcrumb-rest');
    if (!restContainer) return;

    const pieces = [];

    if (parent && parent.toLowerCase() !== current.toLowerCase()) {
      
      if (parentHref) {
        pieces.push(`<span aria-hidden="true">›</span> <a href="${parentHref}">${parent}</a>`);
      } else {
        pieces.push(`<span aria-hidden="true">›</span> <span>${parent}</span>`);
      }
    } else if (!parent) {

    }

    if (current) {
      
      pieces.push(`<span aria-hidden="true">›</span> <span id=\"breadcrumb-current\">${current}</span>`);
    }

    restContainer.innerHTML = pieces.join(' ');

    window.updateBreadcrumb = function(payload) {
      
      let c, p, ph;
      if (typeof payload === 'string') {
        c = payload;
      } else if (payload && typeof payload === 'object') {
        c = payload.current !== undefined ? payload.current : undefined;
        p = payload.parent !== undefined ? payload.parent : undefined;
        ph = payload.parentHref !== undefined ? payload.parentHref : undefined;
      }
      try {
        if (!root) return;
        if (c !== undefined) root.setAttribute('data-breadcrumb-current', c || '');
        if (p !== undefined) root.setAttribute('data-breadcrumb-parent', p || '');
        if (ph !== undefined) root.setAttribute('data-breadcrumb-parent-href', ph || '');

        const cur = String(root.getAttribute('data-breadcrumb-current') || '').trim();
        const par = String(root.getAttribute('data-breadcrumb-parent') || '').trim();
        const phref = String(root.getAttribute('data-breadcrumb-parent-href') || '').trim();
        const newPieces = [];
        if (par && par.toLowerCase() !== cur.toLowerCase()) {
          if (phref) newPieces.push(`<span aria-hidden=\"true\">›</span> <a href=\"${phref}\">${par}</a>`);
          else newPieces.push(`<span aria-hidden=\"true\">›</span> <span>${par}</span>`);
        }
        if (cur) newPieces.push(`<span aria-hidden=\"true\">›</span> <span id=\"breadcrumb-current\">${cur}</span>`);
        restContainer.innerHTML = newPieces.join(' ');
      } catch (e) {  }
    };
  } catch (e) {
    console.warn('breadcrumb-loader failed', e);
  }
})();
