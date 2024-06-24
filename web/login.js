export function dummyLogin() {
  // Fetch the wasm_tier_0.zip file
  fetch('/wasm_tier_0.zip')
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch content');
      return response.blob();
    })
    .then(blob => {
      return blob.arrayBuffer();
    })
    .then(arrayBuffer => {
      const zipData = new Uint8Array(arrayBuffer);
      const unzipped = fflate.unzipSync(zipData);
      return unzipped;
    })
    .then(unzipped => {
      // Process and store unzipped files
      const files = Object.keys(unzipped).reduce((fileObjects, fileName) => {
        // Create blobs from the unzipped files
        fileObjects[fileName] = new Blob([unzipped[fileName]], { type: 'text/javascript' });
        return fileObjects;
      }, {});

      // Dispatch a custom event with the unzipped files
      const event = new CustomEvent('unzippedFilesReady', { detail: { files } });
      window.dispatchEvent(event);
    })
    .catch(error => {
      console.error('Error:', error);
    });
}

document.addEventListener('DOMContentLoaded', function() {
  const emailInput = document.getElementById('billing-email');
  const storedEmail = localStorage.getItem('billingEmail');

  // If an email is stored, pre-fill the form and show a message
  if (storedEmail) {
    emailInput.value = storedEmail;
    document.getElementById('response-message').textContent = 'Your email is stored. You can update it if needed.';
  }

  document.getElementById('activation-form').addEventListener('submit', function(event) {
  event.preventDefault();
  const email = emailInput.value;
  localStorage.setItem('billingEmail', email); // Store the new email

  // Track the content activation event
  trackProductEvent('Content Activated', { email });

  // Fetch the zip file based on the user's email
  fetch(`/getprocontent?email=${encodeURIComponent(email)}`)
  .then(response => {
    if (!response.ok) throw new Error('Failed to fetch content');
    // Attempt to extract the filename from the Content-Disposition header
    const contentDisposition = response.headers.get("Content-Disposition");
    console.log('Content-Disposition:', contentDisposition); // Debugging
    let zipFileName = "unknown.zip"; // Default filename if not found in header
    if (contentDisposition) {
      const matches = contentDisposition.match(/filename="?([^"]+)"?/);
      if (matches.length > 1) {
        zipFileName = matches[1];
      }
    }
    return response.blob().then(blob => {
      return { blob, zipFileName }; // Return both blob and filename here
    });
  })
  .then(({ blob, zipFileName }) => { // Destructure blob and zipFileName here
    console.log('Received zip file name:', zipFileName); // Debugging: Log the file name

    // Update the UI based on the tier inferred from the zip file name
    const userTier = inferTierFromFileName(zipFileName); // Use the function to get the tier
    console.log('User tier:', userTier); // Debugging: Log the tier

    // Track the content activation event
    trackProductEvent('Tier Activated', { email, userTier });

    // Update the UI based on the tier
    activateTierUI(userTier);

    // Unzip the blob using fflate
    return blob.arrayBuffer();
  })
  .then(arrayBuffer => {
    const zipData = new Uint8Array(arrayBuffer);
    const unzipped = fflate.unzipSync(zipData);
    return unzipped;
  })
  .then(unzipped => {
    // Process and store unzipped files
    const files = Object.keys(unzipped).reduce((fileObjects, fileName) => {
      // Create blobs from the unzipped files
      fileObjects[fileName] = new Blob([unzipped[fileName]], { type: 'text/javascript' });
      return fileObjects;
    }, {});

    // Dispatch a custom event with the unzipped files
    const event = new CustomEvent('unzippedFilesReady', { detail: { files } });
    window.dispatchEvent(event);
  })
  .catch(error => {
    console.error('Error:', error);
    document.getElementById('response-message').textContent = 'Failed to activate content. Please try again.';
  });
});
});

function activateTierUI(userTier) {
  console.log('Enabling UI for user tier:', userTier); // Debugging
  // Enable buttons based on user tier

  if (userTier >= 2) {
    const tier2Button00 = document.getElementById('load-weights-free-2');
    const tier2Button01 = document.getElementById('load-weights-free-3');
    const tier2Button1 = document.getElementById('load-weights-pro-ft');
    const tier2Button2 = document.getElementById('load-weights-pro-cust');
    const tier2Button3 = document.getElementById('load-weights-pro-deluxe');
    const tier2Button4 = document.getElementById('load-weights-karaoke');

    // Set real message
    tier2Button00.textContent = "(Pro) 6-source weights (53 MB)";
    tier2Button01.textContent = "(Pro) V3 weights (161 MB)";
    tier2Button1.textContent = "(Pro) Fine-tuned weights (324 MB)";
    tier2Button2.textContent = "(Pro) Custom weights (215 MB)";
    tier2Button3.textContent = "(Pro) Deluxe weights (404 MB)";
    tier2Button4.textContent = "(Pro) Karaoke weights (161 MB)";

    tier2Button00.disabled = false;
    tier2Button01.disabled = false;
    tier2Button1.disabled = false;
    tier2Button2.disabled = false;
    tier2Button3.disabled = false;
    tier2Button4.disabled = false;
  }

  // Show a message indicating the activated tier
  const tierNames = {
    2: 'Pro'
  };

  // Define the image paths for each tier
  const tierLogos = {
    2: '/assets/images/logo_pro.webp'
  };

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

  document.getElementById('response-message').textContent = `${tierNames[userTier]} tier content activated.`;
}

// Utility function to determine the user's tier based on the zip file name
function inferTierFromFileName(fileName) {
  if (fileName.includes('wasm_tier_2')) return 2;
  return -1; // Unknown tier
}
