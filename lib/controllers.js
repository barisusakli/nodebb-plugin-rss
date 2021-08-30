'use strict';

const database = require('./database');


const Controllers = {};

Controllers.renderAdmin = async function renderAdmin(req, res, next) {
	try {
		const feeds = await database.getFeeds();

		res.render('admin/plugins/rss', {
			feeds: feeds,
			csrf: req.csrfToken(),
		});
	} catch (err) {
		next(err);
	}
};

Controllers.save = async function save(req, res, next) {
	try {
		await database.deleteFeeds();
		await database.saveFeeds(req.body.feeds);
		res.json({ message: 'Feeds saved!' });
	} catch (err) {
		return next(err);
	}
};

module.exports = Controllers;
