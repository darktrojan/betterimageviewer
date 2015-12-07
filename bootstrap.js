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
}
function shutdown(params, reason) {
	if (reason == APP_SHUTDOWN) {
		return;
	}

	Services.prefs.clearUserPref('browser.enable_automatic_image_resizing');
	Services.prefs.clearUserPref('browser.enable_click_image_resizing');
	messageListener.destroy();
}

var messageListener = {
	// Work around bug 1051238.
	_processScriptURL: 'chrome://betterimageviewer/content/process.js?' + Math.random(),
	init: function() {
		Services.ppmm.loadProcessScript(this._processScriptURL, true);
	},
	destroy: function() {
		Services.ppmm.removeDelayedProcessScript(this._processScriptURL);
		Services.ppmm.broadcastAsyncMessage('BetterImageViewer:disable');
	}
};
