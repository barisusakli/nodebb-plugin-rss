'use strict';

var async = require('async');
var request = module.parent.require('request');
var winston = module.parent.require('winston');
var cron = require('cron').CronJob;
var toMarkdown = require('to-markdown');
var S = require('string');

var nconf = module.parent.require('nconf');
var meta = module.parent.require('./meta');
var pubsub = module.parent.require('./pubsub');
var topics = module.parent.require('./topics');
var db = module.parent.require('./database');
var user = module.parent.require('./user');
var plugins = module.parent.require('./plugins');

var rssPlugin = module.exports;

var cronJobs = [];
var settings = {};

// minute
cronJobs.push(new cron('0 * * * * *', function() { pullFeedsInterval(1); }, null, false));

// hour
cronJobs.push(new cron('0 0 * * * *', function() { pullFeedsInterval(60); }, null, false));

// 12 hours
cronJobs.push(new cron('0 0 0/12 * * *', function() { pullFeedsInterval(60 * 12); }, null, false));

// 24 hours
cronJobs.push(new cron('0 0 0 * * *', function() { pullFeedsInterval(60 * 24); }, null, false));

// 48 hours
cronJobs.push(new cron('0 0 0 */2 * *', function() { pullFeedsInterval(60 * 24 * 2); }, null, false));

// one week
cronJobs.push(new cron('0 0 0 0 0 6', function() { pullFeedsInterval(60 * 24 * 7); }, null, false));

plugins.isActive('nodebb-plugin-rss', function(err, active) {
	if (err) {
		return winston.error(err.stack);
	}

	if (active) {
		reStartCronJobs();
	}
});

rssPlugin.onClearRequireCache = function(data, callback) {
	stopCronJobs();
	cronJobs.length = 0;
	callback(null, data);
};

rssPlugin.init = function(params, callback) {

	params.router.get('/admin/plugins/rss', params.middleware.applyCSRF, params.middleware.admin.buildHeader, renderAdmin);
	params.router.get('/api/admin/plugins/rss', params.middleware.applyCSRF, renderAdmin);

	params.router.post('/api/admin/plugins/rss/save', params.middleware.applyCSRF, save);
	params.router.get('/api/admin/plugins/rss/checkFeed', checkFeed);

	callback();
};

rssPlugin.onTopicPurge = function(data) {
	async.waterfall([
		function (next) {
			db.getSetMembers('nodebb-plugin-rss:feeds', next);
		},
		function (feedUrls, next) {
			var keys = feedUrls.map(function(url) {
				return 'nodebb-plugin-rss:feed:' + url + ':uuid';
			});
			db.sortedSetsRemoveRangeByScore(keys, data.topic.tid, data.topic.tid, next);
		}
	], function (err) {
		if (err) {
			return winston.error(err);
		}
	});
};

function renderAdmin(req, res, next) {
	async.parallel({
		feeds: function(next) {
			admin.getFeeds(next);
		},
		settings: function(next) {
			admin.getSettings(next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		results.csrf = req.csrfToken();
		res.render('admin/plugins/rss', results);
	});
}

function save(req, res, next) {
	deleteFeeds(function(err) {
		if (err) {
			return next(err);
		}

		if (!req.body.feeds) {
			return res.json({message:'Feeds saved!'});
		}

		async.parallel([
			function(next) {
				saveFeeds(req.body.feeds, next);
			},
			function(next) {
				admin.saveSettings(req.body.settings, next);
			}
		], function(err) {
			if(err) {
				return next(err);
			}

			res.json({message: 'Feeds saved!'});
		});
	});
}

function checkFeed(req, res) {
	if (!req.query.url) {
		return res.json('Please enter feed url!');
	}
	getFeedByYahoo(req.query.url, 1, function(err, entries) {
		if (err) {
			return res.json(err.message);
		}

		entries = entries.map(function (entry) {
			var entryData = entry.entry || {};
			if (!entryData.title || (typeof entryData.title !== 'string' && !entryData.title.content)) {
				entryData.title = 'ERROR: title is missing';
			}

			if (!entryData.content || !entryData.content.content) {
				entryData.content = {
					content: 'ERROR: content is missing!'
				};
			}

			if (!entryData.summary || !entryData.summary.content) {
				entryData.summary = {
					content: 'ERROR: summary is missing!'
				};
			}

			if (!entryData.published) {
				entryData.published = 'ERROR: published field is missing!';
			}

			if (!entryData.link && !entryData.link.href) {
				entryData.link = {
					href: 'ERROR: link is missing!',
				};
			}

			if (!entryData.id) {
				entryData.id = 'ERROR: id is missing';
			}

			if (Array.isArray(entryData.category)) {
				entryData.tags = entryData.category.map(function (category) {
					return category && category.term;
				});
				delete entryData.category;
			}
			delete entryData.commentRss;
			delete entryData.comments;
			delete entryData.author;
			delete entryData.creator;
			delete entryData.updated;
			delete entryData.date;
			entry.entry = entryData;
			return entry;
		});

		res.json(entries);
	});
}

function reStartCronJobs() {
	if (nconf.get('isPrimary') === 'true') {
		stopCronJobs();
		cronJobs.forEach(function(job) {
			job.start();
		});
	}
}

function stopCronJobs() {
	if (nconf.get('isPrimary') === 'true') {
		cronJobs.forEach(function(job) {
			job.stop();
		});
	}
}

function pullFeedsInterval(interval) {
	admin.getFeeds(function(err, feeds) {
		if (err || !Array.isArray(feeds)) {
			return;
		}
		feeds = feeds.filter(function(item) {
			return item && parseInt(item.interval, 10) === interval;
		});

		pullFeeds(feeds);
	});
}

function pullFeeds(feeds) {
	async.eachSeries(feeds, pullFeed, function(err) {
		if (err) {
			winston.error(err.message);
		}
	});
}

function pullFeed(feed, callback) {
	if (!feed) {
		return callback();
	}

	getFeedByYahoo(feed.url, feed.entriesToPull, function(err, entries) {
		if (err) {
			winston.error('[[nodebb-plugin-rss:error]] Error pulling feed ' + feed.url, err.message);
			return callback();
		}

		entries = entries.filter(Boolean);
		async.eachSeries(entries, function(entryObj, next) {
			var entry = entryObj.entry;
			if (!entry) {
				return next();
			}

			isEntryNew(feed, entry, function (err, isNew) {
				if (err) {
					winston.error(err);
					return next();
				}
				if (!isNew) {
					winston.info('[plugin-rss] entry is not new, id: ' + entry.id + ', title: ' + entry.title + ', link: ' + (entry.link && entry.link.href));
					return next();
				}
				winston.info('[plugin-rss] posting, ' + feed.url + ' - title: ' + entry.title + ', published date: ' + entry.published);
				postEntry(feed, entry, next);
			});
		}, function(err) {
			if (err) {
				winston.error(err);
			}
			callback();
		});
	});
}

function isEntryNew(feed, entry, callback) {
	var uuid = entry.id || (entry.link && entry.link.href) || entry.title;
	db.isSortedSetMember('nodebb-plugin-rss:feed:' + feed.url + ':uuid', uuid, function (err, isMember) {
		callback(err, !isMember);
	});
}

function postEntry(feed, entry, callback) {
	if (!entry || ((!entry.summary || !entry.summary.content) && (!entry.hasOwnProperty('content') || !entry.content || !entry.content.content))) {
		winston.warn('[nodebb-plugin-rss] invalid content for entry,  ' + feed.url);
		return callback();
	}

	if (!entry.title || (typeof entry.title !== 'string' && !entry.title.content)) {
		winston.warn('[nodebb-plugin-rss] invalid title for entry, ' + feed.url);
	}

	var posterUid;
	var topicData;

	async.waterfall([
		function (next) {
			user.getUidByUsername(feed.username, next);
		},
		function (uid, next) {
			posterUid = uid;
			if (!posterUid) {
				posterUid = 1;
			}
			var tags = [];
			if (feed.tags) {
				tags = feed.tags.split(',');
			}

			// use tags from feed if there are any
			if (Array.isArray(entry.category)) {
				var entryTags = entry.category.map(function(data) {
					return data && data.term;
				}).filter(Boolean);
				tags = tags.concat(entryTags);
			}

			var title = entry.title && entry.title.content ? entry.title.content : entry.title;

			var content = '';
			if (entry.hasOwnProperty('content') && entry.content.content) {
				content = S(entry.content.content).stripTags('div', 'script', 'span', 'iframe').trim().s;
			} else {
				content = S(entry.summary.content).stripTags('div', 'script', 'span', 'iframe').trim().s;
			}

			if (settings.collapseWhiteSpace) {
				content = S(content).collapseWhitespace().s;
			}

			var link = (entry.link && entry.link.href) ? ('<br/><br/>' + entry.link.href) : '';

			if (settings.convertToMarkdown) {
				content = toMarkdown(content + link);
			} else {
				content = content + link;
			}

			topics.post({
				uid: posterUid,
				title: title,
				content: content,
				cid: feed.category,
				tags: tags
			}, next);
		},
		function (result, next) {
			topicData = result.topicData;
			if (feed.timestamp === 'feed') {
				setTimestampToFeedPublishedDate(result, entry);
			}
			var max = Math.max(parseInt(meta.config.postDelay, 10) || 10, parseInt(meta.config.newbiePostDelay, 10) || 10) + 1;

			user.setUserField(posterUid, 'lastposttime', Date.now() - max * 1000, next);
		},
		function (next) {
			var uuid = entry.id || (entry.link && entry.link.href) || entry.title;
			db.sortedSetAdd('nodebb-plugin-rss:feed:' + feed.url + ':uuid', topicData.tid, uuid, next);
		}
	], function (err) {
		if (err) {
			winston.error(err);
		}
		callback();
	});
}

function setTimestampToFeedPublishedDate(data, entry) {
	var topicData = data.topicData;
	var postData = data.postData;
	var tid = topicData.tid;
	var pid = postData.pid;
	var timestamp = new Date(entry.published).getTime();

	db.setObjectField('topic:' + tid, 'timestamp', timestamp);
	db.sortedSetsAdd([
		'topics:tid',
		'cid:' + topicData.cid + ':tids',
		'cid:' + topicData.cid + ':uid:' + topicData.uid + ':tids',
		'uid:' + topicData.uid + ':topics'
	], timestamp, tid);

	db.setObjectField('post:' + pid, 'timestamp', timestamp);
	db.sortedSetsAdd([
		'posts:pid',
		'cid:' + topicData.cid + ':pids'
	], timestamp, pid);
}

function getFeedByYahoo(feedUrl, entriesToPull, callback) {
	entriesToPull = parseInt(entriesToPull, 10);
	entriesToPull = entriesToPull ? entriesToPull : 4;
	var yql = encodeURIComponent('select entry FROM feednormalizer where url=\'' +
		feedUrl + '\' AND output=\'atom_1.0\' | truncate(count=' + entriesToPull + ')');
	request({
		url: 'https://query.yahooapis.com/v1/public/yql?q=' + yql + '&format=json',
		timeout: 120000
	}, function (err, response, body) {
		if (!err && response.statusCode === 200) {
			try {
				var p = JSON.parse(body);
				if (p.query.count > 0) {
					callback(null, Array.isArray(p.query.results.feed) ? p.query.results.feed : [p.query.results.feed]);
				} else {
					callback(new Error('No new feed is returned'));
				}
			} catch (e) {
				callback(e);
			}
		} else {
			callback(err);
		}
	});
}


var admin = {};

admin.menu = function(custom_header, callback) {
	custom_header.plugins.push({
		route: '/plugins/rss',
		icon: 'fa-rss',
		name: 'RSS'
	});

	callback(null, custom_header);
};

admin.getFeeds = function(callback) {
	db.getSetMembers('nodebb-plugin-rss:feeds', function(err, feedUrls) {
		if (err) {
			return callback(err);
		}

		async.map(feedUrls, function (feedUrl, next) {
			db.getObject('nodebb-plugin-rss:feed:' + feedUrl, next);
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			results.forEach(function(feed) {
				if (feed) {
					feed.entriesToPull = feed.entriesToPull || 4;
				}
			});

			callback(null, results ? results : []);
		});
	});
};

admin.getSettings = function(callback) {
	db.getObject('nodebb-plugin-rss:settings', function(err, settings) {
		if (err) {
			return callback(err);
		}
		settings = settings || {};

		if (!settings.hasOwnProperty('convertToMarkdown')) {
			settings.convertToMarkdown = 1;
		}

		settings.collapseWhiteSpace = parseInt(settings.collapseWhiteSpace, 10) === 1;
		settings.convertToMarkdown = parseInt(settings.convertToMarkdown, 10) === 1;
		callback(null, settings);
	});
};

admin.saveSettings = function(data, callback) {
	settings.collapseWhiteSpace = data.collapseWhiteSpace;
	settings.convertToMarkdown = data.convertToMarkdown;
	db.setObject('nodebb-plugin-rss:settings', settings, function(err) {
		if (err) {
			return callback(err);
		}
		pubsub.publish('nodebb-plugin-rss:settings', settings);
		callback();
	});
};

function saveFeeds(feeds, callback) {
	async.each(feeds, function saveFeed(feed, next) {
		if (!feed.url) {
			return next();
		}
		async.parallel([
			function(next) {
				db.setObject('nodebb-plugin-rss:feed:' + feed.url, feed, next);
			},
			function(next) {
				db.setAdd('nodebb-plugin-rss:feeds', feed.url, next);
			}
		], next);
	}, callback);
}

function deleteFeeds(callback) {
	callback = callback || function() {};
	db.getSetMembers('nodebb-plugin-rss:feeds', function(err, feeds) {
		if (err || !feeds || !feeds.length) {
			return callback(err);
		}

		async.each(feeds, function(key, next) {
			async.parallel([
				function(next) {
					db.delete('nodebb-plugin-rss:feed:' + key, next);
				},
				function(next) {
					db.setRemove('nodebb-plugin-rss:feeds', key, next);
				}
			], next);
		}, callback);
	});
}

function deleteSettings(callback) {
	callback = callback || function() {};
	db.delete('nodebb-plugin-rss:settings', callback);
}

pubsub.on('nodebb-plugin-rss:deactivate', function() {
	stopCronJobs();
});

pubsub.on('nodebb-plugin-rss:settings', function(newSettings) {
	settings = newSettings;
});

admin.deactivate = function(data) {
	if (data.id === 'nodebb-plugin-rss') {
		pubsub.publish('nodebb-plugin-rss:deactivate');
	}
};

admin.uninstall = function(data) {
	if (data.id === 'nodebb-plugin-rss') {
		deleteFeeds();
		deleteSettings();
	}
};

admin.getSettings(function(err, settingsData) {
	if (err) {
		return winston.error(err.message);
	}
	settings = settingsData;
});

rssPlugin.admin = admin;
