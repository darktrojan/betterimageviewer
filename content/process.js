/* globals Components, Services, addMessageListener, removeMessageListener */
Components.utils.import('resource://gre/modules/Services.jsm');

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
		if (doc.toString() != '[object ImageDocument]') {
			return;
		}

		let l = doc.createElement('link');
		l.setAttribute('rel', 'stylesheet');
		l.setAttribute('href', 'chrome://betterimageviewer/content/betterimageviewer.css');
		doc.head.appendChild(l);

		let s = doc.createElement('script');
		s.setAttribute('src', 'chrome://betterimageviewer/content/betterimageviewer.js');
		s.setAttribute('type', 'application/javascript;version=1.8');
		doc.body.appendChild(s);
	}
};
listener.init();
