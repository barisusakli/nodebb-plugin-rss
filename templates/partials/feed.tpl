{{{ each feeds }}}
<div class="feed well border-bottom pb-3 my-3">
	<div class="mb-3">
		<label class="form-label">Feed URL</label>
		<input type="text" class="form-control feed-url" placeholder="Enter the RSS feed URL" value="{feeds.url}">
	</div>

	<div class="row mb-3">
		<div class="col-sm-4 col-12 d-flex flex-column gap-1">
			<label class="form-label">Category</label>
			<select class="form-control feed-category" data-category="{feeds.category}"></select>
		</div>
		<div class="col-sm-4 col-12 d-flex flex-column gap-1">
			<label class="form-label">Tags for topics</label>
			<div class="d-flex">
				<input type="text" class="form-control feed-tags" value="{feeds.tags}">
			</div>
		</div>
		<div class="col-sm-4 col-12">
			<label class="form-label">User</label>
			<input type="text" class="form-control feed-user" value="{feeds.username}">
		</div>
	</div>

	<div class="row">
		<div class="col-sm-3 col-12">
			<label class="form-label">Interval</label>
			<select class="form-control feed-interval" data-interval="{feeds.interval}">
				<option value="1">1 Minute</option>
				<option value="60">1 Hour</option>
				<option value="720">12 Hours</option>
				<option value="1440">24 Hours</option>
				<option value="2880">48 Hours</option>
				<option value="10080">1 week</option>
			</select>
		</div>

		<div class="col-sm-3 col-12">
			<label class="form-label"># Entries / Interval</label>
			<input type="text" class="form-control feed-entries-to-pull" placeholder="Number of entries to pull every interval" value="{feeds.entriesToPull}">
		</div>

		<div class="col-sm-3 col-12">
			<label class="form-label">Topic Timestamp</label>
			<select class="form-control feed-topictimestamp" data-topictimestamp="{feeds.timestamp}">
				<option value="now">Now</option>
				<option value="feed">Feed Publish Time</option>
			</select>
		</div>

		<div class="col-sm-3 col-12">
			<label class="form-label invisible"></label>
			<button class="btn remove btn-light form-control"><i class="fa fa-trash text-danger"></i> Remove</button>
		</div>
	</div>

	<input type="hidden" class="form-control feed-lastEntryDate" value="{feeds.lastEntryDate}">
</div>
{{{ end }}}