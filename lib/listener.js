var flux = require("flukes"),
  _ = require('lodash'),
  util = require('util');

var ATOM_TO_FLOOBITS = {
  DidSave: "saved",
  DidChangeSelectionRange: "changed_selection",
  DidChangeCursorPosition: "changed_cursor",
  DidChangePath: "changed_path",
  DidStopChanging: "changed",
};

var Listener = flux.createActions({
  editorID_: 0,
  disposables_: {},
  start: function ( ) {
    var self = this,
      id = this.editorID_++;

    this.disposables_[id] = [];

    function addEditorListener(editor, editorEvent, actionName) {
      var action = self[actionName].bind(self, editor);
      self.disposables_[id].push(editor["on" + editorEvent](action));
    }

    self.disposables_[id].push(atom.workspace.observeTextEditors(function (editor) {
      _.each(ATOM_TO_FLOOBITS, function (a, f) {
        addEditorListener(editor, f, a);
      });
      self.disposables_[id].push(editor.onDidDestroy(function () {
        self.onDestroy_(id);
      }));
    }));
  },
  stop: function () {
    var self = this;

    _.each(this.disposables_, function (value, key) {
      self.onDestroy_(id);
    })

    this.disposables_ = {};
  },
  onDestroy_: function (id) {
    this.disposables_[id].forEach(function (d) {
      d.dispose();
    });
    delete this.disposables_[id];
  },
  changed: function (editor) {
    console.log("changed", editor);
    return editor;
  },
  saved: function (editor) {
    console.log("saved", editor);
    return editor;
  },
  changed_selection: function (editor) {
    console.log("changed_selection", editor);
    return editor;
  },
  changed_cursor: function (editor) {
    console.log("changed_cursor", editor);
    return editor;
  },
  changed_path: function (editor) {
    console.log("changed_path", editor);
    return editor;
  },
});

module.exports = new Listener();
