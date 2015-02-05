/*jslint nomen: true, todo: true */
"use strict";

var flux = require("flukes"),
  _ = require('lodash'),
  util = require('util');

var BUFFER_TO_FLOOBITS = {
  DidSave: "saved",
  DidChangePath: "changed_path",
  DidStopChanging: "changed",
};

var EDITOR_TO_FLOOBITS = {
  DidChangeSelectionRange: "changed_selection",
  DidChangeCursorPosition: "changed_cursor",
};

var Listener = flux.createActions({
  editorID_: 0,
  disposables_: {},
  observeTextEditors: null,
  start: function () {
    var self = this,
      id = this.editorID_++;

    this.disposables_[id] = {buffer: [], editor: []};

    function addEditorListener(editor, type, editorEvent, actionName) {
      var action = self[actionName].bind(self, editor);
      self.disposables_[id][type].push(editor["on" + editorEvent](action));
    }

    self.observeTextEditors = atom.workspace.observeTextEditors(function (editor) {
      var buffer = editor.getBuffer();

      _.each(EDITOR_TO_FLOOBITS, function (a, f) {
        addEditorListener(editor, "editor", f, a);
      });

      self.disposables_[id].editor.push(editor.onDidDestroy(function () {
        self.onDestroy_(id, "editor");
      }));

      // TODO: remove these
      if (buffer.floobits_id) {
        return;
      }

      buffer.floobits_id = id;

      _.each(BUFFER_TO_FLOOBITS, function (a, f) {
        addEditorListener(buffer, "buffer", f, a);
      });

      self.disposables_[id].buffer.push(editor.onDidDestroy(function () {
        self.onDestroy_(id, "buffer");
      }));
    });
  },
  stop: function () {
    var self = this;

    this.observeTextEditors.dispose();

    _.each(this.disposables_, function (value, key) {
      self.onDestroy_(key, "buffer");
      self.onDestroy_(key, "editor");
    });

    this.disposables_ = {};
  },
  onDestroy_: function (id, type) {
    this.disposables_[id][type].forEach(function (d) {
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
