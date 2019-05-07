'use strict';

var Widget = module.exports;

var app;

Widget.init = function (_app) {
    app = _app;
};

Widget.defineWidgets = function(widgets, callback) {
    var widget = {
        widget: "rss",
        name: "RSS",
        description: "RSS entries from a feed",
        content: 'admin/widget/rss'
    };
    if (!app) {
        return setImmediate(callback, null, widgets);
    }

    app.render(widget.content, {}, function(err, html) {
        if (err) {
            return callback(err);
        }
        widget.content = html;
        widgets.push(widget);
        callback(null, widgets);
    });
};

Widget.render = function (widget, callback) {
    console.log(widget);
    widget.html = 'bam';
    callback(null, widget);
};
