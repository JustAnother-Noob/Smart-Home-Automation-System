

(function() {
  'use strict';
  
  console.log('=== SCROLL DIAGNOSTIC START ===');

  const bodyOverflow = window.getComputedStyle(document.body).overflow;
  console.log('Body overflow:', bodyOverflow);

  const htmlOverflow = window.getComputedStyle(document.documentElement).overflow;
  console.log('HTML overflow:', htmlOverflow);

  console.log('Body inline overflow style:', document.body.style.overflow || 'none');

  console.log('HTML inline overflow style:', document.documentElement.style.overflow || 'none');

  console.log('Body height:', document.body.offsetHeight, 'px');
  console.log('Window height:', window.innerHeight, 'px');
  console.log('Document height:', document.documentElement.scrollHeight, 'px');

  console.log('\n=== APPLYING FIXES ===');

  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';

  document.body.style.removeProperty('overflow');
  document.documentElement.style.removeProperty('overflow');

  const bodyClasses = document.body.className;
  const htmlClasses = document.documentElement.className;
  console.log('Body classes:', bodyClasses || 'none');
  console.log('HTML classes:', htmlClasses || 'none');

  document.body.classList.remove('no-scroll', 'modal-open', 'overflow-hidden');
  document.documentElement.classList.remove('no-scroll', 'modal-open', 'overflow-hidden');
  
  console.log('\n=== FIX APPLIED ===');
  console.log('Try scrolling now. If it still doesn\'t work, check the console above for the cause.');
  
})();
