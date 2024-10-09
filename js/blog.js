document.addEventListener("DOMContentLoaded", function() {
    const postsPerPage = 10;
    let currentPage = 1;
    const allPosts = Array.from(document.querySelectorAll(".blog-post")); // Convert NodeList to array

    let filteredPosts = allPosts.slice(); // Default to all posts

    function filterPosts(type, value) {
        value = decodeURIComponent(value.replace(/\+/g, '%20')); // Replace + with %20
        filteredPosts = [];  // clear previously filtered posts

        allPosts.forEach(function(post) {
            if ((type === "category" && post.getAttribute("data-category").includes(value)) || 
                !type) {
                filteredPosts.push(post);
            }
        });
    }

    function updateDisplayedPosts() {
        // First, hide all posts
        allPosts.forEach(post => post.style.display = 'none');
      
        // Then display the ones based on the current page
        const start = (currentPage - 1) * postsPerPage;
        const end = start + postsPerPage;

        filteredPosts.slice(start, end).forEach(post => post.style.display = 'block');
      
        // Update pagination buttons' state
        document.getElementById('prevPage').disabled = (currentPage === 1);
        document.getElementById('nextPage').disabled = (currentPage * postsPerPage >= filteredPosts.length);
    }

    document.getElementById('prevPage').addEventListener('click', () => {
        currentPage--;
        updateDisplayedPosts();
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        currentPage++;
        updateDisplayedPosts();
    });

    function resetFilters() {
        window.history.pushState({}, "", '/blog'); // Reset URL to just '/blog' to clear filters
        filteredPosts = allPosts.slice(); // Reset the filtered posts to be all posts
        currentPage = 1; // Go back to the first page
        updateDisplayedPosts(); // Update the display
    }

    document.getElementById("resetFilters").addEventListener("click", function() {
        resetFilters();
    });

    let blogLandingFilterLinks = document.querySelectorAll('.js-filter-landing');

    blogLandingFilterLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
    
            let type = this.getAttribute('data-type');
            let value = this.getAttribute('data-value');
    
            // Use pushState to update URL without reloading
            let newURL = `/blog?${type}=${value}`;
            window.history.pushState({}, "", newURL);
            
            filterPosts(type, value);
            updateDisplayedPosts();
        });
    });

    window.addEventListener('popstate', function(event) {
        const params = getQueryParams();
        
        if (params.category) {
            filterPosts("category", params.category);
        } else {
            resetFilters();
        }
        
        updateDisplayedPosts();
    });

    function getQueryParams() {
        let params = {};
        window.location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(str, key, value) {
            params[key] = value;
        });
        return params;
    }
    
    const params = getQueryParams();
    if (params.category) {
        filterPosts("category", params.category);
    }
    updateDisplayedPosts(); // Update the displayed posts
});
