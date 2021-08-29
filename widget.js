'use strict';

const Widget = module.exports;

const feed = require('./feed');

let app;
Widget.init = function (_app) {
	app = _app;
};

Widget.defineWidgets = function (widgets, callback) {
	const widget = {
		widget: 'rss',
		name: 'RSS',
		description: 'RSS entries from a feed',
		content: 'admin/widget/rss',
	};
	if (!app) {
		return setImmediate(callback, null, widgets);
	}

	app.render(widget.content, {}, (err, html) => {
		if (err) {
			return callback(err);
		}
		widget.content = html;
		widgets.push(widget);
		callback(null, widgets);
	});
};

Widget.render = async function (widget, callback) {
	const entries = await feed.getItems(widget.data.feedUrl, widget.data.numItems || 4);

	app.render('widgets/rss', { entries: entries }, (err, html) => {
		if (err) {
			return callback(err);
		}
		widget.html = html;
		callback(null, widget);
	});
};
