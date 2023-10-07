'use strict';

const db = require.main.require('./src/database');
const pubsub = require.main.require('./src/pubsub');
const routeHelpers = require.main.require('./src/routes/helpers');

const database = require('./lib/database');
const controllers = require('./lib/controllers');
const feedAPI = require('./lib/feed');
const jobs = require('./lib/jobs');
const pull = require('./lib/pull');
const widget = require('./lib/widget');

const RssPlugin = module.exports;

/**
 * Called on `static:app.load`
 */
RssPlugin.init = async function (params) {
	widget.init(params.app);
	jobs.init(pullFeedsInterval);
	const { router, middleware } = params;
	routeHelpers.setupAdminPageRoute(router, '/admin/plugins/rss', [middleware.applyCSRF], controllers.renderAdmin);

	params.router.post('/api/admin/plugins/rss/save', middleware.applyCSRF, controllers.save);
	params.router.get('/api/admin/plugins/rss/checkFeed', feedAPI.checkFeed);
};

/**
 * Called on `action:topic.purge`
 */
RssPlugin.onTopicPurge = async function (data) {
	const feedUrls = await db.getSetMembers('nodebb-plugin-rss:feeds');
	const keys = feedUrls.map(url => `nodebb-plugin-rss:feed:${url}:uuid`);
	await db.sortedSetsRemoveRangeByScore(keys, data.topic.tid, data.topic.tid);
};


async function pullFeedsInterval(interval) {
	let feeds = await database.getFeeds();

	feeds = feeds.filter(item => item && parseInt(item.interval, 10) === interval);
	if (!feeds.length) {
		return;
	}

	for (const feed of feeds) {
		// eslint-disable-next-line no-await-in-loop
		await pull.pullFeed(feed);
	}
}


RssPlugin.admin = {};

/**
 * Called on `filter:admin.header.build`
 */
RssPlugin.admin.menu = async function (custom_header) {
	custom_header.plugins.push({
		route: '/plugins/rss',
		icon: 'fa-rss',
		name: 'RSS',
	});
	return custom_header;
};

/**
 * Called on `action:plugin.deactivate`
 */
RssPlugin.admin.deactivate = function (data) {
	if (data.id === 'nodebb-plugin-rss') {
		pubsub.publish('nodebb-plugin-rss:deactivate');
	}
};

/**
 * Called on `action:plugin.uninstall`
 */
RssPlugin.admin.uninstall = function (data) {
	if (data.id === 'nodebb-plugin-rss') {
		database.deleteFeeds();
	}
};


RssPlugin.widgets = {};

/**
 * Called on `filter:widgets.getWidgets`
 */
RssPlugin.widgets.defineWidgets = widget.defineWidgets;

/**
 * Called on `filter:widget.render:rss`
 */
RssPlugin.widgets.renderRssWidget = widget.render;

