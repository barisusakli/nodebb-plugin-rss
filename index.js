'use strict';

var async = require('async');
var cheerio = require('cheerio');
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

	params.router.post('/api/admin/plugins/rss/parseHTML', params.middleware.applyCSRF, function (req, res, next) {
		admin.getSettings(function (err, settings) {
			if (err) {
				return next(err);
			}
			var content = modifyContent({
				content: {
					content: req.body.html,
				},
				link: {
					href: "https://community.nodebb.org",
				}
			}, settings);
			res.send(content);
		});
	});

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

		async.parallel([
			function(next) {
				saveFeeds(req.body.feeds, next);
			},
			function(next) {
				admin.saveSettings(req.body.settings, next);
			}
		], function(err) {
			if (err) {
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
	async.parallel({
		settings: admin.getSettings,
		entries: function (next) {
			getFeedByYahoo(req.query.url, 1, next);
		},
	}, function (err, results) {
		if (err) {
			return res.json(err.message);
		}
		var entries = results.entries;

		entries = entries.map(function (entry) {
			var entryData = entry.entry || {};
			if (!entryData.title || (typeof entryData.title !== 'string' && !entryData.title.content)) {
				entryData.title = 'ERROR: title is missing';
			}

			if ((!entryData.content || !entryData.content.content) && (!entryData.summary || !entryData.summary.content)) {
				entryData.error = 'ERROR: content/summary is missing!'
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

			entryData.modifiedContent = modifyContent(entryData, results.settings);

			delete entryData.commentRss;
			delete entryData.comments;
			delete entryData.author;
			delete entryData.creator;
			delete entryData.updated;
			delete entryData.date;
			entry.entry = entryData;
			return entry;
		});

		async.each(entries, function (entryData, next) {
			plugins.fireHook('filter:parse.raw', entryData.entry.modifiedContent, function (err, parsed) {
				if (err) {
					return next(err);
				}

				entryData.entry.rendered = parsed;
				next();
			});
		}, function (err) {
			if (err){
				return next(err);
			}
			res.json(entries);
		});
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
	async.parallel({
		settings: admin.getSettings,
		feeds: admin.getFeeds,
	}, function (err, results) {
		if (err) {
			winston.error(err);
		}
		if(!Array.isArray(results.feeds)) {
			return;
		}
		results.feeds = results.feeds.filter(function(item) {
			return item && parseInt(item.interval, 10) === interval;
		});
		if (!results.feeds.length) {
			return;
		}
		pullFeeds(results.feeds, results.settings);
	});
}

function pullFeeds(feeds, settings) {
	async.eachSeries(feeds, function (feed, next) {
		pullFeed(feed, settings, next);
	}, function(err) {
		if (err) {
			winston.error(err.message);
		}
	});
}

function pullFeed(feed, settings, callback) {
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
				postEntry(feed, entry, settings, next);
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

function postEntry(feed, entry, settings, callback) {
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

			var content = modifyContent(entry, settings);

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

function modifyContent(entry, settings) {
	var content = '';
	if (entry.hasOwnProperty('content') && entry.content.content) {
		content = entry.content.content;
	} else if (entry.hasOwnProperty('summary') && entry.summary.content) {
		content = entry.summary.content;
	}

	if (content) {
		content = S(content).stripTags('div', 'script', 'span', 'iframe').trim().s;
	}

	if (settings.collapseWhiteSpace) {
		content = S(content).collapseWhitespace().s;
	}

	var link = (entry.link && entry.link.href) ? ('<br/><br/>' + entry.link.href) : '';

	var toMarkdownOptions = {};
	if (settings.useGFM) {
		toMarkdownOptions.gfm = true;
	}

	if (settings.convertToMarkdown) {
		content = fixTables(content);
		content = toMarkdown(content + link, toMarkdownOptions);
	} else {
		content = content + link;
	}
	return content;
}

function fixTables(content) {
	var $ = cheerio.load(content);

	$('table').each(function (index, el) {
		var myTable = $(el);
		// remove all p tags
		myTable.find('p').each(function() {
			$(this).replaceWith($(this).html());
		});
		var thead = myTable.find('thead');
		var tbody = myTable.find('tbody');

		var thRows = myTable.find('tr:has(th)');
		var tdRows = myTable.find('tr:has(td)');

		if (thead.length === 0) {  //if there is no thead element, add one.
			thead = $('<thead></thead>').prependTo(myTable);
		}

		if (tbody.length === 0) {  //if there is no tbody element, add one.
			tbody = $('<tbody></tbody>').appendTo(myTable);
		}

		thRows.clone(true).appendTo(thead);
		thRows.remove();

		tdRows.clone(true).appendTo(tbody);
		tdRows.remove();

		// if thead does not have a tr take the first tr from tbody
		if (thead.find('tr').length === 0 && tbody.find('tr').length) {
			var firstRow = tbody.find('tr').first();
			firstRow.appendTo(thead);
		}
	});
	return $('body').html();
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
	feedUrl = feedUrl + '?t=' + Date.now();
	var yql = encodeURIComponent('select entry FROM feednormalizer where url=\'' +
		feedUrl + '\' AND output=\'atom_1.0\' | truncate(count=' + entriesToPull + ')');
	var url = 'https://query.yahooapis.com/v1/public/yql?q=' + yql + '&format=json';

	request({
		url: url,
		timeout: 120000
	}, function (err, response, body) {
		if (!err && response.statusCode === 200) {
			var p;
			try {
				p = JSON.parse(body);
			} catch (e) {
				return callback(e);
			}

			if (p.query.count > 0) {
				callback(null, Array.isArray(p.query.results.feed) ? p.query.results.feed : [p.query.results.feed]);
			} else {
				callback(new Error('No new feed is returned'));
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
	db.getObject('nodebb-plugin-rss:settings', function(err, settingsData) {
		if (err) {
			return callback(err);
		}
		settingsData = settingsData || {};

		if (!settingsData.hasOwnProperty('convertToMarkdown')) {
			settingsData.convertToMarkdown = 1;
		}

		settingsData.collapseWhiteSpace = parseInt(settingsData.collapseWhiteSpace, 10) === 1;
		settingsData.convertToMarkdown = parseInt(settingsData.convertToMarkdown, 10) === 1;
		settingsData.useGFM = parseInt(settingsData.useGFM, 10) === 1;
		callback(null, settingsData);
	});
};

admin.saveSettings = function(data, callback) {
	db.setObject('nodebb-plugin-rss:settings', {
		collapseWhitespace: data.collapseWhitespace,
		convertToMarkdown: data.convertToMarkdown,
		useGFM: data.useGFM,
	}, callback);
};

function saveFeeds(feeds, callback) {
	async.each(feeds, function saveFeed(feed, next) {
		if (!feed.url) {
			return next();
		}
		feed.url = feed.url.replace(/\/+$/, '');
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

rssPlugin.admin = admin;
