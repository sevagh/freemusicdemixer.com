// Toggle Hamburger Menu
const hamburgerMenu = document.getElementById('hamburger-menu');
const navbarLinks = document.querySelector('.navbar-links');

hamburgerMenu.addEventListener('click', () => {
  navbarLinks.classList.toggle('active');
});

// Modal functionality for login
const loginModal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn');
const loginCloseModal = document.getElementById('login-close');

const manageAccountBtn = document.getElementById('manage-account');
const activeUserModal = document.getElementById('active-user-modal');
const activeUserCloseModal = document.getElementById('active-user-close');

const emailInput = document.getElementById('billing-email');
const responseMessage = document.getElementById('response-message');
const tierLogos = {0: '/assets/images/logo_free.webp', 2: '/assets/images/logo_pro.webp'};
const tierNames = {0: 'Free', 2: 'Pro'};

loginBtn.addEventListener('click', () => {
  loginModal.classList.add('show');
});

loginCloseModal.addEventListener('click', () => {
  loginModal.classList.remove('show');
});

manageAccountBtn.addEventListener('click', () => {
    activeUserModal.classList.add('show');
});

activeUserCloseModal.addEventListener('click', () => {
    activeUserModal.classList.remove('show');
});

// click outside of modal to close
window.addEventListener('click', (e) => {
    if (e.target === loginModal) {
      loginModal.classList.remove('show');
    }
    if (e.target === activeUserModal) {
        activeUserModal.classList.remove('show');
    }
});

function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');

    // Fade in
    setTimeout(() => toast.classList.add('visible'), 50);

    // Fade out after duration
    setTimeout(() => {
        toast.classList.remove('visible');
        // Hide fully after fade-out transition
        setTimeout(() => toast.classList.add('hidden'), 500);
    }, duration);
}

document.getElementById('activation-form').addEventListener('submit', function(event) {
  event.preventDefault();

  const email = emailInput.value;

  activateProContent(email);

  // Show immediate visual feedback
  showToast('Login successful! Welcome back.');

  // Smoothly close login modal after brief delay (1.5 seconds feels natural)
  setTimeout(() => {
      loginModal.classList.remove('show');
  }, 2000);
});

const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const demixImg = document.getElementById('music-demix-img');
const amtImg = document.getElementById('amt-img');
const rssImg = document.getElementById('rss-img');
const twitterImg = document.getElementById('twitter-img');
const redditImg = document.getElementById('reddit-img');
const ycImg = document.getElementById('yc-img');
const fbImg = document.getElementById('fb-img');
const themeResetButton = document.getElementById('theme-reset');

// Reset theme to system preference
themeResetButton.addEventListener('click', () => {
    localStorage.removeItem('theme');
    loadTheme();
});

// Function to change the Giscus theme if the iframe is loaded
function changeGiscusTheme(theme) {
  function sendMessage(message) {
      const iframe = document.querySelector('iframe.giscus-frame');
      if (!iframe) return; // Exit if the iframe is not loaded
      iframe.contentWindow.postMessage({ giscus: message }, 'https://giscus.app');
  }

  sendMessage({
      setConfig: {
          theme: theme
      }
  });
}

// Apply theme and update icon and label
function applyTheme(theme) {
    document.documentElement.classList.remove('theme-dark', 'theme-light');

    if (theme === 'dark') {
        document.documentElement.classList.add('theme-dark');
        themeIcon.className = 'fa fa-sun';
        themeToggle.setAttribute('aria-label', 'Switch to light mode');
        // only toggle images if they're not null
        if (demixImg && amtImg) {
            demixImg.src = '/assets/images/music-demix-dark.webp';
            amtImg.src = '/assets/images/midi-amt-dark.webp';
        }
        if (rssImg) {
            rssImg.src = '/assets/social/rss-dark.svg';
        }
        if (twitterImg) {
            twitterImg.src = '/assets/social/x-twitter-dark.svg';
            // assume the rest of the social icons are present if twitter is
            redditImg.src = '/assets/social/reddit-dark.svg';
            ycImg.src = '/assets/social/y-combinator-dark.svg';
            fbImg.src = '/assets/social/facebook-dark.svg';
        }
    } else {
        document.documentElement.classList.add('theme-light');
        themeIcon.className = 'fa fa-moon';
        themeToggle.setAttribute('aria-label', 'Switch to dark mode');
        // only toggle images if they're not null
        if (demixImg && amtImg) {
          demixImg.src = '/assets/images/music-demix.webp';
          amtImg.src = '/assets/images/midi-amt.webp';
        }
        if (rssImg) {
            rssImg.src = '/assets/social/rss.svg';
        }
        if (twitterImg) {
            twitterImg.src = '/assets/social/x-twitter.svg';
            // assume the rest of the social icons are present if twitter is
            redditImg.src = '/assets/social/reddit.svg';
            ycImg.src = '/assets/social/y-combinator.svg';
            fbImg.src = '/assets/social/facebook.svg';
        }
    }

    // Additional behavior for post.html pages
    const isPostPage = document.getElementById('giscus-script');
    if (isPostPage) {
        changeGiscusTheme(theme);
    }
}

// Load theme based on system preference if no user choice is stored
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme); // Use stored preference
    } else {
        // Use system preference
        applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
}

// Toggle theme and store preference if explicitly set by user
themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    localStorage.setItem('theme', newTheme); // Store only if user toggles
    applyTheme(newTheme);
});

document.addEventListener("DOMContentLoaded", function() {
    loadTheme();
    const storedEmail = localStorage.getItem('billingEmail');

    if (storedEmail) {
        emailInput.value = storedEmail;
        responseMessage.textContent = '';
    }

    // NEW: Check if "?login" is present in the URL and show login modal
    if (window.location.search.includes('login')) {
        loginModal.classList.add('show');
    }

    // if the user is logged in, activate tier UIs
    const loggedIn = sessionStorage.getItem('loggedIn') === 'true';
    let userTier = 0;
    if (loggedIn) {
        userTier = parseInt(sessionStorage.getItem('userTier'));
        if ((userTier === -1) || isNaN(userTier)) {
            userTier = 0;
        }
    }
    activateTierUI(userTier);

    popupLogic();
});

function popupLogic() {
    // Get references to popup elements
    const popupBanner = document.getElementById('popup-banner');
    const popupOverlay = document.getElementById('popup-overlay');
    const closeButton = document.getElementById('close-popup');

    // early exit if popup elements don't exist
    if (!popupBanner || !popupOverlay) {
        return;
    }

    // Initialize shouldShowPopup based on sessionStorage
    let shouldShowPopup = !sessionStorage.getItem('popupDismissed');

    // Function to hide the popup and overlay
    function hidePopup() {
        if (popupBanner) {
            popupBanner.classList.remove('popup-banner-shown');
        }
        if (popupOverlay) {
            popupOverlay.classList.remove('popup-overlay-shown');
        }
        shouldShowPopup = false; // Update the flag so it won't show again
        sessionStorage.setItem('popupDismissed', 'true');
    }

    // Add scroll event listener if popup elements exist
    if (popupBanner && popupOverlay) {
        window.addEventListener('scroll', () => {
            let scrolledPercentage = (window.scrollY / (document.body.offsetHeight - window.innerHeight)) * 100;
            if (scrolledPercentage > 30 && shouldShowPopup) { // Trigger at 30% scroll
                popupBanner.classList.add('popup-banner-shown');
                popupOverlay.classList.add('popup-overlay-shown');
            }
        });
    }

    // Add click event listeners if the elements exist
    if (closeButton) {
        closeButton.addEventListener('click', hidePopup);
    }
    if (popupOverlay) {
        popupOverlay.addEventListener('click', hidePopup);
    }
}

// Function to display the spinner and overlay
function displayLoginSpinner() {
    console.log("Displaying spinner");
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('login-spinner').style.display = 'flex';
}

// Function to remove the spinner and overlay
function removeLoginSpinner() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('login-spinner').style.display = 'none';
}

function activateProContent(email) {
    // Display the spinner and disable the buttons
    displayLoginSpinner();

    // Store the email in localStorage
    localStorage.setItem('billingEmail', email);

    // Track the content activation event
    trackProductEvent('Content Activated', { email });

    // Fetch the user tier based on the email
    fetch(`https://freemusicdemixer.com/getprocontent?email=${encodeURIComponent(email)}`)
        .then(response => {
            if (!response.ok) {
              removeLoginSpinner();
              document.getElementById('response-message').innerHTML = `Login failed. If this is a mistake, <a href="/support" target="_blank" alt="contact-link">contact us</a>.`;
              throw new Error('Failed to fetch content');
            }
            return response.json();
        })
        .then(data => {
            const userTier = data.tier;
            console.log(`User Tier: ${userTier}`);

            trackProductEvent('Tier Activated', { email, userTier });

            sessionStorage.setItem('loggedIn', 'true');
            sessionStorage.setItem('userTier', userTier);

            activateTierUI(userTier);
        })
        .catch(error => console.error('Error fetching user tier:', error));
}

function activateTierUI(userTier) {
  // Remove the spinner and re-enable the buttons
  removeLoginSpinner();

  // Find the logo image element and the container for the tier text
  const logoImage = document.querySelector('#logo-display img');
  const tierText = document.querySelector('#logo-display small');

  // Update the logo source and tier text based on the userTier
  if (logoImage && tierText) {
      logoImage.src = tierLogos[userTier];
      logoImage.alt = `freemusicdemixer-${tierNames[userTier].toLowerCase()}-logo`;
      tierText.textContent = `${tierNames[userTier]} tier `;
      tierText.appendChild(logoImage); // Ensure the image stays within the <small> tag
  }

  if (userTier === 2) {
    document.getElementById('response-message').innerHTML = `${tierNames[userTier]} activated. <a class="wizard-link" href="https://billing.stripe.com/p/login/eVacPX8pKexG5tm8ww">Manage your subscription</a>.`;
  }

  // Dispatch a custom event for app.js to listen to
  const loginSuccessEvent = new CustomEvent('loginSuccess');

  // Trigger the event on the window or document
  window.dispatchEvent(loginSuccessEvent);
}

const logoutLink = document.getElementById('logout-link');

// Logout handler
logoutLink.addEventListener('click', function(event) {
    event.preventDefault(); // Prevent default link behavior

    // Clear stored data
    localStorage.removeItem('billingEmail');
    sessionStorage.removeItem('loggedIn');
    sessionStorage.removeItem('userTier');

    // Reset UI elements to logged-out state
    document.getElementById('active-user-buttons').style.display = 'none';
    document.getElementById('inactive-user-buttons').style.display = 'block';

    // Optionally reset the logo and tier text
    const logoImage = document.querySelector('#logo-display img');
    const tierText = document.querySelector('#logo-display small');
    if (logoImage && tierText) {
        logoImage.src = tierLogos[0]; // Default (free) logo
        logoImage.alt = 'freemusicdemixer-free-logo';
        tierText.textContent = 'Free tier ';
        tierText.appendChild(logoImage);
    }

    // Redirect user to homepage (optional)
    window.location.href = '/';
});
