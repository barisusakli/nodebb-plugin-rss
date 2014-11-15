'use strict';

var async = require('async'),
	request = require('request'),
	winston = require('winston'),
	cron = require('cron').CronJob,
	toMarkdown = require('to-markdown').toMarkdown,
	S = require('string'),
	meta = module.parent.require('./meta'),
	topics = module.parent.require('./topics'),
	db = module.parent.require('./database'),
	user = module.parent.require('./user'),
	plugins = module.parent.require('./plugins');


(function(module) {

	var cronJobs = [];
	var settings = {};

	cronJobs.push(new cron('* * * * *', function() { pullFeedsInterval(1); }, null, false));
	cronJobs.push(new cron('0 * * * *', function() { pullFeedsInterval(60); }, null, false));
	cronJobs.push(new cron('0 0/12 * * *', function() { pullFeedsInterval(60 * 12); }, null, false));
	cronJobs.push(new cron('0 0 * * *', function() { pullFeedsInterval(60 * 24); }, null, false));

	module.init = function(params, callback) {

		params.router.get('/admin/plugins/rss', params.middleware.applyCSRF, params.middleware.admin.buildHeader, renderAdmin);
		params.router.get('/api/admin/plugins/rss', params.middleware.applyCSRF, renderAdmin);

		params.router.post('/api/admin/plugins/rss/save', params.middleware.applyCSRF, save);

		callback();
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
			if(err) {
				return next(err);
			}
			results.csrf = req.csrfToken();
			res.render('admin/plugins/rss', results);
		});
	}

	function save(req, res, next) {
		deleteFeeds(function(err) {
			if(err) {
				return next(err);
			}

			if(!req.body.feeds) {
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

	function reStartCronJobs() {
		stopCronJobs();
		cronJobs.forEach(function(job) {
			job.start();
		});
	}

	function stopCronJobs() {
		cronJobs.forEach(function(job) {
			job.stop();
		});
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

	plugins.isActive('nodebb-plugin-rss', function(err, active) {
		if(active) {
			reStartCronJobs();
		}
	});

	function pullFeeds(feeds) {
		async.each(feeds, pullFeed, function(err) {
			if (err) {
				winston.error(err.message);
			}
		});
	}

	function pullFeed(feed, callback) {
		if (!feed) {
			return callback();
		}
		if (!feed.lastEntryDate) {
			feed.lastEntryDate = 0;
		}

		getFeedByGoogle(feed.url, feed.entriesToPull, function(err, entries) {
			if (err) {
				winston.error('[[nodebb-plugin-rss:error]] Error pulling feed ' + feed.url, err.message);
				return callback();
			}

			if(!Array.isArray(entries) || !entries.length) {
				return callback();
			}

			var mostRecent = feed.lastEntryDate;
			var entryDate;
			async.eachSeries(entries, function(entry, next) {
				entryDate = new Date(entry.publishedDate).getTime();
				if (entryDate > feed.lastEntryDate) {
					if(entryDate > mostRecent) {
						mostRecent = entryDate;
					}
					postEntry(feed, entry, next);
				} else {
					next();
				}
			}, function(err) {
				// only save lastEntryDate if it has changed
				if (mostRecent > feed.lastEntryDate) {
					db.setObjectField('nodebb-plugin-rss:feed:' + feed.url, 'lastEntryDate', mostRecent, callback);
				} else {
					callback();
				}
			});
		});
	}

	function postEntry(feed, entry, callback) {
		user.getUidByUsername(feed.username, function(err, uid) {
			if (err) {
				return callback(err);
			}

			if(!uid) {
				uid = 1;
			}

			var tags = [];
			if (feed.tags) {
				tags = feed.tags.split(',');
			}

			var content = S(entry.content).stripTags('div', 'script', 'span').trim().s;

			if (settings.collapseWhiteSpace) {
				content = S(content).collapseWhitespace().s;
			}

			content = toMarkdown(content);

			var topicData = {
				uid: uid,
				title: entry.title,
				content: content,
				cid: feed.category,
				tags: tags
			};

			topics.post(topicData, function(err, result) {
				if (err) {
					winston.error(err.message);
					return callback();
				}

				if (feed.timestamp === 'feed') {
					setTimestampToFeedPublishedDate(result, entry);
				}

				user.setUserField(uid, 'lastposttime', Date.now() - (parseInt(meta.config.postDelay, 10) + 1) * 1000, callback);
			});
		});
	}

	function setTimestampToFeedPublishedDate(data, entry) {
		var topicData = data.topicData;
		var postData = data.postData;
		var tid = topicData.tid;
		var pid = postData.pid;
		var timestamp = new Date(entry.publishedDate).getTime();

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

	function getFeedByGoogle(feedUrl, entriesToPull, callback) {
		entriesToPull = parseInt(entriesToPull, 10);
		entriesToPull = entriesToPull ? entriesToPull : 4;
		request('http://ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=' + entriesToPull + '&q=' + encodeURIComponent(feedUrl), function (err, response, body) {
			if (!err && response.statusCode === 200) {
				try {
					var p = JSON.parse(body);

					callback(null, p.responseData.feed.entries);
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

			settings.collapseWhiteSpace = parseInt(settings.collapseWhiteSpace, 10) === 1;
			callback(null, settings);
		});
	};

	admin.saveSettings = function(data, callback) {
		settings.collapseWhiteSpace = data.collapseWhiteSpace;
		db.setObject('nodebb-plugin-rss:settings', {
			collapseWhiteSpace: data.collapseWhiteSpace
		}, callback);
	};

	function saveFeeds(feeds, callback) {
		function saveFeed(feed, next) {
			if(!feed.url) {
				return next();
			}
			db.setObject('nodebb-plugin-rss:feed:' + feed.url, feed);
			db.setAdd('nodebb-plugin-rss:feeds', feed.url);
			next();
		}

		async.each(feeds, saveFeed, callback);
	}

	function deleteFeeds(callback) {
		db.getSetMembers('nodebb-plugin-rss:feeds', function(err, feeds) {
			if(err) {
				return callback(err);
			}

			if(!feeds) {
				return callback();
			}

			function deleteFeed(key, next) {
				db.delete('nodebb-plugin-rss:feed:' + key);
				db.setRemove('nodebb-plugin-rss:feeds', key);
				next();
			}

			async.each(feeds, deleteFeed, callback);
		});
	}

	admin.activate = function(id) {
		if (id === 'nodebb-plugin-rss') {
			reStartCronJobs();
		}
	};

	admin.deactivate = function(id) {
		if (id === 'nodebb-plugin-rss') {
			stopCronJobs();
		}
	};

	admin.getSettings(function(err, settingsData) {
		if (err) {
			return winston.error(err.message);
		}
		settings = settingsData;
	});

	module.admin = admin;

}(module.exports));


