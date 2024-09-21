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

    if (storedEmail) {
        emailInput.value = storedEmail;
        responseMessage.textContent = '';
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

            // Dispatch a custom event for app.js to listen to
            const loginSuccessEvent = new CustomEvent('loginSuccess');

            // Trigger the event on the window or document
            window.dispatchEvent(loginSuccessEvent);
        })
        .catch(error => console.error('Error fetching user tier:', error));
}
