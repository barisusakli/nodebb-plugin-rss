'use strict';

const db = require.main.require('./src/database');

const feedAPI = require('./feed');

const Database = module.exports;

Database.getFeeds = async function () {
	const feedUrls = await db.getSetMembers('nodebb-plugin-rss:feeds');
	const keys = feedUrls.map(url => `nodebb-plugin-rss:feed:${url}`);
	const results = await db.getObjects(keys);

	results.forEach((feed) => {
		if (feed) {
			feed.entriesToPull = feed.entriesToPull || feedAPI.DEFAULT_ENTRIES_TO_PULL;
		}
	});

	return results;
};

Database.saveFeeds = async function saveFeeds(feeds) {
	if (!Array.isArray(feeds)) {
		return;
	}

	feeds.filter(feed => feed && feed.url).forEach((feed) => {
		feed.url = feed.url.replace(/\/+$/, '');
	});

	async function saveFeed(feed) {
		await Promise.all([
			db.setObject(`nodebb-plugin-rss:feed:${feed.url}`, feed),
			db.setAdd('nodebb-plugin-rss:feeds', feed.url),
		]);
	}

	await Promise.all(
		feeds.map(feed => saveFeed(feed))
	);
};

Database.deleteFeeds = async function deleteFeeds() {
	const feeds = await db.getSetMembers('nodebb-plugin-rss:feeds');
	if (!feeds.length) {
		return;
	}

	const keys = feeds.map(feed => `nodebb-plugin-rss:feed:${feed}`);
	await db.deleteAll(keys);
	await db.setRemove('nodebb-plugin-rss:feeds', feeds);
};
