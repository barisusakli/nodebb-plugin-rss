<!-- BEGIN feeds -->
<div class="row feed well">
		<div class="col-sm-12 col-xs-12">
			<div class="form-group">
				<label>Feed URL</label>
				<input type="text" class="form-control feed-url" placeholder="Enter the RSS feed URL" value="{feeds.url}">
			</div>
		</div>
		<br/>
		<div class="clearfix">
			<div class="col-sm-3 col-xs-12">
				<div class="form-group">
					<label>Category</label>
					<select class="form-control feed-category" data-category="{feeds.category}">

					</select>
				</div>
			</div>
			<div class="col-sm-9 col-xs-12">
				<div class="form-group">
					<label>Tags</label><br/>
					<input type="text" class="form-control feed-tags" placeholder="Tags for the topics" value="{feeds.tags}">
				</div>
			</div>
		</div>

		<div class="col-sm-3 col-xs-12">
			<div class="form-group">
				<label>User</label>
				<input type="text" class="form-control feed-user" placeholder="User to post as" value="{feeds.username}">
			</div>
		</div>
		<div class="col-sm-3 col-xs-12">
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

		<div class="col-sm-3 col-xs-12">
			<div class="form-group">
				<label>Topic Timestamp</label>
				<select class="form-control feed-topictimestamp" data-topictimestamp="{feeds.timestamp}">
					<option value="now">Now</option>
					<option value="feed">Feed Publish Time</option>
				</select>
			</div>
		</div>

		<div class="col-sm-3 col-xs-12">
			<div class="form-group">
				<label>&nbsp;</label>
				<button class="form-control remove btn-warning">Remove</button>
			</div>
		</div>

		<input type="hidden" class="form-control feed-lastEntryDate" value="{feeds.lastEntryDate}">
	</div>
	<!-- END feeds -->