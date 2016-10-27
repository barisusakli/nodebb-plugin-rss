<div class="col-lg-12">
<h1>RSS</h1>

<div class="form feeds">
<!-- IMPORT partials/feed.tpl -->
</div>

<button class="btn" id="addFeed">Add Feed</button>

<button class="btn btn-primary" id="save">Save</button>

<div class="checkbox">
	<label>
		<input id="collapseWhiteSpace" type="checkbox" <!-- IF settings.collapseWhiteSpace -->checked<!-- ENDIF settings.collapseWhiteSpace -->> Collapse Whitespace
	</label>
</div>
</div>

<input id="csrf_token" type="hidden" value="{csrf}" />

<script src="{config.relative_path}/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.min.js"></script>