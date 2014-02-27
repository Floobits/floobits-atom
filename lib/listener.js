var events = require('events');

var Listener = function () {
  events.EventEmitter.call(this);
};

util.inherits(Listener, events.EventEmitter);

Listener.prototype.listen = function() {
  var self = this;
  atom.workspace.eachEditor(function(editor) {
    editor.on("contents-modified", self.emit.bind(self, "changed", editor));
    editor.buffer.on("destroyed", self.emit.bind(self, "destroyed", editor));
    editor.buffer.on("path-changed", self.emit.bind(self, "renamed", editor));
  });
};

Listener.prototype.stop = function() {};

module.exports = Listener;