// Toggle Hamburger Menu
const hamburgerMenu = document.getElementById('hamburger-menu');
const navbarLinks = document.querySelector('.navbar-links');

hamburgerMenu.addEventListener('click', () => {
  navbarLinks.classList.toggle('active');
});

// Modal functionality for login
const modal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn');
const closeModal = document.querySelector('.close');

loginBtn.addEventListener('click', () => {
  modal.classList.add('show');
});

closeModal.addEventListener('click', () => {
  modal.classList.remove('show');
});

window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('show');
  }
});

//document.addEventListener("DOMContentLoaded", function() {
//    // check to see if pop banner should be shown
//    if (!sessionStorage.getItem('bannerDismissed')) {
//        document.getElementById('sticky-banner').style.display = 'block';
//    }
//
//    // Add the event listener for the dismiss button inside the DOMContentLoaded callback
//    var dismissButton = document.getElementById('banner-dismiss-button');
//    if (dismissButton) {
//        dismissButton.addEventListener('click', function() {
//            console.log("Setting bannerDismissed to true");
//            sessionStorage.setItem('bannerDismissed', 'true');
//            document.getElementById('sticky-banner').style.display = 'none';
//            console.log(sessionStorage.getItem('bannerDismissed'));
//        });
//    } else {
//        console.error('Dismiss button not found');
//    }
//});
//
