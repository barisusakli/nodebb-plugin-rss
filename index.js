

var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	cron = require('cron').CronJob,
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


	admin.route = function(custom_routes, callback) {
		fs.readFile(path.join(__dirname, 'public/templates/admin.tpl'), function(err, tpl) {
//console.log(tpl.toString());
			var newTpl = templates.prepare(tpl).parse([]);
console.log('OPPA', newTpl);

			custom_routes.routes.push({
				route: '/plugins/rss',
				method: "get",
				options: function(req, res, callback) {
					callback({
						req: req,
						res: res,
						route: '/plugins/rss',
						name: 'Rss',
						content: tpl
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


