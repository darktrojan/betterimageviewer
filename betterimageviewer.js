/* globals chrome */
if (document.toString() == '[object ImageDocument]') {
	const FIT_NONE = 0;
	const FIT_WIDTH = 1;
	const FIT_HEIGHT = 2;
	const FIT_BOTH = 3;
	let BetterImageViewer = {
		_currentZoom: null,
		_zoomedToFit: FIT_BOTH,
		_lastMousePosition: null,
		_lastWheel: 0,
		_justScrolled: false,
		_title: null,
		init: function() {
			document.addEventListener('error', this);

			let link = document.createElement('link');
			link.setAttribute('rel', 'stylesheet');
			link.setAttribute('href', chrome.runtime.getURL('betterimageviewer.css'));
			document.head.appendChild(link);

			this.image = document.body.firstElementChild;
			if (this.image.complete) {
				this.setTitle();
				this.zoomToFit();
			} else {
				this.image.addEventListener('load', this);
			}

			document.addEventListener('click', this, true);
			document.addEventListener('click', this);
			document.body.addEventListener('mousedown', this);
			window.addEventListener('mousemove', this);
			window.addEventListener('wheel', this);
			window.addEventListener('keypress', this);
			window.addEventListener('keydown', this);
			window.addEventListener('resize', this);
			window.addEventListener('scroll', this);

			let toolbar = document.createElement('div');
			toolbar.id = 'toolbar';
			toolbar.appendChild(document.createElement('div'));
			for (let tool of ['zoomIn', 'zoomOut', 'zoom1', 'zoomFit', 'zoomFitWidth', 'zoomFitHeight', 'donate']) {
				let button = document.createElement('button');
				button.id = tool;
				toolbar.appendChild(button);
			}
			toolbar.insertBefore(document.createElement('div'), toolbar.lastElementChild);
			document.body.appendChild(toolbar);

			let scrollbarX = document.createElement('div');
			scrollbarX.id = 'scrollbar-x';
			scrollbarX.appendChild(document.createElement('div'));
			document.body.appendChild(scrollbarX);

			let scrollbarY = document.createElement('div');
			scrollbarY.id = 'scrollbar-y';
			scrollbarY.appendChild(document.createElement('div'));
			document.body.appendChild(scrollbarY);

			this._scrollX = scrollbarX.firstElementChild;
			this._scrollY = scrollbarY.firstElementChild;
		},
		get zoom() {
			return this._currentZoom;
		},
		set zoom(z) {
			delete document.documentElement.dataset.scrolling;
			this.setIdle();

			this._currentZoom = z;
			this._zoomedToFit = FIT_NONE;
			let scale = Math.pow(2, z / 4);
			this.image.width = scale * this.image.naturalWidth;
			this.image.height = scale * this.image.naturalHeight;

			this.image.classList.remove('shrinkToFit');
			this.image.classList.remove('overflowing');
			if (z > 0 || z === 0 && (this.image.naturalWidth > document.body.clientWidth || this.image.naturalHeight > document.body.clientHeight)) {
				this.image.classList.add('overflowing');
			} else if (z < 0) {
				this.image.classList.add('shrinkToFit');
			}
			if (this.image.height > document.body.clientHeight) {
				this.image.classList.add('overflowingVertical');
			} else {
				this.image.classList.remove('overflowingVertical');
			}

			this.setTitle();
		},
		zoomToFit: function(which = FIT_BOTH) {
			if (!this.image.naturalWidth || !this.image.naturalHeight) {
				return;
			}
			let minZoomX = 0;
			if (which == FIT_BOTH || which == FIT_WIDTH) {
				minZoomX = (Math.log2(window.innerWidth) - Math.log2(this.image.naturalWidth)) * 4;
			}
			let minZoomY = 0;
			if (which == FIT_BOTH || which == FIT_HEIGHT) {
				minZoomY = (Math.log2(window.innerHeight) - Math.log2(this.image.naturalHeight)) * 4;
			}
			this.zoomCentered(Math.min(minZoomX, minZoomY, 0));
			this._zoomedToFit = which;
		},
		zoomCentered: function(z) {
			let { clientWidth, clientHeight } = document.body;
			let bcr = this.image.getBoundingClientRect();
			let x = bcr.left <= 0 ? ((clientWidth / 2 - bcr.left) / bcr.width) : 0.5;
			let y = bcr.top <= 0 ? ((clientHeight / 2 - bcr.top) / bcr.height) : 0.5;
			this.zoom = z;
			bcr = this.image.getBoundingClientRect();
			window.scrollTo(x * bcr.width - clientWidth / 2, y * bcr.height - clientHeight / 2);
		},
		get currentZoomPlus1() {
			let fractional = this.zoom % 1;
			if (fractional === 0) {
				return this.zoom + 1;
			}

			// Skip the nearest zoom level if we are close to it.
			let whole = Math.ceil(this.zoom);
			if (fractional > -0.15) {
				whole++;
			}
			return whole;
		},
		get currentZoomMinus1() {
			let fractional = this.zoom % 1;
			if (fractional === 0) {
				return this.zoom - 1;
			}

			// Skip the nearest zoom level if we are close to it.
			let whole = Math.floor(this.zoom);
			if (fractional < -0.85) {
				whole--;
			}
			return whole;
		},
		toggleBackground: function() {
			if (!document.body.style.backgroundImage) {
				document.body.style.backgroundColor = '#e5e5e5';
				document.body.style.backgroundImage = 'url("chrome://global/skin/media/imagedoc-lightnoise.png")';
			} else {
				document.body.style.backgroundColor = null;
				document.body.style.backgroundImage = null;
			}
		},
		handleEvent: function(event) {
			if (this._currentZoom === null &&
					!!this.image.naturalWidth && !!this.image.naturalHeight) {
				// At load, this is not set, but we're zoomed to fit.
				let minZoomX = (Math.log2(window.innerWidth) - Math.log2(this.image.naturalWidth)) * 4;
				let minZoomY = (Math.log2(window.innerHeight) - Math.log2(this.image.naturalHeight)) * 4;
				this._currentZoom = Math.min(minZoomX, minZoomY, 0);
			}

			switch (event.type) {
			case 'load':
				this.setTitle();
				this.zoomToFit();
				break;
			case 'error':
				console.error(event);
				break;
			case 'click':
				if (event.button !== 0) {
					return;
				}

				if (event.eventPhase == Event.CAPTURING_PHASE) {
					let bcr = this.image.getBoundingClientRect();
					let x = (event.clientX - bcr.left) / bcr.width;
					let y = (event.clientY - bcr.top) / bcr.height;
					this._clickData = { x, y };
					return;
				}

				// Undo click listener.
				this.zoom = this._currentZoom;
				window.scrollTo(this._lastScrollLeft * -1, this._lastScrollTop * -1);

				if (!!this._justScrolled) {
					this._justScrolled = false;
					return;
				}

				if (event.target.localName == 'button') {
					switch (event.target.id) {
					case 'zoomIn':
						this.zoomCentered(this.currentZoomPlus1);
						return;
					case 'zoomOut':
						this.zoomCentered(this.currentZoomMinus1);
						return;
					case 'zoom1':
						this.zoomCentered(0);
						return;
					case 'zoomFit':
						this.zoomToFit();
						return;
					case 'zoomFitWidth':
						this.zoomToFit(FIT_WIDTH);
						return;
					case 'zoomFitHeight':
						this.zoomToFit(FIT_HEIGHT);
						return;
					case 'donate':
						window.open('https://darktrojan.github.io/donate.html?betterimageviewer');
						return;
					}
				} else if (event.target == this._scrollX.parentNode) {
					if (event.clientX < this._scrollX.offsetLeft) {
						window.scrollBy(-window.innerWidth, 0);
					} else {
						window.scrollBy(window.innerWidth, 0);
					}
					return;
				} else if (event.target == this._scrollY.parentNode) {
					if (event.clientY < this._scrollY.offsetTop) {
						window.scrollBy(0, -window.innerHeight);
					} else {
						window.scrollBy(0, window.innerHeight);
					}
					return;
				} else if (event.target == this._scrollX || event.target == this._scrollY) {
					return;
				}

				if (this.zoom === 0) {
					this.zoomToFit();
					return;
				}
				/* falls through */
			case 'wheel':
				let bcr = this.image.getBoundingClientRect();
				let x = (event.clientX - bcr.left) / bcr.width;
				let y = (event.clientY - bcr.top) / bcr.height;

				if (event.type == 'click') {
					this.zoom = 0;
					x = this._clickData.x;
					y = this._clickData.y;
					delete this._clickData;
				} else {
					if (event.timeStamp - this._lastWheel < 50) {
						return;
					}
					this._lastWheel = event.timeStamp;
					if (event.deltaY < 0) {
						this.zoom = this.currentZoomPlus1;
					} else {
						this.zoom = this.currentZoomMinus1;
					}
				}

				bcr = this.image.getBoundingClientRect();
				window.scrollTo(bcr.width * x - event.clientX, bcr.height * y - event.clientY);

				event.preventDefault();
				break;
			case 'mousedown':
				if (event.button === 0 && !event.shiftKey) {
					this._lastMousePosition = { x: event.clientX, y: event.clientY };
					this._scrolling = event.target;
					window.addEventListener('mouseup', this);
					event.preventDefault();
				}
				break;
			case 'mousemove':
				if (event.button !== 0) {
					return;
				}

				this.setIdle();

				if (!this._scrolling) {
					return;
				}

				let dX = this._lastMousePosition.x - event.clientX;
				let dY = this._lastMousePosition.y - event.clientY;
				if (Math.hypot(dX, dY) < 5) {
					return;
				}
				if (this._scrolling == this._scrollX) {
					window.scrollBy(-dX * this.image.width / window.innerWidth, 0);
				} else if (this._scrolling == this._scrollY) {
					window.scrollBy(0, -dY * this.image.height / window.innerHeight);
				} else {
					window.scrollBy(dX, dY);
				}

				this._lastMousePosition = { x: event.clientX, y: event.clientY };
				this._justScrolled = true;
				event.preventDefault();
				break;
			case 'mouseup':
				this._lastMousePosition = null;
				this._scrolling = null;
				window.removeEventListener('mouseup', this);
				break;
			case 'keypress':
				switch (event.code) {
				case 'Minus':
				case 'NumpadSubtract':
					this.zoomCentered(this.currentZoomMinus1);
					event.preventDefault();
					break;
				case 'Equal':
				case 'NumpadAdd':
					this.zoomCentered(this.currentZoomPlus1);
					event.preventDefault();
					break;
				case 'Digit0':
				case 'Numpad0':
					this.zoomToFit();
					event.preventDefault();
					break;
				case 'Digit1':
				case 'Numpad1':
					this.zoomCentered(0);
					event.preventDefault();
					break;
				}
				break;
			case 'keydown':
				switch (event.code) {
				case 'ArrowUp':
					document.documentElement.dataset.scrolling = true;
					window.scrollBy(0, -100);
					break;
				case 'ArrowDown':
					document.documentElement.dataset.scrolling = true;
					window.scrollBy(0, 100);
					break;
				case 'ArrowLeft':
					document.documentElement.dataset.scrolling = true;
					window.scrollBy(-100, 0);
					break;
				case 'ArrowRight':
					document.documentElement.dataset.scrolling = true;
					window.scrollBy(100, 0);
					break;
				case 'PageUp':
					document.documentElement.dataset.scrolling = true;
					window.scrollBy(0, 0 - window.innerHeight);
					break;
				case 'PageDown':
					document.documentElement.dataset.scrolling = true;
					window.scrollBy(0, window.innerHeight);
					break;
				}
				break;
			case 'resize':
				event.preventDefault();
				event.stopPropagation();
				if (this._zoomedToFit) {
					this.zoomToFit(this._zoomedToFit);
				} else {
					this.zoomCentered(this.zoom);
					this.setScrollbars();
				}
				break;
			case 'scroll': {
				const bcr = document.body.getBoundingClientRect()
				this._lastScrollLeft = bcr.left;
				this._lastScrollTop = bcr.top;
				this.setScrollbars();
				break;
			}
			}
		},
		setTitle: function() {
			this._title = document.title = document.title.replace(/ - [^()]+ \(\d+%\)$/, '');
		},
		setScrollbars: function() {
			let { width, height } = this.image;
			let { innerWidth, innerHeight } = window;

			if (width > innerWidth) {
				document.body.dataset.overflow = height > innerHeight ? 'both' : 'x';
			} else if (height > innerHeight) {
				document.body.dataset.overflow = 'y';
			} else {
				delete document.body.dataset.overflow;
			}

			this._scrollX.style.width = (innerWidth / width * 100) + '%';
			this._scrollX.style.left = (this._lastScrollLeft * -1 / width * 100) + '%';
			this._scrollY.style.height = (innerHeight / height * 100) + '%';
			this._scrollY.style.top = (this._lastScrollTop * -1 / height * 100) + '%';
		},
		setIdle: function() {
			if (this._idleTimeout) {
				window.clearTimeout(this._idleTimeout);
			}

			delete document.body.dataset.idle;
			this._idleTimeout = window.setTimeout(() => {
				document.body.dataset.idle = true;
			}, 1500);
		}
	};

	BetterImageViewer.init();
}
