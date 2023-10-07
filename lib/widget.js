'use strict';

const feed = require('./feed');

const Widget = module.exports;

let app;
Widget.init = function (_app) {
	app = _app;
};

Widget.defineWidgets = async function (widgets) {
	if (!app) {
		return widgets;
	}

	const widget = {
		widget: 'rss',
		name: 'RSS',
		description: 'RSS entries from a feed',
		content: 'admin/widget/rss',
	};

	const html = app.renderAsync(widget.content, {});
	widget.content = html;
	widgets.push(widget);

	return widgets;
};

Widget.render = async function (widget) {
	const entries = await feed.getItems(widget.data.feedUrl, widget.data.numItems || 4);
	const html = await app.renderAsync('widgets/rss', { entries });
	widget.html = html;
};

