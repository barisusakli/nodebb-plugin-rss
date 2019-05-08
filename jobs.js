'use strict';

var cron = require('cron').CronJob;
var winston = require.main.require('winston');
var nconf = require.main.require('nconf');
var plugins = require.main.require('./src/plugins');
var pubsub = require.main.require('./src/pubsub');

var pullFeedsInterval;

var cronJobs = [
	new cron('0 * * * * *', function () { pullFeedsInterval(1); }, null, false), // minute
	new cron('0 0 * * * *', function () { pullFeedsInterval(60); }, null, false), // hour
	new cron('0 0 0/12 * * *', function () { pullFeedsInterval(60 * 12); }, null, false), // 12 hours
	new cron('0 0 0 * * *', function () { pullFeedsInterval(60 * 24); }, null, false), // 24 hours
	new cron('0 0 0 */2 * *', function () { pullFeedsInterval(60 * 24 * 2); }, null, false), // 48 hours
	new cron('0 0 0 0 0 6', function () { pullFeedsInterval(60 * 24 * 7); }, null, false), // one week
];

var jobs = module.exports;
jobs.init = function (pullMethod) {
	pullFeedsInterval = pullMethod;
};

plugins.isActive('nodebb-plugin-rss', function (err, active) {
	if (err) {
		return winston.error(err.stack);
	}

	if (active) {
		reStartCronJobs();
	}
});

function reStartCronJobs() {
	if (nconf.get('runJobs')) {
		stopCronJobs();
		cronJobs.forEach(function (job) {
			job.start();
		});
	}
}

function stopCronJobs() {
	if (nconf.get('runJobs')) {
		cronJobs.forEach(function (job) {
			job.stop();
		});
	}
}

pubsub.on('nodebb-plugin-rss:deactivate', function () {
	stopCronJobs();
});
