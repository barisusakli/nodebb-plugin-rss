

var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	request = require('request'),
	cron = require('cron').CronJob,
	toMarkdown = require('to-markdown').toMarkdown,
	S = require('string'),
	topics = module.parent.require('./topics'),
	db = module.parent.require('./database'),
	user = module.parent.require('./user'),
	plugins = module.parent.require('./plugins'),
	templates = module.parent.require('./../public/src/templates'),
	meta = module.parent.require('./meta');

(function(module) {

	var cronJobs = [];

	cronJobs.push(new cron('* * * * *', function() { pullFeedsInterval(1); }, null, false));
	cronJobs.push(new cron('0 * * * *', function() { pullFeedsInterval(60); }, null, false));
	cronJobs.push(new cron('0 0/12 * * *', function() { pullFeedsInterval(60 * 12); }, null, false));
	cronJobs.push(new cron('0 0 * * *', function() { pullFeedsInterval(60 * 24); }, null, false));

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
			feeds = feeds.filter(function(item) {
				return parseInt(item.interval, 10) === interval;
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

		function get(feed, next) {

			if(!feed.lastEntryDate) {
				feed.lastEntryDate = 0;
			}

			getFeedByGoogle(feed.url, function(err, entries) {
				if(err) {
					return next(err);
				}

				if(!entries || !entries.length) {
					return next();
				}

				var mostRecent = feed.lastEntryDate;

				function postEntry(entry, callback) {
					user.getUidByUsername(feed.username, function(err, uid) {
						if(err) {
							return next(err);
						}

						if(!uid) {
							uid = 1;
						}

						topics.post(uid, entry.title, toMarkdown(S(entry.content).stripTags('div', 'script', 'span')), feed.category, function(err, result) {

						});
					});
				}

				for(var i=0; i<entries.length; ++i) {
					entryDate = new Date(entries[i].publishedDate).getTime();
					if(entryDate > feed.lastEntryDate) {
						if(entryDate > mostRecent) {
							mostRecent = entryDate;
						}
						postEntry(entries[i], next);
					}
				}


				db.setObjectField('nodebb-plugin-rss:feed:' + feed.url, 'lastEntryDate', mostRecent);

				next(err);
			});
		}


		async.each(feeds, get, function(err) {

		});
	};

	function getFeedByGoogle(feedUrl, callback) {
		request('http://ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=4&q=' + encodeURIComponent(feedUrl), function (err, response, body) {

			if (!err && response.statusCode == 200) {

				var p = JSON.parse(body);

				callback(null, p.responseData.feed.entries);
			} else {
				callback(err);
			}
		});
	}

	var admin = {};

	admin.menu = function(custom_header, callback) {
		custom_header.plugins.push({
			"route": '/plugins/rss',
			"icon": 'fa-rss',
			"name": 'RSS'
		});

		return custom_header;
	};


	admin.getFeeds = function(callback) {
		db.getSetMembers('nodebb-plugin-rss:feeds', function(err, feedUrls) {

			if(err) {
				return callback(err);
			}

			function getFeed(feedUrl, next) {
				db.getObject('nodebb-plugin-rss:feed:' + feedUrl, next);
			}

			async.map(feedUrls, getFeed, function(err, results) {

				if(err) {
					return callback(err);
				}

				if(results) {
					callback(null, results);
				} else {
					callback(null, []);
				}
			});
		});
	}

	function saveFeeds(feeds, callback) {
		function saveFeed(feed, next) {
			if(!feed.url) {
				return next();
			}
			db.setObject('nodebb-plugin-rss:feed:' + feed.url, feed);
			db.setAdd('nodebb-plugin-rss:feeds', feed.url);
			next();
		}

		async.each(feeds, saveFeed, function(err) {
			callback(err);
		});
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
				db.delete('nodebb-plugin-rss:feed:' + key)
				db.setRemove('nodebb-plugin-rss:feeds', key);
				next();
			}

			async.each(feeds, deleteFeed, function(err) {
				callback(err);
			});

		});
	}

	admin.route = function(custom_routes, callback) {
		fs.readFile(path.join(__dirname, 'public/templates/admin.tpl'), function(err, tpl) {

			custom_routes.routes.push({
				route: '/plugins/rss',
				method: 'get',
				options: function(req, res, callback) {

					admin.getFeeds(function(err, feeds) {

						if(err) {
							return callback();
						}
						var newTpl = templates.prepare(tpl.toString()).parse({feeds:feeds});


						callback({
							req: req,
							res: res,
							route: '/plugins/rss',
							name: 'Rss',
							content: newTpl
						});
					});
				}
			});

			custom_routes.api.push({
				route: '/plugins/rss/save',
				method: 'post',
				callback: function(req, res, callback) {

					deleteFeeds(function(err) {
						if(err) {
							return res.json(500, {message: err.message});
						}

						if(!req.body.feeds) {
							return callback({message:'Feeds saved!'});
						}

						saveFeeds(req.body.feeds, function(err) {
							if(err) {
								return res.json(500, {message: err.message});
							}
							callback({message: 'Feeds saved!'});
						});
					});
				}
			});

			callback(null, custom_routes);
		});
	};

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

	module.admin = admin;

}(module.exports));


