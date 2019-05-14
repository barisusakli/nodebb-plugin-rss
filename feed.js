'use strict';

var Parser = require('rss-parser');

var feed = module.exports;

feed.getItems = function (feedUrl, entriesToPull, callback) {
	entriesToPull = parseInt(entriesToPull, 10) || 4;
	feedUrl = feedUrl + '?t=' + Date.now();

	const parser = new Parser();
	parser.parseURL(feedUrl, function (err, feed) {
		if (err) {
			return callback(err);
		}
		feed.items = feed.items.slice(0, entriesToPull);
		feed.items = feed.items.map(function (item) {
			return {
				title: item.title,
				content: { content: item.content },
				published: item.pubDate,
				link: { href: item.link },
				id: item.guid,
				tags: item.categories,
			};
		});
		callback(null, feed.items);
	});
};
