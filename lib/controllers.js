'use strict';

const database = require('./database');

const categories = require.main.require('./src/categories');

const Controllers = module.exports;

Controllers.renderAdmin = async function renderAdmin(req, res, next) {
	try {
		const [feeds, categories] = await Promise.all([
			database.getFeeds(),
			getCategories(req.uid),
		]);

		res.render('admin/plugins/rss', {
			title: 'RSS',
			feeds: feeds,
			categories,
			csrf: req.csrfToken(),
		});
	} catch (err) {
		next(err);
	}
};

async function getCategories(uid) {
	const cids = await categories.getCidsByPrivilege('categories:cid', uid, 'find');
	const categoriesData = await categories.getCategoriesData(cids);
	return categoriesData.filter(category => category && !category.disabled);
}

Controllers.save = async function save(req, res, next) {
	try {
		await database.deleteFeeds();
		await database.saveFeeds(req.body.feeds);
		res.json({ message: 'Feeds saved!' });
	} catch (err) {
		return next(err);
	}
};
