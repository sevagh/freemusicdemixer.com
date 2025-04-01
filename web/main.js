let hamburgerMenu=document.getElementById("hamburger-menu"),navbarLinks=document.querySelector(".navbar-links"),loginModal=(hamburgerMenu.addEventListener("click",()=>{navbarLinks.classList.toggle("active"),trackProductEvent("Clicked Hamburger Menu")}),document.getElementById("login-modal")),loginBtn=document.getElementById("login-btn"),loginCloseModal=document.getElementById("login-close"),manageAccountBtn=document.getElementById("manage-account"),activeUserModal=document.getElementById("active-user-modal"),activeUserCloseModal=document.getElementById("active-user-close"),emailInput=document.getElementById("billing-email"),responseMessage=document.getElementById("response-message"),tierLogos={0:"/assets/images/logo_free.webp",2:"/assets/images/logo_pro.webp"},tierNames={0:"Free",2:"Pro"};function showToast(e,t=2e3){let s=document.getElementById("toast");s.textContent=e,s.classList.remove("hidden"),setTimeout(()=>s.classList.add("visible"),50),setTimeout(()=>{s.classList.remove("visible"),setTimeout(()=>s.classList.add("hidden"),500)},t)}loginBtn.addEventListener("click",()=>{loginModal.classList.add("show"),trackProductEvent("Opened Login Modal")}),loginCloseModal.addEventListener("click",()=>{loginModal.classList.remove("show"),trackProductEvent("Closed Login Modal")}),manageAccountBtn.addEventListener("click",()=>{activeUserModal.classList.add("show"),trackProductEvent("Opened Manage Account")}),activeUserCloseModal.addEventListener("click",()=>{activeUserModal.classList.remove("show")}),window.addEventListener("click",e=>{e.target===loginModal&&loginModal.classList.remove("show"),e.target===activeUserModal&&activeUserModal.classList.remove("show")}),document.getElementById("activation-form").addEventListener("submit",function(e){e.preventDefault(),activateProContent(emailInput.value)});let themeToggle=document.getElementById("theme-toggle"),themeIcon=document.getElementById("theme-icon"),demixImg=document.getElementById("music-demix-img"),amtImg=document.getElementById("amt-img"),rssImg=document.getElementById("rss-img"),twitterImg=document.getElementById("twitter-img"),redditImg=document.getElementById("reddit-img"),ycImg=document.getElementById("yc-img"),fbImg=document.getElementById("fb-img"),themeResetButton=document.getElementById("theme-reset"),themeResetButton2=document.getElementById("theme-reset-2");function changeGiscusTheme(e){var t;e={setConfig:{theme:e}},(t=document.querySelector("iframe.giscus-frame"))&&t.contentWindow.postMessage({giscus:e},"https://giscus.app")}function applyTheme(e){document.documentElement.classList.remove("theme-dark","theme-light"),"dark"===e?(document.documentElement.classList.add("theme-dark"),themeIcon.className="fa fa-sun",themeToggle.setAttribute("aria-label","Switch to light mode"),demixImg&&amtImg&&(demixImg.src="/assets/images/music-demix-dark.webp",amtImg.src="/assets/images/midi-amt-dark.webp"),rssImg&&(rssImg.src="/assets/social/rss-dark.svg"),twitterImg&&(twitterImg.src="/assets/social/x-twitter-dark.svg",redditImg.src="/assets/social/reddit-dark.svg",ycImg.src="/assets/social/y-combinator-dark.svg",fbImg.src="/assets/social/facebook-dark.svg")):(document.documentElement.classList.add("theme-light"),themeIcon.className="fa fa-moon",themeToggle.setAttribute("aria-label","Switch to dark mode"),demixImg&&amtImg&&(demixImg.src="/assets/images/music-demix.webp",amtImg.src="/assets/images/midi-amt.webp"),rssImg&&(rssImg.src="/assets/social/rss.svg"),twitterImg&&(twitterImg.src="/assets/social/x-twitter.svg",redditImg.src="/assets/social/reddit.svg",ycImg.src="/assets/social/y-combinator.svg",fbImg.src="/assets/social/facebook.svg")),document.getElementById("giscus-script")&&changeGiscusTheme(e)}function loadTheme(){var e=localStorage.getItem("theme");applyTheme(e||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"))}function popupLogic(){let t=document.getElementById("popup-banner"),s=document.getElementById("popup-overlay");var o=document.getElementById("close-popup");if(t&&s){let e=!sessionStorage.getItem("popupDismissed");function n(){t&&(t.classList.remove("popup-banner-shown"),trackProductEvent("Popup Banner Closed")),s&&s.classList.remove("popup-overlay-shown"),e=!1,sessionStorage.setItem("popupDismissed","true")}t&&s&&window.addEventListener("scroll",()=>{30<window.scrollY/(document.body.offsetHeight-window.innerHeight)*100&&e&&(t.classList.add("popup-banner-shown"),s.classList.add("popup-overlay-shown"),trackProductEvent("Popup Banner Shown"))}),o&&o.addEventListener("click",n),s&&s.addEventListener("click",n)}}function displayLoginSpinner(){console.log("Displaying spinner"),document.getElementById("login-overlay").style.display="flex",document.getElementById("login-spinner").style.display="flex"}function removeLoginSpinner(){document.getElementById("login-overlay").style.display="none",document.getElementById("login-spinner").style.display="none"}function activateProContent(t){displayLoginSpinner(),localStorage.setItem("billingEmail",t),trackProductEvent("Content Activated",{email:t}),fetch("https://freemusicdemixer.com/getprocontent?email="+encodeURIComponent(t)).then(e=>{if(e.ok)return e.json();throw removeLoginSpinner(),document.getElementById("response-message").innerHTML='Login failed. If this is a mistake, <a href="/support" target="_blank" rel="noopener noreferrer" alt="contact-link">contact us</a>.',trackProductEvent("Login Failed",{email:t}),new Error("Failed to fetch content")}).then(e=>{e=e.tier;console.log("User Tier: "+e),trackProductEvent("Tier Activated",{email:t,userTier:e}),sessionStorage.setItem("loggedIn","true"),sessionStorage.setItem("userTier",e),activateTierUI(e),trackProductEvent("Login Succeeded",{email:t}),showToast("Login successful! Welcome back."),setTimeout(()=>{loginModal.classList.remove("show")},2e3)}).catch(e=>console.error("Error fetching user tier:",e))}function guessFirstName(e,t=12){let s=capitalize(e.split("@")[0].split(/[\.\_\-\+]/)[0]);return s=s.length>t?s.substring(0,t-1)+"…":s}function capitalize(e){return e.charAt(0).toUpperCase()+e.slice(1)}function activateTierUI(e){removeLoginSpinner();var t=document.querySelector("#logo-display img"),s=document.querySelector("#logo-display small"),e=(t&&s&&(t.src=tierLogos[e],t.alt=`freemusicdemixer-${tierNames[e].toLowerCase()}-logo`,s.textContent=tierNames[e]+" tier ",s.appendChild(t)),2===e&&(document.getElementById("response-message").innerHTML=tierNames[e]+' activated. <a class="wizard-link" href="https://billing.stripe.com/p/login/eVacPX8pKexG5tm8ww">Manage your subscription</a>.',document.getElementById("inactive-user-buttons").style.display="none",document.getElementById("active-user-buttons").style.display="block",t=guessFirstName(s=localStorage.getItem("billingEmail")),document.getElementById("manage-account").textContent=`👤 Welcome, ${t}! ▼`,document.getElementById("active-user-message").innerHTML=`Logged in as <b>${s}</b>`),new CustomEvent("loginSuccess"));window.dispatchEvent(e)}themeResetButton.addEventListener("click",()=>{localStorage.removeItem("theme"),loadTheme()}),themeResetButton2.addEventListener("click",()=>{localStorage.removeItem("theme"),loadTheme()}),themeToggle.addEventListener("click",()=>{var e="dark"==(document.documentElement.classList.contains("theme-dark")?"dark":"light")?"light":"dark";localStorage.setItem("theme",e),applyTheme(e),trackProductEvent("Toggled Theme",{newTheme:e})}),document.addEventListener("DOMContentLoaded",function(){loadTheme();var e=document.documentElement.classList.contains("theme-dark")?"dark":"light",e=(trackProductEvent("Loaded Theme",{appliedTheme:e}),localStorage.getItem("billingEmail")),e=(e&&(emailInput.value=e,responseMessage.textContent=""),window.location.search.includes("login")&&loginModal.classList.add("show"),"true"===sessionStorage.getItem("loggedIn"));let t=0;activateTierUI(t=!e||-1!==(t=parseInt(sessionStorage.getItem("userTier")))&&!isNaN(t)?t:0),popupLogic()});let logoutLink=document.getElementById("logout-link");logoutLink.addEventListener("click",function(e){e.preventDefault(),localStorage.removeItem("billingEmail"),sessionStorage.removeItem("loggedIn"),sessionStorage.removeItem("userTier"),document.getElementById("active-user-buttons").style.display="none",document.getElementById("inactive-user-buttons").style.display="block";var e=document.querySelector("#logo-display img"),t=document.querySelector("#logo-display small");e&&t&&(e.src=tierLogos[0],e.alt="freemusicdemixer-free-logo",t.textContent="Free tier ",t.appendChild(e)),trackProductEvent("Logged Out"),window.location.href="/"});