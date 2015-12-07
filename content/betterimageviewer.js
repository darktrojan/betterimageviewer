let BetterImageViewer = {
	_currentZoom: 0,
	_lastMousePosition: null,
	_justScrolled: false,
	init: function() {
		this.image = document.body.firstElementChild;
		this.image.style.backgroundColor = 'transparent';
		this.image.style.backgroundImage = 'none';

		this.image.addEventListener('load', this);
		this.image.addEventListener('click', this);
		addEventListener('mousedown', this);
		addEventListener('wheel', this);
	},
	get zoom() {
		return this._currentZoom;
	},
	set zoom(z) {
		this._currentZoom = z;
		this.image.width = Math.pow(2, z / 4) * this.image.naturalWidth;
		this.image.height = Math.pow(2, z / 4) * this.image.naturalHeight;

		this.image.classList.remove('shrinkToFit');
		this.image.classList.remove('overflowing');
		if (z > 0 || z === 0 && (this.image.naturalWidth > document.body.clientWidth || this.image.naturalHeight > document.body.clientHeight)) {
			this.image.classList.add('overflowing');
		} else if (z < 0) {
			this.image.classList.add('shrinkToFit');
		}
	},
	zoomToFit: function() {
		document.body.style.overflow = 'hidden';
		let minZoomX = Math.floor((Math.log2(document.body.clientWidth) - Math.log2(this.image.naturalWidth)) * 4);
		let minZoomY = Math.floor((Math.log2(document.body.clientHeight) - Math.log2(this.image.naturalHeight)) * 4);
		this.zoom = Math.min(minZoomX, minZoomY, 0);
		document.body.style.overflow = null;
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
		switch (event.type) {
		case 'load':
			this.zoomToFit();
			break;
		case 'click':
			if (!!this._justScrolled) {
				this._justScrolled = false;
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
			} else if (event.deltaY < 0) {
				this.zoom++;
			} else {
				this.zoom--;
			}

			bcr = this.image.getBoundingClientRect();
			document.body.scrollTo(bcr.width * x - event.clientX, bcr.height * y - event.clientY);

			event.preventDefault();
			break;
		case 'mousedown':
			this._lastMousePosition = { x: event.clientX, y: event.clientY };
			addEventListener('mousemove', this);
			addEventListener('mouseup', this);
			event.preventDefault();
			break;
		case 'mousemove':
			let dX = this._lastMousePosition.x - event.clientX;
			let dY = this._lastMousePosition.y - event.clientY;
			if ((dX * dX + dY * dY) < 25) {
				return;
			}
			document.body.scrollBy(dX, dY);
			this._lastMousePosition = { x: event.clientX, y: event.clientY };
			this._justScrolled = true;
			event.preventDefault();
			break;
		case 'mouseup':
			this._lastMousePosition = null;
			removeEventListener('mousemove', this);
			removeEventListener('mouseup', this);
			break;
		}
	}
};
BetterImageViewer.init();
