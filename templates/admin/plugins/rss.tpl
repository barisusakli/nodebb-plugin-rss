<div class="col-lg-12">
	<h1>RSS</h1>

	<div class="form feeds">
	<!-- IMPORT partials/feed.tpl -->
	</div>

	<button class="btn" id="addFeed">Add Feed</button>

	<button class="btn btn-primary" id="save">Save</button>

	<hr/>

	<h4>Test Feeds</h4>
	<p class="">You can check feed compatibility here, simply enter the feed and press the "Check" button.
	If you don't see any errors in the output, the feed is compatible.
	</p>
	<input id="test-feed-input" type="text" class="form-control" /><br/>
	<button id="checkFeed" class="btn">Check</button><br/><br/>
	<pre id="test-result" style="white-space: pre-wrap; white-space: -moz-pre-wrap; white-space: -pre-wrap; white-space: -o-pre-wrap;"></pre>
</div>

<input id="csrf_token" type="hidden" value="{csrf}" />