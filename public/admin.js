'use strict';

$(document).ready(function () {
	var categories = null;

	function addOptionsToAllSelects() {
		$('.form-control.feed-category').each(function (index, element) {
			addOptionsToSelect($(element));
		});
	}

	function addOptionsToSelect(select) {
		for (var i = 0; i < categories.length; ++i) {
			select.append('<option value=' + categories[i].cid + '>' + categories[i].name + '</option>');
		}
	}

	socket.emit('categories.get', function (err, data) {
		if (err) {
			console.log(err);
		}

		categories = data;
		addOptionsToAllSelects();

		$('.feed-interval').each(function (index, element) {
			$(element).val($(element).attr('data-interval'));
		});

		$('.feed-category').each(function (index, element) {
			$(element).val($(element).attr('data-category'));
		});

		$('.feed-topictimestamp').each(function (index, element) {
			$(element).val($(element).attr('data-topictimestamp'));
		});
	});

	require(['benchpress'], function (benchpress) {
		$('#addFeed').on('click', function () {
			benchpress.render('partials/feed', {
				feeds: [{
					url: '',
					category: '',
					username: '',
					tags: '',
					timestamp: 'now',
					lastEntryDate: 0,
					entriesToPull: 4,
				}],
			}).then(function (html) {
				var newFeed = $(html).appendTo('.feeds');
				enableAutoComplete(newFeed.find('.feed-user'));
				enableTagsInput(newFeed.find('.feed-tags'));
				addOptionsToSelect(newFeed.find('.feed-category'));
			});
			return false;
		});
	});

	require(['bootbox'], function (bootbox) {
		$('.feeds').on('click', '.remove', function () {
			var self = $(this);
			bootbox.confirm('Do you really want to remove this feed?', function (confirm) {
				if (confirm) {
					self.parents('.feed').remove();
				}
			});

			return false;
		});
	});

	function enableAutoComplete(selector) {
		require(['autocomplete'], function (autocomplete) {
			autocomplete.user(selector);
		});
	}

	function enableTagsInput(selector) {
		selector.tagsinput({
			maxTags: config.tagsPerTopic,
			confirmKeys: [13, 44],
		});
	}

	enableAutoComplete($('.feeds .feed-user'));
	enableTagsInput($('.feeds .feed-tags'));

	require(['api'], function (api) {
		$('#save').on('click', function () {
			var feedsToSave = [];

			$('.feed').each(function (index, child) {
				child = $(child);

				var feed = {
					url: child.find('.feed-url').val(),
					category: child.find('.feed-category').val(),
					interval: child.find('.feed-interval').val(),
					username: child.find('.feed-user').val(),
					entriesToPull: child.find('.feed-entries-to-pull').val(),
					tags: child.find('.feed-tags').val(),
					timestamp: child.find('.feed-topictimestamp').val(),
					lastEntryDate: child.find('.feed-lastEntryDate').val(),
				};

				if (feed.url) {
					feedsToSave.push(feed);
				}
			});

			api.post('/api/admin/plugins/rss/save', {
				_csrf: $('#csrf_token').val(),
				feeds: feedsToSave,
				settings: {},
			}, function (err, data) {
				if (err) {
					console.log(err);
				}
				app.alert({
					title: 'Success',
					message: data.message,
					type: 'success',
					timeout: 2000,
				});
			});
			return false;
		});

		$('#checkFeed').on('click', function () {
			$('#test-result').text('');
			$('#rendered-content').html('');
			api.get('/api/admin/plugins/rss/checkFeed', {
				url: $('#test-feed-input').val(),
			}, function (err, data) {
				if (err) {
					console.log(err);
				}
				$('#test-result').text(JSON.stringify(data, null, 4));
			});
			return false;
		});
	});
});
