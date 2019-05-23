'use strict';

/**
 * @module @10up/LoadMore
 *
 * @description
 *
 * Create a Load More UI.
 *
 * @param {string} element Element selector for posts container.
 * @param {Object} options Object of optional callbacks.
 */
export default class LoadMore {

	/**
	 * constructor function
	 * @param element Ojbect
	 * @param options Ojbect
	 */
	constructor( element, options = {} ) {

		/**
		 * Default options.
		 */
		const defaults = {
			onCreate: null,
			onFetch: null,
			onAppend: null,
			onFail: null,
			infiniteScroll: false,
			loadMoreClass: 'load-more',
			singlePostClass: 'post single',
			baseUrl: 'http://demo.wp-api.org/wp-json/wp/v2/posts', // WP REST API endpoint URL to hit for post query results.

			/**
			 * Arguments to pass for WP REST API /posts request.
			 */
			fetchOptions: {},

			/**
			 * Arguments to pass for WP query.
			 */
			queryArgs: {
				'per_page': 10,
				'offset': 0,
				'_embed': true
			},
		};

		if ( ! element || 'string' !== typeof element ) {
			console.error( '10up Load More: No container target supplied. A valid container target must be used.' ); // eslint-disable-line
			return;
		}

		this.$loadMoreContainer = document.querySelector( element );

		if ( ! this.$loadMoreContainer ) {
			console.error( '10up Load More: Container target not found. A valid container target must be used.' ); // eslint-disable-line
			return;
		}

		this.element = element;
		document.documentElement.classList.add( 'js' );

		/**
		 * Apply settings.
		 */
		this.settings = Object.assign( {}, defaults, options );
		this.setupLoadMore( this.$loadMoreContainer );

		/**
		 * Called after the Load More area is initialized on page load.
		 * @callback onCreate
		 */
		if ( this.settings.onCreate && 'function' === typeof this.settings.onCreate ) {
			this.settings.onCreate.call();
		}
	}

	/**
	 * Initialize a given Load More area.
	 * Configure properties and set ARIA attributes.
	 *
	 * @param   {element} loadMoreArea      The loadMoreArea to scope changes.
	 * @param   {number}  loadMoreAreaIndex The index of the loadMoreArea.
	 * @returns {null}
	 */
	setupLoadMore( loadMoreArea ) {
		const trigger = loadMoreArea.querySelector( '.' + this.settings.loadMoreClass.replace( ' ', '.' ) );

		if ( trigger ) {
			trigger.addEventListener( 'click', this.fetchMorePosts.bind( this ) );
		} else {
			console.error( '10up Load More: Load more button trigger element not found. Each load more container must contain a valid trigger element.' ); // eslint-disable-line
		}
	}

	/**
	 * Fetch more posts using the WP REST API /posts endpoint.
	 *
	 * @param  {Object} event The click event for the "load more" button.
	 * @return {null}
	 */
	fetchMorePosts( event ) {
		const button = event.currentTarget;
		const params = this.settings.queryArgs;
		const xhr = new XMLHttpRequest();

		let url = this.settings.baseUrl;

		/**
		 * Append query params.
		 */
		Object.keys( params ).forEach( ( key, index ) => {
			url += ( 0 === index ? '?' : '&' ) + encodeURIComponent( key ) + ( true === params[key] ? '' : '=' + encodeURIComponent( params[key] ) );
		} );

		/**
		 * Set class name of button while loading.
		 */
		button.classList.add( 'loading' );

		/**
		 * Request handler.
		 */
		xhr.onreadystatechange = () => {

			/**
			 * Only run once request is complete.
			 */
			if ( 4 !== xhr.readyState ) {
				return;
			}

			/**
			 * Remove "loading" class name of button after response is fetched.
			 */
			button.classList.remove( 'loading' );

			/**
			 * Run on successful request.
			 */
			if ( 200 <= xhr.status && 300 > xhr.status ) {
				const posts = this.renderPosts( JSON.parse( xhr.response ) );

				/**
				 * Update offset param for next query.
				 */
				this.settings.queryArgs.offset += this.settings.queryArgs.per_page;

				/**
				 * Update total posts count.
				 */
				this.settings.total = xhr.getResponseHeader( 'x-wp-total' ) || 0;

				if ( posts ) {

					/**
					 * Called just before the fetched posts HTML is appended to the DOM.
					 * @callback onAppend
					 */
					if ( this.settings.onAppend && 'function' === typeof this.settings.onAppend ) {
						this.settings.onAppend.call();
					}

					/**
					 * Append posts fragment to DOM.
					 */
					button.parentElement.insertBefore( posts, button );

					/**
					 * Remove Load More button if there are no more posts to fetch.
					 */
					if ( this.settings.queryArgs.offset >= this.settings.total ) {
						button.parentElement.removeChild( button );
					}
				}
			} else {
				const error = JSON.parse( xhr.responseText );

				console.error( error.message );

				/**
				 * Called if the fetch API request fails.
				 * @callback onFail
				 */
				if ( this.settings.onFail && 'function' === typeof this.settings.onFail ) {
					this.settings.onFail.call();
				}
			}
		};

		/**
		 * Called just before the fetch API request is sent.
		 * @callback onFetch
		 */
		if ( this.settings.onFetch && 'function' === typeof this.settings.onFetch ) {
			this.settings.onFetch.call();
		}

		xhr.open( 'GET', url );
		xhr.send();
	}

	/**
	 * Append post elements given an array of WP post query results.
	 *
	 * @param  {array} posts Array of post objects from WP query.
	 * @return {null}
	 */
	renderPosts( posts ) {
		if ( ! Array.isArray( posts ) ) {
			console.error( '10up Load More: Expected an array of posts.' );
			return;
		}

		const fragment = document.createDocumentFragment();
		const div = document.createElement( 'div' );

		let html = '';

		div.setAttribute( 'class', 'appended-posts' );

		posts.forEach( post => {
			html += this.createSinglePostHtml( post );
		} );

		/**
		 * TODO: Make sure to sanitize HTML string before appending to document.
		 */
		div.innerHTML = html;

		fragment.appendChild( div );

		return fragment;
	}

	createSinglePostHtml( post ) {
		const featuredImage = this.getNestedProperty( post, [ '_embedded', 'wp:featuredmedia', 0, 'media_details', 'sizes', 'thumbnail' ] );
		const publishDate = Date.toLocaleString ? new Date( post.date ).toLocaleDateString( 'en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		} ) : new Date( post.date );
		const authors = this.getNestedProperty( post, [ '_embedded', 'author' ] );
		const excerpt = this.getNestedProperty( post, [ 'excerpt', 'rendered' ] );

		let html = `
			<article id="post-${ post.id }" class="${ this.settings.singlePostClass }" itemscope itemtype="http://schema.org/BlogPosting">
		`;

		if ( featuredImage ) {
			html += `
				<div itemprop="image" itemscope itemtype="http://schema.org/ImageObject">
					<img src="${ featuredImage.source_url }" alt="${ post.title.rendered }" />
					<meta itemprop="url" content="${ featuredImage.source_url }" />
					<meta itemprop="width" content="${ featuredImage.width }" />
					<meta itemprop="height" content="${ featuredImage.height }" />
				</div>
			`;
		}

		html += `
			<header>
				<h2 itemprop="headline">
					<a href="${ post.link }" itemprop="url">${ post.title.rendered }</a>
				</h2>

				<p><strong>Publish Date</strong>:
				<span itemprop="datePublished">
					<time datetime="${ post.date }">${ publishDate }</time>
				</span>
				</p>
		`;

		if ( authors && Array.isArray( authors ) ) {
			let authorNames = authors.map( author => author.name );

			html += `
				<p><strong>Author</strong>:
					<span itemprop="author">${ authorNames.join( ',' ) }</span>
				</p>
			`;
		}

		html += '</header>';

		if ( excerpt ) {
			html += `
				<div itemprop="description">
					${ excerpt }
					<a href="${ post.link }" itemprop="url">Read More... <span class="screen-reader-text">${ post.title.rendered }</span></a>
				</div>
			`;
		}

		html += '</article>';

		return html;
	}

	getNestedProperty( nestedObj, pathArr ) {
		return pathArr.reduce( ( obj, key ) =>
			( obj && 'undefined' !== obj[key] ) ? obj[key] : undefined, nestedObj );
	}
}