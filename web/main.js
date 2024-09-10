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

const emailInput = document.getElementById('billing-email');
const responseMessage = document.getElementById('response-message');
const tierLogos = {0: '/assets/images/logo_free.webp', 2: '/assets/images/logo_pro.webp'};
const tierNames = {0: 'Free', 2: 'Pro'};

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

document.getElementById('activation-form').addEventListener('submit', function(event) {
    event.preventDefault();

    const email = emailInput.value;

    activateProContent(email);
});

document.addEventListener("DOMContentLoaded", function() {
    const storedEmail = localStorage.getItem('billingEmail');
    const isLoggedIn = sessionStorage.getItem('loggedIn') === 'true';

    if (storedEmail) {
        emailInput.value = storedEmail;
        responseMessage.textContent = '';
    }

    if (isLoggedIn && storedEmail) {
        // User is already logged in, activate the content
        activateProContent(storedEmail);
    }
});

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
            if (!response.ok) throw new Error('Failed to fetch content');
            return response.json();
        })
        .then(data => {
            const userTier = data.tier;
            console.log(`User Tier: ${userTier}`);

            trackProductEvent('Tier Activated', { email, userTier });

            sessionStorage.setItem('loggedIn', 'true');
            sessionStorage.setItem('userTier', userTier);

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

            document.getElementById('response-message').innerHTML = `${tierNames[userTier]} activated. <a class="wizard-link" href="https://billing.stripe.com/p/login/eVacPX8pKexG5tm8ww">Manage your subscription</a>.`;
        })
        .catch(error => console.error('Error fetching user tier:', error));
}

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
