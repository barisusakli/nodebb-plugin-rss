

var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	cron = require('cron').CronJob,
	db = module.parent.require('./database'),
	templates = module.parent.require('./../public/src/templates'),
	meta = module.parent.require('./meta');

(function(module) {

	//24 hours
	//new cron('0 0 * * *', Notifications.prune, null, true);
	module.pullFeeds = function(cutoff) {
		console.log('cron run : ', cutoff);
	};


	//every minute
	console.log('starting cron');
	new cron('* * * * *', module.pullFeeds, null, true);


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
			if(err) {
				return callback(err);
			}

			function getFeed(key, next) {
				db.getObject(key, next);
			}

			async.each(feeds, getFeed, function(err, results) {
				if(err) {
					return callback(err);
				}
				if(results) {
					console.log(results);
					callback(null, results);
				} else {
					callback(null, []);
				}
			});
		});
	}

	admin.route = function(custom_routes, callback) {
		fs.readFile(path.join(__dirname, 'public/templates/admin.tpl'), function(err, tpl) {

			admin.getFeeds(function(err, feeds) {
				if(err) {
					return callback();
				}
				var newTpl = templates.prepare(tpl.toString()).parse({feeds:feeds});
				console.log('OPPA', newTpl);

				custom_routes.routes.push({
					route: '/plugins/rss',
					method: 'get',
					options: function(req, res, callback) {
						callback({
							req: req,
							res: res,
							route: '/plugins/rss',
							name: 'Rss',
							content: newTpl
						});
					}
				});

				custom_routes.api.push({
					route: '/plugins/rss/save',
					method: 'post',
					options: function(req, res, callback) {
						callback({
							req: req,
							res: res,
							route: '/plugins/rss',
							name: 'Rss',
							content: newTpl
						});
					}
				});

				callback(null, custom_routes);
			});

		});
	};

	admin.activate = function(id) {
		if (id === 'nodebb-plugin-rss') {

		}
	};

	module.admin = admin;

}(module.exports));


