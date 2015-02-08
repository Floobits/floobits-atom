/*jslint nomen: true, todo: true */
"use strict";

var flux = require("flukes"),
  _ = require('lodash'),
  util = require('util');

var BUFFER_TO_FLOOBITS = {
  DidSave: "saved",
  DidChangePath: "changed_path",
  DidChange: "changed",
  DidStopChanging: "stopped_changing"
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
    var self = this;

    function addEditorListener(id, editor, type, editorEvent, actionName) {
      var action;
      try {
        action = self[actionName].bind(self, editor);
        self.disposables_[id][type].push(editor["on" + editorEvent](action));
      } catch(e) {
        debugger;
      }

    }

    self.observeTextEditors = atom.workspace.observeTextEditors(function (editor) {
      var buffer = editor.getBuffer(),
        id = ++self.editorID_;

      self.disposables_[id] = {buffer: [], editor: []};

      _.each(EDITOR_TO_FLOOBITS, function (a, f) {
        addEditorListener(id, editor, "editor", f, a);
      });

      self.disposables_[id].editor.push(editor.onDidDestroy(function () {
        self.onDestroy_(id, "editor", editor);
      }));

      self.editor_created(editor);

      // TODO: remove these
      if (buffer.floobits_id) {
        return;
      }

      buffer.floobits_id = id;

      _.each(BUFFER_TO_FLOOBITS, function (a, f) {
        addEditorListener(id, buffer, "buffer", f, a);
      });

      self.disposables_[id].buffer.push(editor.onDidDestroy(function () {
        self.onDestroy_(id, "buffer", buffer);
      }));

      self.buffer_created(buffer);
    });
  },
  stop: function () {
    var self = this;

    if (this.observeTextEditors) {
      this.observeTextEditors.dispose();
      this.observeTextEditors = null;
    }

    _.each(this.disposables_, function (value, key) {
      self.onDestroy_(key, "buffer");
      self.onDestroy_(key, "editor");
    });

    this.disposables_ = {};
  },
  onDestroy_: function (id, type, obj) {
    this.disposables_[id][type].forEach(function (d) {
      d.dispose();
    });
    delete this.disposables_[id][type];
    if (type === "editor") {
      this.editor_destroyed(obj);
    } else {
      this.buffer_destroyed(obj);
    }
  },
  stopped_changing: function (editor) {
    return editor;
  },
  changed: function (editor, change) {
    console.log("changed");
    return [editor, change];
  },
  saved: function (editor) {
    console.log("saved");
    return editor;
  },
  changed_selection: function (editor) {
    return editor;
  },
  changed_cursor: function (editor) {
    return editor;
  },
  changed_path: function (editor) {
    return editor;
  },
  editor_created: function (editor) {
    return editor;
  },
  editor_destroyed: function (editor) {
    return editor;
  },
  buffer_created: function (buffer) {
    return buffer;
  },
  buffer_destroyed: function (buffer) {
    return buffer;
  }
});

module.exports = new Listener();
