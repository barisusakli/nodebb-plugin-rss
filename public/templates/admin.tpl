<h1>RSS</h1>


<div id="feed-template" class="row hide">
	<div class="col-sm-4 col-xs-12">
		<div class="form-group">
			<label>Feed URL</label>
			<input type="text" class="form-control feed-url" placeholder="Enter the RSS feed URL">
		</div>
	</div>
	<div class="col-sm-2 col-xs-12">
		<div class="form-group">
			<label>Category</label>
			<select class="form-control feed-category">

			</select>
		</div>
	</div>
	<div class="col-sm-2 col-xs-12">
		<div class="form-group">
			<label>User</label>
			<input type="text" class="form-control feed-user" placeholder="User to post as">
		</div>
	</div>

	<div class="col-sm-2 col-xs-12">
		<div class="form-group">
			<label>Interval</label>
			<select class="form-control feed-interval">
				<option value="60">1 Hour</option>
				<option value="720">12 Hours</option>
				<option value="1440">24 Hours</option>
				<option value="1">1 Minute</option>
			</select>
		</div>
	</div>
	<div class="col-sm-2 col-xs-12">
		<div class="form-group">
			<label>&nbsp;</label>
			<button class="form-control remove">Remove</button>
		</div>
	</div>

	<input type="hidden" class="form-control feed-lastEntryDate" value="0">
</div>

<form class="form feeds">
<!-- BEGIN feeds -->
	<div class="row feed">
		<div class="col-sm-4 col-xs-12">
			<div class="form-group">
				<label>Feed URL</label>
				<input type="text" class="form-control feed-url" placeholder="Enter the RSS feed URL" value="{feeds.url}">
			</div>
		</div>
		<div class="col-sm-2 col-xs-12">
			<div class="form-group">
				<label>Category</label>
				<select class="form-control feed-category" data-category="{feeds.category}">

				</select>
			</div>
		</div>
		<div class="col-sm-2 col-xs-12">
			<div class="form-group">
				<label>User</label>
				<input type="text" class="form-control feed-user" placeholder="User to post as" value="{feeds.username}">
			</div>
		</div>
		<div class="col-sm-2 col-xs-12">
			<div class="form-group">
				<label>Interval</label>
				<select class="form-control feed-interval" data-interval="{feeds.interval}">
					<option value="60">1 Hour</option>
					<option value="720">12 Hours</option>
					<option value="1440">24 Hours</option>
					<option value="1">1 Minute</option>
				</select>
			</div>
		</div>
		<div class="col-sm-2 col-xs-12">
			<div class="form-group">
				<label>&nbsp;</label>
				<button class="form-control remove">Remove</button>
			</div>
		</div>

		<input type="hidden" class="form-control feed-lastEntryDate" value="{feeds.lastEntryDate}">
	</div>
<!-- END feeds -->
</form>

<button class="btn btn-lg" id="addFeed">Add Feed</button>

<button class="btn btn-lg btn-primary" id="save">Save</button>

<script type="text/javascript">
	require(['forum/admin/settings'], function(Settings) {
		var categories = null;

		function addOptionsToAllSelects() {
			$('.form-control.feed-category').each(function(index, element) {
				addOptionsToSelect($(element));
			});
		}

		function addOptionsToSelect(select) {
			for(var i=0; i<categories.length; ++i) {
				select.append('<option value=' + categories[i].cid + '>' + categories[i].name + '</option>');
			}
		}


		socket.emit('api:categories.get', function(data) {
			categories = data.categories;
			addOptionsToAllSelects();

			$('.feed-interval').each(function(index, element) {
				$(element).val($(element).attr('data-interval'));
			});

			$('.feed-category').each(function(index, element) {
				$(element).val($(element).attr('data-category'));
			});

		});

		$('#addFeed').on('click', function() {
			var clone = $('#feed-template').clone();
			clone.removeClass('hide').addClass('feed');
			$('.feeds').append(clone);
			return false;
		});

		$('.feeds').on('click', '.remove', function() {
			$(this).parents('.feed').remove();
			return false;
		});

		$('#save').on('click', function() {

			var feedsToSave = [];

			$('.feed').each(function(index, child) {
				child = $(child);

				var feed = {
					url : child.find('.feed-url').val(),
					category : child.find('.feed-category').val(),
					interval : child.find('.feed-interval').val(),
					username: child.find('.feed-user').val(),
					lastEntryDate: child.find('.feed-lastEntryDate').val(),
				};

				if(feed.url) {
					feedsToSave.push(feed);
				}

			});

			$.post('/api/admin/plugins/rss/save', {_csrf : $('#csrf_token').val(), feeds : feedsToSave}, function(data) {
				app.alert({
					title: 'Success',
					message: data.message,
					type: 'success',
					timeout: 2000
				});
			});
			return false;

		});

		$('.feed-user').autocomplete({
			source: function(request, response) {
				socket.emit('api:admin.user.search', request.term, function(err, results) {
					results = results.map(function(user) { return user.username });
					response(results);
					$('.ui-autocomplete a').attr('href', '#');
				});
			}
		});

	});
</script>