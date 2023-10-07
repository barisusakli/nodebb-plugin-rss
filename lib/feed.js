'use strict';

const Parser = require('rss-parser');

const Feed = module.exports;

Feed.DEFAULT_ENTRIES_TO_PULL = 4;

Feed.getItems = async function (feedUrl, entriesToPull = Feed.DEFAULT_ENTRIES_TO_PULL) {
	entriesToPull = parseInt(entriesToPull, 10) || Feed.DEFAULT_ENTRIES_TO_PULL;
	feedUrl = `${feedUrl}?t=${Date.now()}`;

	const parser = new Parser();
	const feed = await parser.parseURL(feedUrl);

	return feed.items
		.filter(Boolean)
		.slice(0, entriesToPull)
		.map(item => ({
			title: item.title,
			published: item.pubDate,
			link: { href: item.link },
			id: item.guid || item.id,
			tags: item.categories,
		}));
};

Feed.checkFeed = async function (req, res) {
	if (!req.query.url) {
		return res.json('Please enter feed url!');
	}

	let entries;
	try {
		entries = await Feed.getItems(req.query.url, 3);
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
