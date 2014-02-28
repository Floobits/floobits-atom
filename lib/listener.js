var events = require('events'),
  util = require('util');

var Listener = function () {
  events.EventEmitter.call(this);
};

util.inherits(Listener, events.EventEmitter);

Listener.prototype.start = function() {
  var self = this;

  atom.workspace.eachEditor(function(editor) {
    var buffer = editor.buffer;
    buffer.on("changed", self.emit.bind(self, "changed", editor));
    buffer.on("destroyed", self.emit.bind(self, "destroyed", editor));
    buffer.on("path-changed", self.emit.bind(self, "renamed", editor));
  });
};

Listener.prototype.stop = function() {};

exports.Listener = Listener;