<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div id="spy-container" class="col-12 px-0 mb-4" tabindex="0">

			<div class="form feeds">
			<!-- IMPORT partials/feed.tpl -->
			</div>

			<button class="btn btn-sm btn-success" id="addFeed">Add Feed</button>
<!--
			<button class="btn btn-sm btn-primary" id="save">Save</button>
			-->
			<hr/>

			<h4>Test Feeds</h4>
			<p class="">
				You can check feed compatibility here, simply enter the feed and press the "Check" button.
				If you don't see any errors in the output, the feed is compatible.
			</p>
			<div class="d-flex gap-1 mb-3">
				<input id="test-feed-input" type="text" class="form-control" />
				<button id="checkFeed" class="btn btn-sm btn-primary">Check</button>
			</div>
			<div>
				<pre id="test-result" class="border" style="white-space: pre-wrap; white-space: -moz-pre-wrap; white-space: -pre-wrap; white-space: -o-pre-wrap;"></pre>
			</div>
		</div>
	</div>
</div>

<input id="csrf_token" type="hidden" value="{csrf}" />