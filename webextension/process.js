/* globals browser */
function BetterImageViewer(doc) {
	this._doc = doc;
	this._win = doc.defaultView;
	this._body = doc.body;

	this.init();
}
BetterImageViewer.FIT_NONE = 0;
BetterImageViewer.FIT_WIDTH = 1;
BetterImageViewer.FIT_HEIGHT = 2;
BetterImageViewer.FIT_BOTH = 3;
BetterImageViewer.prototype = {
	_doc: null,
	_win: null,
	_body: null,
	_currentZoom: null,
	_zoomedToFit: BetterImageViewer.FIT_BOTH,
	_lastMousePosition: null,
	_justScrolled: false,
	_title: null,
	init: function() {
		this._doc.addEventListener('error', this);

		this._link = this._doc.createElement('link');
		this._link.setAttribute('rel', 'stylesheet');
		this._link.setAttribute('href', browser.runtime.getURL('betterimageviewer.css'));
		this._doc.head.appendChild(this._link);

		this.image = this._body.firstElementChild;
		this.image.addEventListener('load', this);

		this._doc.addEventListener('click', this, true);
		this._doc.addEventListener('click', this);
		this._body.addEventListener('mousedown', this);
		this._win.addEventListener('mousemove', this);
		this._win.addEventListener('wheel', this);
		this._win.addEventListener('keypress', this);
		this._win.addEventListener('resize', this);
		this._win.addEventListener('scroll', this);

		let toolbar = this._doc.createElement('div');
		toolbar.id = 'toolbar';
		toolbar.appendChild(this._doc.createElement('div'));
		for (let tool of ['zoomIn', 'zoomOut', 'zoom1', 'zoomFit', 'zoomFitWidth', 'zoomFitHeight', 'donate']) {
			let button = this._doc.createElement('button');
			button.id = tool;
			toolbar.appendChild(button);
		}
		toolbar.insertBefore(this._doc.createElement('div'), toolbar.lastElementChild);
		this._body.appendChild(toolbar);

		let scrollbarX = document.createElement('div');
		scrollbarX.id = 'scrollbar-x';
		scrollbarX.appendChild(document.createElement('div'));
		this._body.appendChild(scrollbarX);

		let scrollbarY = document.createElement('div');
		scrollbarY.id = 'scrollbar-y';
		scrollbarY.appendChild(document.createElement('div'));
		this._body.appendChild(scrollbarY);

		this._scrollX = scrollbarX.firstElementChild;
		this._scrollY = scrollbarY.firstElementChild;
	},
	get zoom() {
		return this._currentZoom;
	},
	set zoom(z) {
		this.setIdle();

		this._currentZoom = z;
		this._zoomedToFit = BetterImageViewer.FIT_NONE;
		let scale = Math.pow(2, z / 4);
		this.image.width = scale * this.image.naturalWidth;
		this.image.height = scale * this.image.naturalHeight;

		this.image.classList.remove('shrinkToFit');
		this.image.classList.remove('overflowing');
		if (z > 0 || z === 0 && (this.image.naturalWidth > this._body.clientWidth || this.image.naturalHeight > this._body.clientHeight)) {
			this.image.classList.add('overflowing');
		} else if (z < 0) {
			this.image.classList.add('shrinkToFit');
		}
		if (this.image.height > this._body.clientHeight) {
			this.image.classList.add('overflowingVertical');
		} else {
			this.image.classList.remove('overflowingVertical');
		}

		// if (z == 0) {
		// 	document.title = this._title;
		// } else {
		// 	document.title = this._title + ' [' + Math.round(scale * 100) + '%]';
		// }

		this.setTitle();
	},
	zoomToFit: function(which = BetterImageViewer.FIT_BOTH) {
		if (!this.image.naturalWidth || !this.image.naturalHeight) {
			return;
		}
		let minZoomX = 0;
		if (which == BetterImageViewer.FIT_BOTH || which == BetterImageViewer.FIT_WIDTH) {
			minZoomX = (Math.log2(this._win.innerWidth) - Math.log2(this.image.naturalWidth)) * 4;
		}
		let minZoomY = 0;
		if (which == BetterImageViewer.FIT_BOTH || which == BetterImageViewer.FIT_HEIGHT) {
			minZoomY = (Math.log2(this._win.innerHeight) - Math.log2(this.image.naturalHeight)) * 4;
		}
		this.zoomCentered(Math.min(minZoomX, minZoomY, 0));
		this._zoomedToFit = which;
	},
	zoomCentered: function(z) {
		let { clientWidth, clientHeight } = this._doc.body;
		let bcr = this.image.getBoundingClientRect();
		let x = bcr.left <= 0 ? ((clientWidth / 2 - bcr.left) / bcr.width) : 0.5;
		let y = bcr.top <= 0 ? ((clientHeight / 2 - bcr.top) / bcr.height) : 0.5;
		this.zoom = z;
		bcr = this.image.getBoundingClientRect();
		this._body.scrollTo(x * bcr.width - clientWidth / 2, y * bcr.height - clientHeight / 2);
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
		if (!this._body.style.backgroundImage) {
			this._body.style.backgroundColor = '#e5e5e5';
			this._body.style.backgroundImage = 'url("chrome://global/skin/media/imagedoc-lightnoise.png")';
		} else {
			this._body.style.backgroundColor = null;
			this._body.style.backgroundImage = null;
		}
	},
	handleEvent: function(event) {
		if (this._currentZoom === null &&
				!!this.image.naturalWidth && !!this.image.naturalHeight) {
			// At load, this is not set, but we're zoomed to fit.
			let minZoomX = (Math.log2(this._win.innerWidth) - Math.log2(this.image.naturalWidth)) * 4;
			let minZoomY = (Math.log2(this._win.innerHeight) - Math.log2(this.image.naturalHeight)) * 4;
			this._currentZoom = Math.min(minZoomX, minZoomY, 0);
		}

		switch (event.type) {
		case 'load':
			this.setTitle();
			break;
		case 'error':
			console.error(event);
			break;
		case 'click':
			if (event.eventPhase == Event.CAPTURING_PHASE) {
				let bcr = this.image.getBoundingClientRect();
				let x = (event.clientX - bcr.left) / bcr.width;
				let y = (event.clientY - bcr.top) / bcr.height;
				this._clickData = { x, y };
				return;
			}

			// Undo click listener.
			this.zoom = this._currentZoom;
			this._body.scrollTo(this._lastScrollLeft, this._lastScrollTop);

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
					this.zoomToFit(BetterImageViewer.FIT_WIDTH);
					return;
				case 'zoomFitHeight':
					this.zoomToFit(BetterImageViewer.FIT_HEIGHT);
					return;
				case 'donate':
					this._win.open('https://darktrojan.github.io/donate.html?betterimageviewer');
					return;
				}
			} else if (event.target == this._scrollX.parentNode) {
				if (event.clientX < this._scrollX.offsetLeft) {
					this._body.scrollBy(-this._win.innerWidth, 0);
				} else {
					this._body.scrollBy(this._win.innerWidth, 0);
				}
				return;
			} else if (event.target == this._scrollY.parentNode) {
				if (event.clientY < this._scrollY.offsetTop) {
					this._body.scrollBy(0, -this._win.innerHeight);
				} else {
					this._body.scrollBy(0, this._win.innerHeight);
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
			} else if (event.deltaY < 0) {
				this.zoom = this.currentZoomPlus1;
			} else {
				this.zoom = this.currentZoomMinus1;
			}

			bcr = this.image.getBoundingClientRect();
			this._body.scrollTo(bcr.width * x - event.clientX, bcr.height * y - event.clientY);

			event.preventDefault();
			break;
		case 'mousedown':
			if (!event.shiftKey) {
				this._lastMousePosition = { x: event.clientX, y: event.clientY };
				this._scrolling = event.target;
				this._win.addEventListener('mouseup', this);
				event.preventDefault();
			}
			break;
		case 'mousemove':
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
				this._body.scrollBy(-dX * this.image.width / this._win.innerWidth, 0);
			} else if (this._scrolling == this._scrollY) {
				this._body.scrollBy(0, -dY * this.image.height / this._win.innerHeight);
			} else {
				this._body.scrollBy(dX, dY);
			}
			this._lastMousePosition = { x: event.clientX, y: event.clientY };
			this._justScrolled = true;
			event.preventDefault();
			break;
		case 'mouseup':
			this._lastMousePosition = null;
			this._scrolling = null;
			this._win.removeEventListener('mouseup', this);
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
		case 'resize':
			event.preventDefault();
			event.stopPropagation();
			if (this._zoomedToFit) {
				this.zoomToFit(this._zoomedToFit);
			} else {
				this.zoom = 0;
				this._body.scrollTo(this._lastScrollLeft, this._lastScrollTop);
			}
			break;
		case 'scroll':
			this._lastScrollLeft = this._body.scrollLeft;
			this._lastScrollTop = this._body.scrollTop;

			let { width, height } = this.image;
			let { innerWidth, innerHeight } = this._win;

			if (width > innerWidth) {
				this._body.dataset.overflow = height > innerHeight ? 'both' : 'x';
			} else if (height > innerHeight) {
				this._body.dataset.overflow = 'y';
			} else {
				delete this._body.dataset.overflow;
			}

			this._scrollX.style.width = (innerWidth / width * 100) + '%';
			this._scrollX.style.left = (this._lastScrollLeft / width * 100) + '%';
			this._scrollY.style.height = (innerHeight / height * 100) + '%';
			this._scrollY.style.top = (this._lastScrollTop / height * 100) + '%';
			break;
		}
	},
	setTitle: function() {
		this._title = document.title = document.title.replace(/ - [^()]+ \(\d+%\)$/, '');
	},
	setIdle: function() {
		if (this._idleTimeout) {
			this._win.clearTimeout(this._idleTimeout);
		}

		delete this._body.dataset.idle;
		this._idleTimeout = this._win.setTimeout(() => {
			this._body.dataset.idle = true;
		}, 1500);
	}
};

if (document.toString() == '[object ImageDocument]') {
	new BetterImageViewer(document);
}
