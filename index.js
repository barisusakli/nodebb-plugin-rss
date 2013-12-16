

var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	request = require('request'),
	cron = require('cron').CronJob,
	topics = module.parent.require('./topics'),
	db = module.parent.require('./database'),
	templates = module.parent.require('./../public/src/templates'),
	meta = module.parent.require('./meta');

(function(module) {


	function pullFeeds() {
		console.log('cron run : ');
		admin.getFeeds(function(err, feeds) {
			var returnData = [];
			function get(feed, next) {
				getFeedByGoogle(feed.url, function(err, entries) {

					for(var i=0; i<entries.length; ++i) {
						topics.post(1, entries[i].title, entries[i].content, feed.category, function(err, result) {

						});
					}

					next(err);
				});
			}

			async.each(feeds, get, function(err) {
				console.log('done posting feeds');
			});
		});
	};


	function getFeedByGoogle(feedUrl, callback) {
		request('http://ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=1&q=' + encodeURIComponent(feedUrl), function (err, response, body) {

			if (!err && response.statusCode == 200) {

				var p = JSON.parse(body);

				var entryData = p.responseData.feed.entries[0];
				var entry = {
					title: entryData.title,
					content: entryData.content,
					author: entryData.author,
					publishedDate: entryData.publishedDate,
					link: entryData.link
				}
				callback(null, [entry]);
			} else {
				callback(err);
			}
		});
	}

	//24 hours
	//new cron('0 0 * * *', pullFeeds, null, true);
	//every minute
	console.log('starting cron');
	new cron('* * * * *', pullFeeds, null, true);


	var admin = {};

	admin.menu = function(custom_header, callback) {
		custom_header.plugins.push({
			"route": '/plugins/rss',
			"icon": 'icon-edit',
			"name": 'RSS'
		});

		return custom_header;
	};


	admin.getFeeds = function(callback) {
		db.getSetMembers('nodebb-plugin-rss:feeds', function(err, feeds) {
			console.log(feeds);
			if(err) {
				return callback(err);
			}

			function getFeed(key, next) {
				db.getObject('nodebb-plugin-rss:feed:' + key, next);
			}

			async.map(feeds, getFeed, function(err, results) {
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
						console.log('returning ', feeds);
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
					console.log('BESSSST', req.body.feeds);
					if(!req.body.feeds) {
						return callback({message:'no-feeds-to-save'});
					}

					deleteFeeds(function(err) {
						if(err) {
							return res.json(500, {message: err.message});
						}

						console.log('OPPA', req.body.feeds);
						saveFeeds(req.body.feeds, function(err) {
							if(err) {
								return res.json(500, {message: err.message});
							}
							callback({});
						});
					});
				}
			});

			callback(null, custom_routes);
		});
	};

	admin.activate = function(id) {
		if (id === 'nodebb-plugin-rss') {

		}
	};

	module.admin = admin;

}(module.exports));


