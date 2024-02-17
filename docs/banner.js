document.addEventListener("DOMContentLoaded", function() {
    // check to see if pop banner should be shown
    if (!sessionStorage.getItem('bannerDismissed')) {
        document.getElementById('sticky-banner').style.display = 'block';
    }

    // Add the event listener for the dismiss button inside the DOMContentLoaded callback
    var dismissButton = document.getElementById('banner-dismiss-button');
    if (dismissButton) {
        dismissButton.addEventListener('click', function() {
            console.log("Setting bannerDismissed to true");
            sessionStorage.setItem('bannerDismissed', 'true');
            document.getElementById('sticky-banner').style.display = 'none';
            console.log(sessionStorage.getItem('bannerDismissed'));
        });
    } else {
        console.error('Dismiss button not found');
    }

    const popupBanner = document.getElementById('popup-banner');
    const popupOverlay = document.getElementById('popup-overlay');
    const closeButton = document.getElementById('close-popup');

    // Initialize shouldShowPopup based on sessionStorage
    let shouldShowPopup = !sessionStorage.getItem('popupDismissed');

    // Function to hide the popup and overlay
    function hidePopup() {
        popupBanner.classList.remove('popup-banner-shown');
        popupOverlay.classList.remove('popup-overlay-shown');
        shouldShowPopup = false; // Update the flag so it won't show again
        sessionStorage.setItem('popupDismissed', 'true');
    }

    window.addEventListener('scroll', () => {
        let scrolledPercentage = (window.scrollY / (document.body.offsetHeight - window.innerHeight)) * 100;
        if (scrolledPercentage > 30 && shouldShowPopup) { // Trigger at 30% scroll
            popupBanner.classList.add('popup-banner-shown');
            popupOverlay.classList.add('popup-overlay-shown');
        }
    });

    closeButton.addEventListener('click', hidePopup);
    popupOverlay.addEventListener('click', hidePopup);
});
