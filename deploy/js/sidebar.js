document.addEventListener('DOMContentLoaded', function() {
    const adminNav = document.getElementById('adminTopNav');
    const adminNavToggle = document.getElementById('adminNavToggle');
    
    if (adminNav && adminNavToggle) {
        const collapseNav = () => {
            adminNav.classList.remove('open');
            adminNavToggle.setAttribute('aria-expanded', 'false');
        };
    
        adminNavToggle.addEventListener('click', function() {
            const isExpanded = adminNavToggle.getAttribute('aria-expanded') === 'true';
            adminNavToggle.setAttribute('aria-expanded', (!isExpanded).toString());
            adminNav.classList.toggle('open', !isExpanded);
        });
    
        adminNav.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                if (window.matchMedia('(max-width: 900px)').matches) {
                    collapseNav();
                }
            });
        });
    
        window.addEventListener('resize', function() {
            if (!window.matchMedia('(max-width: 900px)').matches) {
                adminNav.classList.remove('open');
                adminNavToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }
});
