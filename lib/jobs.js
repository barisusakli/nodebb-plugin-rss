'use strict';

const cron = require('cron').CronJob;

const winston = require.main.require('winston');
const nconf = require.main.require('nconf');
const plugins = require.main.require('./src/plugins');
const pubsub = require.main.require('./src/pubsub');


let pullFeedsInterval;

const cronJobs = [
	new cron('0 * * * * *', (() => { pullFeedsInterval(1); }), null, false), // minute
	new cron('0 0 * * * *', (() => { pullFeedsInterval(60); }), null, false), // hour
	new cron('0 0 0/12 * * *', (() => { pullFeedsInterval(60 * 12); }), null, false), // 12 hours
	new cron('0 0 0 * * *', (() => { pullFeedsInterval(60 * 24); }), null, false), // 24 hours
	new cron('0 0 0 */2 * *', (() => { pullFeedsInterval(60 * 24 * 2); }), null, false), // 48 hours
	new cron('0 0 0 0 0 6', (() => { pullFeedsInterval(60 * 24 * 7); }), null, false), // one week
];

const Jobs = {};

Jobs.init = function (pullMethod) {
	pullFeedsInterval = pullMethod;
};

plugins.isActive('nodebb-plugin-rss', (err, active) => {
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
		cronJobs.forEach((job) => {
			job.start();
		});
	}
}

function stopCronJobs() {
	if (nconf.get('runJobs')) {
		cronJobs.forEach((job) => {
			job.stop();
		});
	}
}

pubsub.on('nodebb-plugin-rss:deactivate', () => {
	stopCronJobs();
});

module.exports = Jobs;
