/* globals Components, Services, APP_STARTUP, APP_SHUTDOWN */
Components.utils.import('resource://gre/modules/Services.jsm');

/* exported install, uninstall, startup, shutdown */
function install() {
}
function uninstall() {
}
function startup(params, reason) {
	if (reason == APP_STARTUP) {
		Services.obs.addObserver({
			observe: function() {
				Services.obs.removeObserver(this, 'browser-delayed-startup-finished');
				realStartup();
			}
		}, 'browser-delayed-startup-finished', false);
	} else {
		realStartup();
	}
}
function realStartup() {
	Services.prefs.setBoolPref('browser.enable_automatic_image_resizing', false);
	Services.prefs.setBoolPref('browser.enable_click_image_resizing', false);
	messageListener.init();
	observer.init();
}
function shutdown(params, reason) {
	if (reason == APP_SHUTDOWN) {
		return;
	}

	Services.prefs.clearUserPref('browser.enable_automatic_image_resizing');
	Services.prefs.clearUserPref('browser.enable_click_image_resizing');
	messageListener.destroy();
	observer.destroy();
}

var messageListener = {
	// Work around bug 1051238.
	_frameScriptURL: 'chrome://betterimageviewer/content/frame.js?' + Math.random(),
	_processScriptURL: 'chrome://betterimageviewer/content/process.js?' + Math.random(),
	_processmessages: [
		'BetterImageViewer:ZoomChanged'
	],
	init: function() {
		Services.mm.loadFrameScript(this._frameScriptURL, true);
		for (let m of this._processmessages) {
			Services.ppmm.addMessageListener(m, this);
		}
		Services.ppmm.loadProcessScript(this._processScriptURL, true);
	},
	destroy: function() {
		Services.mm.removeDelayedFrameScript(this._frameScriptURL);
		Services.ppmm.removeDelayedProcessScript(this._processScriptURL);
		Services.ppmm.broadcastAsyncMessage('BetterImageViewer:disable');
		for (let m of this._processmessages) {
			Services.ppmm.removeMessageListener(m, this);
		}
	},
	receiveMessage: function(message) {
		switch (message.name) {
		case 'BetterImageViewer:ZoomChanged':
			// Assume this message came from the most recent window.
			let recentWindow = Services.wm.getMostRecentWindow('navigator:browser');
			if (!recentWindow) {
				return;
			}
			let zoomResetButton = recentWindow.document.getElementById('zoom-reset-button');
			if (zoomResetButton) {
				zoomResetButton.setAttribute('label', Math.round(message.data.scale * 100) + '%');
			}
			let zoomButton = recentWindow.document.getElementById('urlbar-zoom-button');
			if (!zoomButton) {
				return;
			}

			if (zoomResetButton || message.data.scale == 1) {
				zoomButton.hidden = true;
			} else {
				zoomButton.setAttribute('label', Math.round(message.data.scale * 100) + '%');
				zoomButton.hidden = false;
			}
			break;
		}
	}
};

var observer = {
	_topic: 'browser-fullZoom:zoomReset',
	init: function() {
		Services.obs.addObserver(this, this._topic, false);
	},
	destroy: function() {
		Services.obs.removeObserver(this, this._topic, false);
	},
	observe: function(subject) {
		subject.messageManager.sendAsyncMessage('BetterImageViewer:ZoomReset');
	}
};
