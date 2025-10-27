const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyMmU3NDM4NmNhNDM3YTc4M2E4MWM5N2JhZWU5NWEyZSIsIm5iZiI6MTY2MDgyNjk5MS4wNzUsInN1YiI6IjYyZmUzNTZmOTYzODY0MDA4M2VjZDY4MyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.0M_YlL5R4CPuval3nA4o7pXhvObcRG_TO-mgkVN1-vU';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const YOUTUBE_BASE_URL = 'https://www.youtube.com/embed/';
const WATCHLIST_STORAGE_KEY = 'cineverse_watchlist';

// Endpoints
const TV_SHOW_BASE_URL = `${TMDB_BASE_URL}/tv`;
const POPULAR_TV_URL = `${TV_SHOW_BASE_URL}/popular`;
const TOP_RATED_TV_URL = `${TV_SHOW_BASE_URL}/top_rated`;
const ON_THE_AIR_TV_URL = `${TV_SHOW_BASE_URL}/on_the_air`;
const AIRING_TODAY_TV_URL = `${TMDB_BASE_URL}/tv/airing_today`;
const POPULAR_MOVIES_URL = `${TMDB_BASE_URL}/movie/popular`;
const NOW_PLAYING_URL = `${TMDB_BASE_URL}/movie/now_playing`;
const SEARCH_MOVIE_URL = `${TMDB_BASE_URL}/search/multi`;
const GENRE_LIST_URL = `${TMDB_BASE_URL}/genre/movie/list`;
const TOP_RATED_MOVIES_URL = `${TMDB_BASE_URL}/movie/top_rated`;
const UPCOMING_MOVIES_URL = `${TMDB_BASE_URL}/movie/upcoming`;
const DISCOVER_MOVIE_URL = `${TMDB_BASE_URL}/discover/movie`;
const DISCOVER_TV_URL = `${TMDB_BASE_URL}/discover/tv`;

// Image Settings
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';
const POSTER_SIZE = 'w500';
const BACKDROP_SIZE = 'original';

// Global State for App View
let currentApiUrl = POPULAR_MOVIES_URL;
let watchlist = [];
let currentSearchQuery = '';
let currentPage = 1;
let totalPages = 1;
let currentMediaType = 'movie';
let genreMap = {};
let currentGenreId = null;
let currentGenreName = '';
let currentView = 'home-view';


// =================================================================
// 2. FETCHING FUNCTIONS
// =================================================================

async function fetchMovies(url, page = 1, query = '') {
    const mediaTypePath = url.includes('/tv') ? 'tv' : 'movie';

    try {
        const separator = url.includes('?') ? '&' : '?';
        let urlWithParams = `${url}${separator}page=${page}`;

        if (url.includes(TMDB_BASE_URL + '/search')) {
            urlWithParams += `&query=${encodeURIComponent(query)}`;
        } else if (url.includes('/discover')) {
            if (currentGenreId) {
                urlWithParams += `&with_genres=${currentGenreId}`;
            }
        }

        if (url === SEARCH_MOVIE_URL) {
            urlWithParams += `&include_adult=true`; // Good practice
        }

        if (url.includes(DISCOVER_MOVIE_URL) && currentMediaType === 'tv') {
            urlWithParams = urlWithParams.replace(DISCOVER_MOVIE_URL, DISCOVER_TV_URL);
        } else if (url.includes(DISCOVER_TV_URL) && currentMediaType === 'movie') {
            urlWithParams = urlWithParams.replace(DISCOVER_TV_URL, DISCOVER_MOVIE_URL);
        }

        const options = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TMDB_TOKEN}`,
                'accept': 'application/json'
            }
        };

        const response = await fetch(urlWithParams, options);

        if (!response.ok) {
            throw new Error(`HTTP error fetching data ! status: ${response.status} for URL: ${urlWithParams}`);
        }

        const data = await response.json();

        currentPage = data.page;
        totalPages = data.total_pages;

        if (url === SEARCH_MOVIE_URL) {
            return data.results
                .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
                .map(item => ({
                    ...item,
                    media_type: item.media_type // Ensure media_type is present for later use
                }));
        }

        return data.results;
    }
    catch (error) {
        console.error("Could not fetch media:", error);
        return [];
    }
}

async function fetchMoviesByGenre(genreId, genreName, page = 1) {
    currentApiUrl = currentMediaType === 'tv' ? DISCOVER_TV_URL : DISCOVER_MOVIE_URL;
    currentGenreId = genreId;
    currentGenreName = genreName;
    currentPage = page;
    currentSearchQuery = ''; // Clear search state when filtering by genre

    const movies = await fetchMovies(currentApiUrl, currentPage);

    const exploreTitle = document.querySelector('.content-view:not(.hidden) .explore-section h2') || document.getElementById('explore-title');
    if (exploreTitle) {
        const type = currentMediaType === 'tv' ? 'Shows' : 'Movies';
        exploreTitle.textContent = `${genreName} ${type}`;
    }

    renderMovies(movies);
    renderPaginator();
}

async function fetchGenres(mediaType = 'movie') {
    const GENRE_LIST_URL_SPECIFIC = `${TMDB_BASE_URL}/genre/${mediaType}/list`;
    try {
        const options = {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${TMDB_TOKEN}`, 'accept': 'application/json' }
        };

        const response = await fetch(GENRE_LIST_URL_SPECIFIC, options);

        if (!response.ok) {
            throw new Error(`HTTP error fetching genres ! status: ${response.status}`);
        }

        const data = await response.json();

        genreMap = {};
        data.genres.forEach(genre => {
            genreMap[genre.id] = genre.name;
        });

        // NEW: Render the genre navigation after fetching
        renderGenreNavigation(mediaType);

        return data.genres;
    }
    catch (error) {
        console.error(`Could not fetch ${mediaType} genres:`, error);
        return [];
    }
}

async function fetchMovieTrailer(movieId) {
    // Determine media type based on global state or context (if available)
    const mediaType = currentMediaType; // Using global state
    const VIDEO_URL = `${TMDB_BASE_URL}/${mediaType}/${movieId}/videos`;

    try {
        const options = {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${TMDB_TOKEN}`, 'accept': 'application/json' }
        };

        const response = await fetch(VIDEO_URL, options);

        if (!response.ok) throw new Error(`HTTP error fetching videos ! status: ${response.status}`);
        const data = await response.json();

        // Find the first official trailer on YouTube
        const trailer = data.results.find(video =>
            video.site === 'YouTube' &&
            (video.type === 'Trailer' || video.type === 'Teaser')
        );

        return trailer ? trailer.key : null;

    }

    catch (error) {
        console.error(`Could not fetch trailer for item ${movieId}:`, error);
        return null;
    }
}

async function fetchHeroMovie() {
    try {
        const nowPlaying = await fetchMovies(NOW_PLAYING_URL);
        if (nowPlaying.length === 0) return null;

        nowPlaying.sort((a, b) => b.popularity - a.popularity);
        return nowPlaying[0];

    }

    catch (error) {
        console.error("Could not fetch hero movie:", error);
        return null;
    }
}

async function fetchHeroTVShow() {
    try {
        const topRatedTV = await fetchMovies(POPULAR_TV_URL); // Reusing fetchMovies
        if (topRatedTV.length === 0) return null;

        topRatedTV.sort((a, b) => b.popularity - a.popularity);
        return topRatedTV[0];

    } catch (error) {
        console.error("Could not fetch hero TV show:", error);
        return null;
    }
}

async function fetchHeroHomeMovie() {
    try {
        const topRatedMovies = await fetchMovies(TOP_RATED_MOVIES_URL);
        if (topRatedMovies.length === 0) return null;

        topRatedMovies.sort((a, b) => b.popularity - a.popularity);
        return topRatedMovies[0];

    }

    catch (error) {
        console.error("Could not fetch hero movie:", error);
        return null;
    }
}

// Helper to find a movie/show by ID from TMDB
async function fetchItemDetails(itemId, mediaType) {
    const DETAIL_URL = `${TMDB_BASE_URL}/${mediaType}/${itemId}`;

    try {
        const options = {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${TMDB_TOKEN}`, 'accept': 'application/json' }
        };

        const response = await fetch(DETAIL_URL, options);
        if (!response.ok) throw new Error(`HTTP error fetching details ! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Could not fetch details for item ${itemId}:`, error);
        return null;
    }
}


// =================================================================
// 3. RENDERING FUNCTIONS
// =================================================================

function createMovieCard(item) {
    const itemMediaType = item.media_type || currentMediaType;
    const posterPath = item.poster_path
        ? `${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}`
        : 'https://placehold.co/500x750/374151/FFFFFF?text=Poster+Unavailable'; // Fallback

    const title = item.title || item.name;
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const itemId = item.id;
    const releaseYear = item.release_date || item.first_air_date;
    let year = releaseYear ? String(releaseYear).split('-')[0] : 'N/A';
    const genreIds = item.genre_ids || [];
    const genres = item.genres ? item.genres.slice(0, 2).map(g => g.name) : genreIds.slice(0, 2).map(id => genreMap[id]).filter(name => name);
    const itemIdStr = String(itemId);
    const isAdded = watchlist.includes(itemIdStr);
    const btnClass = isAdded ? 'added' : '';
    const btnIcon = isAdded ? 'fa-check' : 'fa-plus';
    const btnText = isAdded ? ' Added' : '';

    const genreTagsHTML = genres.length > 0
        ? genres.map(genre => `<span class="genre-tag">${genre}</span>`).join('')
        : '<span class="genre-tag">N/A</span>';

    return ` <div class="movie-card" data-movie-id="${itemId}">
    <div class="poster-container">
    <img src="${posterPath}"alt="${title} Poster" class="movie-poster">
    <div class="overlay">
    <button class="overlay-btn play-btn list-trailer-btn" data-movie-id="${itemId}"><i class="fas fa-play"></i></button>
    <button class="overlay-btn add-btn ${btnClass}" data-id="${itemIdStr}">
                        <i class="fas ${btnIcon}"></i>${btnText}
                    </button>
    </div>
    </div>
    <h3 class="movie-title">${title}
    </h3><p class="movie-year">${releaseYear}
    </p><div class="genre-container">${genreTagsHTML}
    </div><p class="movie-rating"><i class="fas fa-star"></i>${rating}</p></div>`;
}

function renderMovies(movies) {
    // Select the movie grid container in the *active* view
    let movieListContainer;
    if (currentView === 'watchlist-view') {
        movieListContainer = document.getElementById('watchlist-grid');
    } else if (currentView === 'tv-shows-view') {
        movieListContainer = document.querySelector('#tv-shows-view .movie-listings');
    } else if (currentView === 'movies-view') {
        movieListContainer = document.querySelector('#movies-view .movie-listings');
    } else {
        movieListContainer = document.querySelector('#home-view .movie-listings');
    }

    if (!movieListContainer) {
        console.error("Movie list container not found for the current view:", currentView);
        return;
    }

    movieListContainer.innerHTML = '';

    if (movies.length === 0) {
        movieListContainer.innerHTML = '<p class="text-center text-xl text-gray-300 col-span-full pt-10">No results found. Try a different search or filter.</p>';
        return;
    }

    movies.forEach(movie => {
        const cardHTML = createMovieCard(movie);
        movieListContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
}

function renderHeroSection(item, heroSectionId, titleId, descriptionId, trailerBtnId) {
    if (!item) return;

    const heroSection = document.querySelector(heroSectionId);
    const heroTitle = document.getElementById(titleId);
    const heroDescription = document.getElementById(descriptionId);
    const watchTrailerBtn = document.getElementById(trailerBtnId);

    const backdropPath = item.backdrop_path ? `${IMAGE_BASE_URL}${BACKDROP_SIZE}${item.backdrop_path}` : '';
    if (heroSection && backdropPath) {
        heroSection.style.backgroundImage = `url('${backdropPath}')`;
    }

    if (heroTitle) heroTitle.textContent = item.title || item.name || 'Title Not Found';
    if (heroDescription) {
        const synopsis = item.overview && item.overview.length > 200
            ? item.overview.substring(0, 200) + '...'
            : item.overview;
        heroDescription.textContent = synopsis || 'No synopsis available.';
    }

    if (watchTrailerBtn) {
        // Ensure the button is enabled and has the correct movie ID and type
        watchTrailerBtn.dataset.movieId = item.id;
        watchTrailerBtn.dataset.mediaType = item.media_type || currentMediaType;
    }
}

function renderPaginator() {
    // Select paginator elements only within the active view's container
    const activeView = document.getElementById(currentView);
    if (!activeView || currentView === 'watchlist-view') return; // No pagination for watchlist

    const prevBtn = activeView.querySelector('#prev-page-btn');
    const nextBtn = activeView.querySelector('#next-page-btn');
    const pageNumbersContainer = activeView.querySelector('#page-numbers');

    if (!prevBtn || !nextBtn || !pageNumbersContainer) return;

    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= Math.min(totalPages, 500); // TMDB limits to 500 pages

    pageNumbersContainer.innerHTML = '';
    const maxPagesToShow = 5;
    const endLimit = Math.min(totalPages, 500);

    // Calculate pagination window
    const startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(endLimit, startPage + maxPagesToShow - 1);

    // Adjust start page if we hit the end limit
    const finalStartPage = Math.max(1, endPage - maxPagesToShow + 1);

    for (let i = finalStartPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.classList.add('page-number-btn', 'bg-gray-700', 'text-gray-300', 'hover:bg-red-600', 'hover:text-white', 'py-2', 'px-3', 'rounded-lg', 'transition', 'duration-200');
        pageBtn.dataset.page = i;

        if (i === currentPage) {
            pageBtn.classList.add('active', 'bg-red-600', 'text-white');
            pageBtn.classList.remove('bg-gray-700', 'text-gray-300', 'hover:bg-red-600', 'hover:text-white');
        }

        pageNumbersContainer.appendChild(pageBtn);
    }
}

function renderGenreNavigation(mediaType) {
    // Select the appropriate genre navigation container based on the view
    let genreNavId;
    if (mediaType === 'tv') {
        genreNavId = 'genre-nav-tv';
    } else if (currentView === 'movies-view') {
        genreNavId = 'genre-nav-movies';
    } else {
        // Fallback for home/default view
        genreNavId = 'genre-nav';
    }

    const genreNav = document.getElementById(genreNavId);

    if (!genreNav) return;

    genreNav.innerHTML = '';

    // 1. Render the 'Popular' button
    let popularBtnClass = 'filter-btn px-3 py-1 rounded-full text-sm font-medium transition duration-200 ease-in-out';
    if (!currentGenreId) {
        popularBtnClass += ' active bg-red-600 text-white';
    } else {
        popularBtnClass += ' bg-gray-700 text-gray-300 hover:bg-red-700';
    }
    genreNav.insertAdjacentHTML('beforeend', `<button class="${popularBtnClass}" data-genre-id="popular" data-genre-name="Popular">Popular</button>`);

    // 2. Render all other genres
    const sortedGenres = Object.keys(genreMap).map(id => ({ id: id, name: genreMap[id] })).sort((a, b) => a.name.localeCompare(b.name));

    sortedGenres.forEach(genre => {
        let buttonClass = 'filter-btn genre-filter-btn px-3 py-1 rounded-full text-sm font-medium transition duration-200 ease-in-out';
        if (String(genre.id) === String(currentGenreId)) {
            buttonClass += ' active bg-red-600 text-white';
        } else {
            buttonClass += ' bg-gray-700 text-gray-300 hover:bg-red-700';
        }

        const buttonHTML = `<button class="${buttonClass}" data-genre-id="${genre.id}" data-genre-name="${genre.name}">${genre.name}</button>`;
        genreNav.insertAdjacentHTML('beforeend', buttonHTML);
    });
}


// =================================================================
// 4. EVENT HANDLERS
// =================================================================

function setupHamburgerMenu() {
    const hamburgerBtn = document.querySelector('.hamburger-menu');
    const mainNav = document.querySelector('.main-nav');
    const hamburgerIcon = hamburgerBtn ? hamburgerBtn.querySelector('i') : null;

    if (hamburgerBtn && mainNav && hamburgerIcon) {
        hamburgerBtn.addEventListener('click', () => {
            mainNav.classList.toggle('active');

            if (mainNav.classList.contains('active')) {
                hamburgerIcon.classList.remove('fa-bars');
                hamburgerIcon.classList.add('fa-times');
            }

            else {
                hamburgerIcon.classList.remove('fa-times');
                hamburgerIcon.classList.add('fa-bars');
            }
        });
    }
}

function setupVideoModal() {
    const modal = document.getElementById('video-modal');
    const closeBtn = document.querySelector('.close-btn');
    const videoPlayer = document.getElementById('video-player');

    // Function to close and clean up the video player
    function closeModal() {
        modal.style.display = 'none';
        videoPlayer.innerHTML = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Event Delegation for Play Buttons (using 'trailer-trigger' class)
    document.addEventListener('click', async (e) => {
        const triggerBtn = e.target.closest('.trailer-trigger, .list-trailer-btn');

        if (triggerBtn) {
            const movieId = triggerBtn.dataset.movieId;
            const mediaType = triggerBtn.dataset.mediaType || currentMediaType; // Use button specific type if available
            if (!movieId) return console.warn("Movie ID not found on trailer button.");

            // Temporarily set global type for fetchMovieTrailer if needed
            const originalMediaType = currentMediaType;
            currentMediaType = mediaType;

            videoPlayer.innerHTML = '<p style="text-align: center; color: white; padding: 5rem 0;">Loading trailer...</p>';
            modal.style.display = 'block';

            const trailerKey = await fetchMovieTrailer(movieId);

            // Restore original media type
            currentMediaType = originalMediaType;

            if (trailerKey) {
                const embedUrl = `${YOUTUBE_BASE_URL}${trailerKey}?autoplay=1&rel=0&showinfo=0&modestbranding=1`;
                videoPlayer.innerHTML = `<iframe src="${embedUrl}" frameborder="0"allow="autoplay; encrypted-media"allowfullscreen></iframe>`;
            }

            else {
                videoPlayer.innerHTML = '<p style="text-align: center; color: white; padding: 5rem 0;">Trailer not found for this item.</p>';
            }
        }
    });
}

function handlePaginatorClicks() {
    // Delegate clicks on the main content area to handle pagination for the active view
    document.addEventListener('click', async (e) => {
        const paginatorContainer = e.target.closest('.pagination-container');
        if (!paginatorContainer || paginatorContainer.closest('.content-view').id !== currentView) return;

        let newPage = currentPage;
        let isPageChange = false;

        // Check Previous/Next Buttons
        if (e.target.closest('#prev-page-btn') && currentPage > 1) {
            newPage = currentPage - 1;
            isPageChange = true;
        }

        else if (e.target.closest('#next-page-btn') && currentPage < Math.min(totalPages, 500)) {
            newPage = currentPage + 1;
            isPageChange = true;
        }

        // Check Page Number Buttons
        else {
            const pageNumberBtn = e.target.closest('.page-number-btn');

            if (pageNumberBtn && !pageNumberBtn.classList.contains('active')) {
                newPage = parseInt(pageNumberBtn.dataset.page);
                isPageChange = true;
            }
        }

        if (isPageChange && newPage !== currentPage) {
            let movies;

            // Check if we are currently filtering by genre
            if (currentGenreId) {
                // Call genre fetcher if filtering by genre
                await fetchMoviesByGenre(currentGenreId, currentGenreName, newPage);
                // The above function already handles rendering movies and paginator, so we stop here.
                return;
            } else {
                // Otherwise, use the standard API URL
                movies = await fetchMovies(currentApiUrl, newPage, currentSearchQuery);
            }

            renderMovies(movies);
            renderPaginator();

            const exploreTitle = document.querySelector('.content-view:not(.hidden) .explore-section h2');

            if (exploreTitle) exploreTitle.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
}

function setupGenreFilterListeners() {
    // Delegate clicks on the main content area to handle genre filters
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.genre-filter-btn, [data-genre-id="popular"]');

        // Ensure the click is within an active genre navigation container
        if (!btn || btn.classList.contains('active') || !btn.closest('.genre-nav-container') || btn.closest('.content-view').id !== currentView) return;

        const genreNav = btn.closest('.genre-nav-container');

        // 1. Update Active State
        genreNav.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('active', 'bg-red-600', 'text-white');
            b.classList.add('bg-gray-700', 'text-gray-300', 'hover:bg-red-700');
        });
        btn.classList.add('active', 'bg-red-600', 'text-white');
        btn.classList.remove('bg-gray-700', 'text-gray-300', 'hover:bg-red-700');

        const genreId = btn.dataset.genreId;
        const genreName = btn.dataset.genreName;
        const exploreTitle = document.querySelector('.content-view:not(.hidden) .explore-section h2');
        const type = currentMediaType === 'tv' ? 'Shows' : 'Movies';

        // 2. Handle Popular/All Movies case
        if (genreId === 'popular') {
            currentApiUrl = currentMediaType === 'tv' ? POPULAR_TV_URL : POPULAR_MOVIES_URL;
            currentPage = 1;
            currentGenreId = null; // Clear genre state
            currentGenreName = '';
            currentSearchQuery = '';

            const movies = await fetchMovies(currentApiUrl, currentPage);

            if (exploreTitle) exploreTitle.textContent = `Explore Popular ${type}`;

            renderMovies(movies);
            renderPaginator();

        } else if (genreId) {
            // 3. Handle specific genre filter
            // fetchMoviesByGenre will update state and render for page 1
            await fetchMoviesByGenre(genreId, genreName, 1);
        }

        if (exploreTitle) exploreTitle.scrollIntoView({
            behavior: 'smooth'
        });
    });
}

async function handleSearch(e) {
    e.preventDefault();

    // Use the search input from the currently displayed search form
    const searchInput = document.getElementById('search-input') || document.getElementById('search-input-mobile');
    const query = searchInput.value.trim();
    const exploreTitle = document.querySelector('.content-view:not(.hidden) .explore-section h2') || document.getElementById('explore-title');
    const type = currentMediaType === 'tv' ? 'Shows' : 'Movies';

    // Set the main view to the appropriate page for search context
    if (currentView === 'home-view') {
        showView('movies-view'); // Default home searches to movies view
    }

    if (query === '') {
        // If query is cleared, revert to the current media type's popular list
        currentApiUrl = currentMediaType === 'tv' ? POPULAR_TV_URL : POPULAR_MOVIES_URL;
        currentSearchQuery = '';
    } else {
        // Use the multi-search endpoint
        currentApiUrl = SEARCH_MOVIE_URL;
        currentSearchQuery = query;
    }

    currentPage = 1;
    currentGenreId = null; // Clear genre filter on search

    const movies = await fetchMovies(currentApiUrl, currentPage, currentSearchQuery);

    // Update the main content area title
    if (exploreTitle) {
        exploreTitle.textContent = currentSearchQuery ? `Search Results for "${currentSearchQuery}"` : `Explore Popular ${type}`;
    }

    // Ensure 'Popular' button is active when search is cleared/no results
    if (!currentSearchQuery) {
        const genreNav = document.querySelector('.content-view:not(.hidden) .genre-nav-container');
        if (genreNav) {
            genreNav.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active', 'bg-red-600', 'text-white');
                b.classList.add('bg-gray-700', 'text-gray-300', 'hover:bg-red-700');
            });
            const popularBtn = genreNav.querySelector('[data-genre-id="popular"]');
            if (popularBtn) {
                popularBtn.classList.add('active', 'bg-red-600', 'text-white');
                popularBtn.classList.remove('bg-gray-700', 'text-gray-300', 'hover:bg-red-700');
            }
        }
    }

    renderMovies(movies);
    renderPaginator();

    if (exploreTitle) exploreTitle.scrollIntoView({
        behavior: 'smooth'
    });

}

// Attach search listeners to both forms
document.getElementById('search-form')?.addEventListener('submit', handleSearch);
document.getElementById('search-form-mobile')?.addEventListener('submit', handleSearch);


function loadWatchlist() {
    // Retrieve the watchlist from local storage
    const storedWatchlist = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    // Parse the JSON string or default to an empty array
    watchlist = storedWatchlist ? JSON.parse(storedWatchlist) : [];
}

function saveWatchlist() {
    // Save the current state of the watchlist array to local storage
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
}

function updateWatchlistButton(movieId, buttonElement) {
    if (!buttonElement) return;

    const isInWatchlist = watchlist.includes(String(movieId));

    if (isInWatchlist) {
        buttonElement.innerHTML = '<i class="fas fa-check"></i> Added';
        buttonElement.classList.add('added');
    } else {
        buttonElement.innerHTML = '<i class="fas fa-plus"></i>';
        buttonElement.classList.remove('added');
    }
}

function handleWatchlistClick(movieId) {
    const movieIdStr = String(movieId);
    const index = watchlist.indexOf(movieIdStr);
    let isRemoval = false;

    if (index > -1) {
        // Movie is already in the list: REMOVE it
        watchlist.splice(index, 1);
        isRemoval = true;
    } else {
        // Movie is NOT in the list: ADD it
        watchlist.push(movieIdStr);
    }

    saveWatchlist();

    if (isRemoval && currentView === 'watchlist-view') {
        const cardToRemove = document.querySelector(`.movie-card[data-movie-id="${movieIdStr}"]`);
        if (cardToRemove) {
            cardToRemove.remove();

            // If the list is now empty, update the message
            if (watchlist.length === 0) {
                const grid = document.getElementById('watchlist-grid');
                if (grid) grid.innerHTML = '<p class="text-center text-xl text-gray-300 col-span-full pt-10">Your watchlist is empty. Go back to the <a href="#" data-view="home-view" class="text-red-500 hover:text-red-400 nav-link">Home</a> page to add some movies! 🍿</p>';
            }
        }
    }

    // Update all buttons globally for this movie ID
    document.querySelectorAll(`[data-id="${movieIdStr}"]`).forEach(btn => {
        updateWatchlistButton(movieIdStr, btn);
    });
}

function setupWatchlistListeners() {
    document.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-btn');

        // Ensure it's the watchlist button
        if (addBtn && addBtn.dataset.id) {
            e.preventDefault();
            const movieId = addBtn.dataset.id;
            handleWatchlistClick(movieId);
        }
    });
}

function setupCategoryFilter() {
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.category-filter .filter-btn');

        if (!btn || btn.classList.contains('active') || !btn.closest('.category-filter') || btn.closest('.content-view').id !== currentView) return;

        const filterContainer = btn.closest('.category-filter');

        filterContainer.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('active', 'bg-red-600', 'text-white');
            b.classList.add('bg-gray-700', 'text-gray-300', 'hover:bg-red-700');
        });
        btn.classList.add('active', 'bg-red-600', 'text-white');
        btn.classList.remove('bg-gray-700', 'text-gray-300', 'hover:bg-red-700');

        const apiSegment = btn.dataset.apiUrl;
        let newApiUrl;
        let titleText = btn.textContent.trim();

        if (currentMediaType === 'tv') {
            switch (apiSegment) {
                case 'top_rated_tv': newApiUrl = TOP_RATED_TV_URL; break;
                case 'on_the_air': newApiUrl = ON_THE_AIR_TV_URL; break;
                case 'airing_today': newApiUrl = AIRING_TODAY_TV_URL; break;
                case 'popular':
                default: newApiUrl = POPULAR_TV_URL; break;
            }
        } else { // movie
            switch (apiSegment) {
                case 'top_rated': newApiUrl = TOP_RATED_MOVIES_URL; break;
                case 'now_playing': newApiUrl = NOW_PLAYING_URL; break;
                case 'upcoming': newApiUrl = UPCOMING_MOVIES_URL; break;
                case 'popular':
                default: newApiUrl = POPULAR_MOVIES_URL; break;
            }
        }

        const genreNav = document.querySelector('.content-view:not(.hidden) .genre-nav-container');
        if (genreNav) {
            genreNav.querySelectorAll('.genre-filter-btn').forEach(b => b.classList.remove('active', 'bg-red-600', 'text-white'));
            genreNav.querySelectorAll('.genre-filter-btn').forEach(b => b.classList.add('bg-gray-700', 'text-gray-300', 'hover:bg-red-700'));
            const popularBtn = genreNav.querySelector('[data-genre-id="popular"]');
            if (popularBtn) {
                popularBtn.classList.add('active', 'bg-red-600', 'text-white');
                popularBtn.classList.remove('bg-gray-700', 'text-gray-300', 'hover:bg-red-700');
            }
        }

        currentApiUrl = newApiUrl;
        currentPage = 1;
        currentGenreId = null; // Clear genre filter
        currentSearchQuery = ''; // Clear search

        const movies = await fetchMovies(currentApiUrl, currentPage);
        renderMovies(movies);
        renderPaginator();

        const exploreTitle = document.querySelector('.content-view:not(.hidden) .explore-section h2');
        if (exploreTitle) exploreTitle.textContent = titleText + (currentMediaType === 'tv' ? ' TV Shows' : ' Movies');

        if (exploreTitle) exploreTitle.scrollIntoView({
            behavior: 'smooth'
        });
    });
}


// =================================================================
// 5. INITIALIZATION FUNCTIONS PER VIEW
// =================================================================

// Helper to handle view switching logic
function showView(viewName) {
    currentView = viewName;
    const views = document.querySelectorAll('.content-view');
    views.forEach(view => {
        view.classList.add('hidden');
    });
    const activeView = document.getElementById(viewName);
    if (activeView) {
        activeView.classList.remove('hidden');
    }

    // Reset pagination state when switching views that use the main paginator
    currentPage = 1;
    currentGenreId = null;
    currentSearchQuery = '';

    // Re-fetch category and popular states
    document.querySelectorAll('.category-filter .filter-btn').forEach(b => {
        b.classList.remove('active', 'bg-red-600', 'text-white');
        if (b.dataset.apiUrl === 'popular') b.classList.add('active', 'bg-red-600', 'text-white');
        else b.classList.add('bg-gray-700', 'text-gray-300', 'hover:bg-red-700');
    });


    // Initialize content based on view
    if (viewName === 'movies-view') {
        initMoviesPageContent();
        initMoviesPageHero();
    } else if (viewName === 'tv-shows-view') {
        initTVShowsPageContent();
        initTVShowsPageHero();
    } else if (viewName === 'watchlist-view') {
        initWatchlistPage();
    } else if (viewName === 'home-view') {
        initHomePageContent();
        initHomeMoviesPageHero();
    }

    // Close mobile menu if active
    const mainNav = document.querySelector('.main-nav');
    const hamburgerIcon = document.querySelector('.hamburger-menu i');
    if (mainNav && mainNav.classList.contains('active')) {
        mainNav.classList.remove('active');
        if (hamburgerIcon) {
            hamburgerIcon.classList.remove('fa-times');
            hamburgerIcon.classList.add('fa-bars');
        }
    }
}

// Setup the listeners for all nav links
function handleNavClick() {
    document.addEventListener('click', (e) => {
        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            e.preventDefault();
            const view = navLink.dataset.view;
            if (view) {
                showView(view);
            }
        }
    });

    // Handle logo/app name click to go home
    const logo = document.getElementById('app-logo');
    if (logo) {
        logo.addEventListener('click', (e) => {
            e.preventDefault();
            showView('home-view');
        });
    }
}


async function initHomeMoviesPageHero() {
    const featuredHomeMovie = await fetchHeroHomeMovie();
    if (featuredHomeMovie) {
        renderHeroSection(
            featuredHomeMovie,
            '.hero-section.hero-home',
            'home-hero-title',
            'home-hero-description',
            'home-hero-trailer-btn'
        );
    }
}

async function initMoviesPageHero() {
    const featuredMovie = await fetchHeroMovie();
    if (featuredMovie) {
        renderHeroSection(
            featuredMovie,
            '.hero-section.hero-movie',
            'movie-hero-title',
            'movie-hero-description',
            'movie-hero-trailer-btn'
        );
    }
}

async function initTVShowsPageHero() {
    const featuredTVShow = await fetchHeroTVShow();
    if (featuredTVShow) {
        renderHeroSection(
            featuredTVShow,
            '.hero-section.hero-tv',
            'tv-hero-title',
            'tv-hero-description',
            'tv-hero-trailer-btn'
        );
    }
}

async function initHomePageContent() {
    currentMediaType = 'movie'; // Default media type for home explore
    await fetchGenres('movie'); // Fetch movie genres

    const exploreTitle = document.getElementById('explore-title');
    if (exploreTitle) exploreTitle.textContent = 'Explore Popular Movies';

    currentApiUrl = POPULAR_MOVIES_URL;
    currentPage = 1;
    const popularMovies = await fetchMovies(currentApiUrl, currentPage);

    renderMovies(popularMovies);
    renderPaginator();
}

async function initMoviesPageContent() {
    currentMediaType = 'movie'; // Ensure global flag is correct
    await fetchGenres('movie'); // Fetch movie genres

    const exploreTitle = document.getElementById('movies-explore-title');
    if (exploreTitle) exploreTitle.textContent = 'Popular Movies';

    currentApiUrl = POPULAR_MOVIES_URL;
    currentPage = 1;
    const popularMovies = await fetchMovies(currentApiUrl, currentPage);

    renderMovies(popularMovies);
    renderPaginator();
}

async function initTVShowsPageContent() {
    currentMediaType = 'tv'; // Set global flag to TV
    await fetchGenres('tv'); // Fetch TV show genres

    const exploreTitle = document.getElementById('tv-shows-explore-title');
    if (exploreTitle) exploreTitle.textContent = 'Popular TV Shows';

    currentApiUrl = POPULAR_TV_URL;
    currentPage = 1;
    const popularShows = await fetchMovies(currentApiUrl, currentPage);

    renderMovies(popularShows);
    renderPaginator();
}

async function initWatchlistPage() {
    loadWatchlist(); // Ensure latest state is loaded

    const watchlistGrid = document.getElementById('watchlist-grid');
    if (!watchlistGrid) return;

    watchlistGrid.innerHTML = '<p class="text-center text-xl text-gray-300 col-span-full pt-10">Loading Watchlist...</p>';

    if (watchlist.length === 0) {
        watchlistGrid.innerHTML = '<p class="text-center text-xl text-gray-300 col-span-full pt-10">Your watchlist is empty. Go back to the <a href="#" data-view="home-view" class="text-red-500 hover:text-red-400 nav-link">Home</a> page to add some movies! 🍿</p>';
        return;
    }

    // Fetch details for each item in the watchlist. Since the ID is stored without type, 
    // we must try both movie and TV show lookups to ensure we find the right one.
    const itemPromises = watchlist.map(itemId => {
        return Promise.all([
            // Try fetching as movie
            fetchItemDetails(itemId, 'movie').then(res => res ? { ...res, media_type: 'movie' } : null),
            // Try fetching as TV show
            fetchItemDetails(itemId, 'tv').then(res => res ? { ...res, media_type: 'tv' } : null)
        ]).then(([movie, tv]) => movie || tv); // Take the first successful fetch
    });

    const items = (await Promise.all(itemPromises)).filter(item => item !== null);

    if (items.length > 0) {
        // Ensure movie genres are loaded for rendering the genre tags
        await fetchGenres('movie');

        watchlistGrid.classList.add('movie-grid');
        watchlistGrid.innerHTML = '';
        items.forEach(item => {
            const cardHTML = createMovieCard(item);
            watchlistGrid.insertAdjacentHTML('beforeend', cardHTML);
        });

        // Manually update all buttons in the watchlist grid
        watchlist.forEach(movieIdStr => {
            document.querySelectorAll(`#watchlist-grid [data-id="${movieIdStr}"]`).forEach(btn => {
                updateWatchlistButton(movieIdStr, btn);
            });
        });

    } else {
        watchlistGrid.innerHTML = '<p class="text-center text-xl text-gray-300 col-span-full pt-10">Could not load details for items in your watchlist. Try refreshing. 😔</p>';
    }
}


// =================================================================
// 6. MAIN EXECUTION
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.movie-grid').forEach(grid => {
        grid.addEventListener('click', e => {
            const movieCard = e.target.closest('.movie-card');
            const isOverlayBtn = e.target.closest('.overlay-btn'); // ignore clicks on overlay buttons

            if (movieCard && !isOverlayBtn) {
                const movieId = movieCard.dataset.movieId;
                if (movieId) {
                    window.location.href = `movie-details.html?id=${movieId}`;
                }
            }
        });
    });
    // 1. Setup Core Components
    loadWatchlist();
    setupHamburgerMenu();
    setupVideoModal();

    // 2. Setup Event Listeners (delegated listeners listen globally regardless of active view)
    setupWatchlistListeners();
    handlePaginatorClicks();
    setupGenreFilterListeners();
    setupCategoryFilter();
    handleNavClick();

    // 3. Determine the initial view to show
    showView('home-view'); // Default to home view
});

const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get('id');

if (movieId) {
    init(movieId);
}

