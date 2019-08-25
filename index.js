'use strict';

const winston = require.main.require('winston');
const meta = require.main.require('./src/meta');
const pubsub = require.main.require('./src/pubsub');
const topics = require.main.require('./src/topics');
const db = require.main.require('./src/database');
const user = require.main.require('./src/user');


const widget = require('./widget');
const feedAPI = require('./feed');
const jobs = require('./jobs');

const rssPlugin = module.exports;
const admin = {};
rssPlugin.admin = admin;

rssPlugin.defineWidgets = widget.defineWidgets;
rssPlugin.renderRssWidget = widget.render;

rssPlugin.init = function (params, callback) {
	widget.init(params.app);
	jobs.init(pullFeedsInterval);

	params.router.get('/admin/plugins/rss', params.middleware.applyCSRF, params.middleware.admin.buildHeader, renderAdmin);
	params.router.get('/api/admin/plugins/rss', params.middleware.applyCSRF, renderAdmin);

	params.router.post('/api/admin/plugins/rss/save', params.middleware.applyCSRF, save);
	params.router.get('/api/admin/plugins/rss/checkFeed', feedAPI.checkFeed);

	callback();
};

rssPlugin.onTopicPurge = async function (data) {
	const feedUrls = await db.getSetMembers('nodebb-plugin-rss:feeds');
	const keys = feedUrls.map(url => 'nodebb-plugin-rss:feed:' + url + ':uuid');
	await db.sortedSetsRemoveRangeByScore(keys, data.topic.tid, data.topic.tid);
};

async function renderAdmin(req, res, next) {
	try {
		const feeds = await admin.getFeeds();

		res.render('admin/plugins/rss', {
			feeds: feeds,
			csrf: req.csrfToken(),
		});
	} catch (err) {
		next(err);
	}
}

async function save(req, res, next) {
	try {
		await deleteFeeds();
		await saveFeeds(req.body.feeds);
		res.json({ message: 'Feeds saved!' });
	} catch (err) {
		return next(err);
	}
}

async function pullFeedsInterval(interval) {
	let feeds = await admin.getFeeds();
	feeds = feeds.filter(item => item && parseInt(item.interval, 10) === interval);

	if (!feeds.length) {
		return;
	}
	for	(const feed of feeds) {
		await pullFeed(feed);
	}
}
async function pullFeed(feed) {
	if (!feed) {
		return;
	}
	try {
		const entries = await feedAPI.getItems(feed.url, feed.entriesToPull);
		entries.reverse();
		for (const entry of entries) {
			await postEntry(feed, entry);
		}
	} catch (err) {
		winston.error('[unable to pull feed] ' + feed.url, err);
	}
}

function getEntryDate(entry) {
	if (!entry) {
		return null;
	}
	return entry.published || entry.date || entry.updated || Date.now();
}

async function isEntryNew(feed, entry) {
	const uuid = entry.id || (entry.link && entry.link.href) || entry.title;
	const isMember = await db.isSortedSetMember('nodebb-plugin-rss:feed:' + feed.url + ':uuid', uuid);
	return !isMember;
}

async function postEntry(feed, entry) {
	if (!entry || (!entry.hasOwnProperty('content') || !entry.content)) {
		winston.warn('[nodebb-plugin-rss] invalid content for entry,  ' + feed.url);
		return;
	}

	if (!entry.title || typeof entry.title !== 'string') {
		winston.warn('[nodebb-plugin-rss] invalid title for entry, ' + feed.url);
		return;
	}

	const isNew = await isEntryNew(feed, entry);
	if (!isNew) {
		winston.info('[plugin-rss] entry is not new, id: ' + entry.id + ', title: ' + entry.title + ', link: ' + (entry.link && entry.link.href));
		return;
	}

	let posterUid = await user.getUidByUsername(feed.username);
	if (!posterUid) {
		posterUid = 1;
	}

	let tags = [];
	if (feed.tags) {
		tags = feed.tags.split(',');
	}

	// use tags from feed if there are any
	if (Array.isArray(entry.category)) {
		const entryTags = entry.category.map(data => data && data.term).filter(Boolean);
		tags = tags.concat(entryTags);
	}
	winston.info('[plugin-rss] posting, ' + feed.url + ' - title: ' + entry.title + ', published date: ' + getEntryDate(entry));
	const result = await topics.post({
		uid: posterUid,
		title: entry.title,
		content: entry.link && entry.link.href,
		cid: feed.category,
		tags: tags,
	});

	const topicData = result.topicData;

	if (feed.timestamp === 'feed') {
		setTimestampToFeedPublishedDate(result, entry);
	}

	const max = Math.max(parseInt(meta.config.postDelay, 10) || 10, parseInt(meta.config.newbiePostDelay, 10) || 10) + 1;

	await user.setUserField(posterUid, 'lastposttime', Date.now() - (max * 1000));
	const uuid = entry.id || (entry.link && entry.link.href) || entry.title;
	await db.sortedSetAdd('nodebb-plugin-rss:feed:' + feed.url + ':uuid', topicData.tid, uuid);
}

function setTimestampToFeedPublishedDate(data, entry) {
	const topicData = data.topicData;
	const postData = data.postData;
	const tid = topicData.tid;
	const pid = postData.pid;
	const timestamp = new Date(getEntryDate(entry)).getTime();

	db.setObjectField('topic:' + tid, 'timestamp', timestamp);
	db.sortedSetsAdd([
		'topics:tid',
		'cid:' + topicData.cid + ':tids',
		'cid:' + topicData.cid + ':uid:' + topicData.uid + ':tids',
		'uid:' + topicData.uid + ':topics',
	], timestamp, tid);

	db.setObjectField('post:' + pid, 'timestamp', timestamp);
	db.sortedSetsAdd([
		'posts:pid',
		'cid:' + topicData.cid + ':pids',
	], timestamp, pid);
}

admin.menu = function (custom_header, callback) {
	custom_header.plugins.push({
		route: '/plugins/rss',
		icon: 'fa-rss',
		name: 'RSS',
	});

	callback(null, custom_header);
};

admin.getFeeds = async function () {
	const feedUrls = await db.getSetMembers('nodebb-plugin-rss:feeds');
	const keys = feedUrls.map(url => 'nodebb-plugin-rss:feed:' + url);
	const results = await db.getObjects(keys);

	results.forEach(function (feed) {
		if (feed) {
			feed.entriesToPull = feed.entriesToPull || 4;
		}
	});
	return results;
};

async function saveFeeds(feeds) {
	if (!Array.isArray(feeds)) {
		return;
	}
	feeds.filter(feed => feed && feed.url).forEach(function (feed) {
		feed.url = feed.url.replace(/\/+$/, '');
	});
	async function saveFeed(feed) {
		await Promise.all([
			await db.setObject('nodebb-plugin-rss:feed:' + feed.url, feed),
			await db.setAdd('nodebb-plugin-rss:feeds', feed.url),
		]);
	}
	const promises = feeds.map(feed => saveFeed(feed));
	await Promise.all(promises);
}

async function deleteFeeds() {
	const feeds = await db.getSetMembers('nodebb-plugin-rss:feeds');
	if (!feeds.length) {
		return;
	}
	const keys = feeds.map(feed => 'nodebb-plugin-rss:feed:' + feed);
	await db.deleteAll(keys);
	await db.setRemove('nodebb-plugin-rss:feeds', feeds);
}

admin.deactivate = function (data) {
	if (data.id === 'nodebb-plugin-rss') {
		pubsub.publish('nodebb-plugin-rss:deactivate');
	}
};

admin.uninstall = function (data) {
	if (data.id === 'nodebb-plugin-rss') {
		deleteFeeds();
	}
};
