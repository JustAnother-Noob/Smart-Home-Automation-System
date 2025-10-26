

document.addEventListener('DOMContentLoaded', function() {
    
    setTimeout(function() {
        initializeMobileNavigation();
    }, 100);
});

function initializeMobileNavigation() {
    const mobileToggle = document.getElementById('mobile-nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    console.log('Mobile toggle element:', mobileToggle);
    console.log('Nav menu element:', navMenu);
    
    if (!mobileToggle) {
        console.warn('Mobile navigation toggle button not found');
        return;
    }
    
    if (!navMenu) {
        console.warn('Navigation menu not found');
        return;
    }
    
    function toggleMobileNav() {
        if (navMenu) {
            navMenu.classList.toggle('active');
            const isActive = navMenu.classList.contains('active');
            
            console.log('Mobile nav toggled, active:', isActive);
            
            if (mobileToggle) {
                mobileToggle.setAttribute('aria-expanded', isActive);
                
                const icon = mobileToggle.querySelector('i');
                if (icon) {
                    if (isActive) {
                        icon.className = 'fas fa-times';
                    } else {
                        icon.className = 'fas fa-bars';
                    }
                }
            }
        }
    }

    mobileToggle.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        console.log('Mobile toggle clicked');
        toggleMobileNav();
    });

    const navLinks = document.querySelectorAll('.nav-menu .nav-item a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (navMenu && navMenu.classList.contains('active')) {
                console.log('Nav link clicked, closing mobile menu');
                toggleMobileNav();
            }
        });
    });

    document.addEventListener('click', function(event) {
        if (navMenu && navMenu.classList.contains('active')) {
            const isClickInsideNav = navMenu.contains(event.target);
            const isClickOnToggle = mobileToggle && mobileToggle.contains(event.target);
            
            if (!isClickInsideNav && !isClickOnToggle) {
                console.log('Click outside detected, closing mobile menu');
                toggleMobileNav();
            }
        }
    });

    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && navMenu && navMenu.classList.contains('active')) {
            console.log('Window resized to desktop, closing mobile menu');
            toggleMobileNav();
        }
    });

    function setActiveNavItem() {
        const currentPage = window.location.pathname.split('/').pop();
        const navItems = document.querySelectorAll('.nav-menu .nav-item');
        
        navItems.forEach(item => {
            item.classList.remove('active');
            const link = item.querySelector('a');
            if (link) {
                const linkPage = link.getAttribute('href');
                if (linkPage === currentPage) {
                    item.classList.add('active');
                }
            }
        });
    }
    
    setActiveNavItem();

    window.adminMobileNavInitialized = true;
}
