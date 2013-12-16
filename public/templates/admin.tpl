<h1>RSS</h1>

<h3>Parser Options</h3>


<div id="feed-template" class="row hide">
	<div class="col-sm-4 col-xs-12">
		<div class="form-group">
			<label>Feed URL</label>
			<input type="text" class="form-control" placeholder="Enter the RSS feed URL" data-field="">
		</div>
	</div>
	<div class="col-sm-4 col-xs-12">
		<div class="form-group">
			<label>Category</label>
			<select class="form-control categories" data-field="">

			</select>
		</div>
	</div>
	<div class="col-sm-4 col-xs-12">
		<div class="form-group">
			<label>Interval</label>
			<select class="form-control" data-field="">
				<option value="60">1 Hour</option>
				<option value="720">12 Hours</option>
				<option value="1440">24 Hours</option>
			</select>
		</div>
	</div>
</div>

<form class="form feeds">
<!-- BEGIN feeds -->
	<div class="row">
		<div class="col-sm-4 col-xs-12">
			<div class="form-group">
				<label>Feed URL</label>
				<input type="text" class="form-control" placeholder="Enter the RSS feed URL" data-field="">
			</div>
		</div>
		<div class="col-sm-4 col-xs-12">
			<div class="form-group">
				<label>Category</label>
				<select class="form-control categories" data-field="">

				</select>
			</div>
		</div>
		<div class="col-sm-4 col-xs-12">
			<div class="form-group">
				<label>Interval</label>
				<select class="form-control" data-field="">
					<option value="60">1 Hour</option>
					<option value="720">12 Hours</option>
					<option value="1440">24 Hours</option>
				</select>
			</div>
		</div>
	</div>
<!-- END feeds -->
</form>

<button class="btn btn-lg" id="addFeed">Add Feed</button>

<button class="btn btn-lg btn-primary" id="save">Save</button>

<script type="text/javascript">
	require(['forum/admin/settings'], function(Settings) {


		socket.emit('api:categories.get', function(categories) {
			console.log(categories);
			// TODO: put the categories in the select
		});

		$('#addFeed').on('click', function() {
			var clone = $('#feed-template').clone();
			clone.removeClass('hide');
			$('.feeds').append(clone);
		});

		$('#save').on('click', function() {

		});

		//Settings.prepare();
	});
</script>