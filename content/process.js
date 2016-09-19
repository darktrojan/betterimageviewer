/* globals Components, Services, XPCOMUtils, addMessageListener, removeMessageListener */
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

/* globals scrollbarStylesheet */
XPCOMUtils.defineLazyGetter(this, 'scrollbarStylesheet', function() {
	return Services.io.newURI('chrome://devtools/skin/floating-scrollbars-responsive-design.css', null, null);
});

let viewers = new Set();

let listener = {
	_messages: [
		'BetterImageViewer:disable'
	],
	_notifications: [
		'content-document-global-created'
	],
	init: function() {
		for (let m of this._messages) {
			addMessageListener(m, this);
		}
		for (let n of this._notifications) {
			Services.obs.addObserver(this, n, false);
		}
	},
	destroy: function() {
		for (let m of this._messages) {
			removeMessageListener(m, this);
		}
		for (let n of this._notifications) {
			Services.obs.removeObserver(this, n, false);
		}
		for (let v of viewers) {
			v.destroy();
		}
	},
	receiveMessage: function(message) {
		switch (message.name) {
		case 'BetterImageViewer:disable':
			this.destroy();
			break;
		}
	},
	observe: function(subject) {
		let doc = subject.document;
		if (doc instanceof Components.interfaces.nsIImageDocument) {
			viewers.add(new BetterImageViewer(doc));
		}
	}
};
listener.init();

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
	_currentZoom: 0,
	_zoomedToFit: BetterImageViewer.FIT_NONE,
	_lastMousePosition: null,
	_justScrolled: false,
	init: function() {
		this._win.addEventListener('unload', this);
		this._doc.addEventListener('error', this);

		this._link = this._doc.createElement('link');
		this._link.setAttribute('rel', 'stylesheet');
		this._link.setAttribute('href', 'chrome://betterimageviewer/content/betterimageviewer.css');
		this._doc.head.appendChild(this._link);

		this.image = this._body.firstElementChild;

		let self = this;
		let observer = {
			sizeAvailable: function sizeAvailable() {
				self._win.setTimeout(function() {
					self.zoomToFit();
				}, 0);
			},
			frameComplete: function frameComplete() {},
			decodeComplete: function decodeComplete() {},
			loadComplete: function loadComplete() {
				self.image.removeObserver(scriptedObserver);
			},
			frameUpdate: function frameUpdate() {},
			discard: function discard() {},
			isAnimated: function isAnimated() {}
		};
		let scriptedObserver = Components.classes['@mozilla.org/image/tools;1']
			.getService(Components.interfaces.imgITools)
			.createScriptedObserver(observer);
		this.image.addObserver(scriptedObserver);

		this.image.addEventListener('click', this);
		this._body.addEventListener('mousedown', this);
		this._win.addEventListener('wheel', this);
		this._win.addEventListener('keypress', this);
		this._win.addEventListener('resize', this);

		let winUtils = this._win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIDOMWindowUtils);
		winUtils.loadSheet(scrollbarStylesheet, winUtils.AGENT_SHEET);

		let toolbar = this._doc.createElement('div');
		toolbar.id = 'toolbar';
		for (let tool of ['zoomIn', 'zoomOut', 'zoom1', 'zoomFit', 'zoomFitWidth', 'zoomFitHeight']) {
			let button = this._doc.createElement('button');
			button.id = tool;
			toolbar.appendChild(button);
		}
		this._body.appendChild(toolbar);
		toolbar.addEventListener('click', this);
	},
	destroy: function() {
		this._win.location.reload();
	},
	get zoom() {
		return this._currentZoom;
	},
	set zoom(z) {
		this._currentZoom = z;
		this._zoomedToFit = BetterImageViewer.FIT_NONE;
		this.image.width = Math.pow(2, z / 4) * this.image.naturalWidth;
		this.image.height = Math.pow(2, z / 4) * this.image.naturalHeight;

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
		if (fractional == 0) {
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
		if (fractional == 0) {
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
		switch (event.type) {
		case 'unload':
			viewers.delete(this);
			break;
		case 'error':
			Components.utils.reportError(event);
			break;
		case 'click':
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
				}
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
				this._win.addEventListener('mousemove', this);
				this._win.addEventListener('mouseup', this);
				event.preventDefault();
			}
			break;
		case 'mousemove':
			let dX = this._lastMousePosition.x - event.clientX;
			let dY = this._lastMousePosition.y - event.clientY;
			if ((dX * dX + dY * dY) < 25) {
				return;
			}
			this._body.scrollBy(dX, dY);
			this._lastMousePosition = { x: event.clientX, y: event.clientY };
			this._justScrolled = true;
			event.preventDefault();
			break;
		case 'mouseup':
			this._lastMousePosition = null;
			this._win.removeEventListener('mousemove', this);
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
				this.zoomToFit();
				event.preventDefault();
				break;
			}
			break;
		case 'resize':
			if (this._zoomedToFit) {
				this.zoomToFit(this._zoomedToFit);
			}
			break;
		}
	}
};
