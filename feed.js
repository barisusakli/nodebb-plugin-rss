'use strict';

const Parser = require('rss-parser');

const feed = module.exports;

feed.getItems = async function (feedUrl, entriesToPull) {
	entriesToPull = parseInt(entriesToPull, 10) || 4;
	feedUrl = `${feedUrl}?t=${Date.now()}`;

	const parser = new Parser();
	const feed = await parser.parseURL(feedUrl);

	feed.items = feed.items.filter(Boolean).slice(0, entriesToPull);
	feed.items = feed.items.map(item => ({
		title: item.title,
		published: item.pubDate,
		link: { href: item.link },
		id: item.guid || item.id,
		tags: item.categories,
	}));
	return feed.items;
};

feed.checkFeed = async function (req, res) {
	if (!req.query.url) {
		return res.json('Please enter feed url!');
	}
	let entries;
	try {
		entries = await feed.getItems(req.query.url, 3);
	} catch (err) {
		return res.json(err.message);
	}

	entries = entries.map((entry) => {
		const entryData = entry || {};
		if (!entryData.title || (typeof entryData.title !== 'string' && !entryData.title.content)) {
			entryData.title = 'ERROR: title is missing';
		}

		if (!entryData.published && !entryData.date && !entryData.updated) {
			entryData.published = 'ERROR: published field is missing!';
		} else {
			entryData.published = entryData.published || entryData.date || entryData.updated;
		}

		if (!entryData.link || !entryData.link.href) {
			entryData.link = {
				href: 'ERROR: link is missing!',
			};
		}

		if (!entryData.id) {
			entryData.id = 'ERROR: id is missing';
		}

		return entry;
	});
	res.json(entries);
};
