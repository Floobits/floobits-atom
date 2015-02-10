/*jslint nomen: true, todo: true */
"use strict";

var flux = require("flukes"),
  _ = require('lodash'),
  path = require("path"),
  DMP = require("diff_match_patch"),
  util = require('util');

var floop = require("./common/floop"),
  utils = require("./utils");

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

var Listener = function (bufs, users) {
  this.bufs = bufs;
  this.users = users;
  this.editorID_ =  0;
  this.disposables_ =  {};
  this.observeTextEditors =  null;
  this.atomEditors = {};
  this.atomBuffers = {};
};

Listener.prototype.on_changed = function (editor, change) {
  console.log("changed");
  return [editor, change];
};

// on_documentChange: function (bufID, change, doc) {
//   var buf, patches, patchInfo, newTxt;

//   if (this.ignoreChanges) {
//     return;
//   }
//   buf = this.bufs.get(bufID);
//   if (!buf || !buf.populated) {
//     return;
//   }
//   newTxt = doc.getValue();
//   patches = dmp.patch_make(buf.buf, newTxt);
//   if (patches.length === 0) {
//     return;
//   }
//   patchInfo = {
//     // TODO: don't we have this?!!?
//     md5_before: util.md5(buf.buf),
//     md5_after: util.md5(newTxt),
//     // path: this.path,
//     id: buf.id,
//     patch: dmp.patch_toText(patches)
//   };

//   handlerAction.patch_buf(patchInfo);
//   buf.set({'buf': newTxt}, {silent: true});
//   prefs.pauseFollowMode(2000);

Listener.prototype.buffer_for_path = function (buffer_path) {
  var buf = null,
    relative = path.relative(this.base_path, buffer_path);

  if (!relative || relative.length === 0) {
    return null;
  }

  this.bufs.forEach(function (b, id) {
    if (b.path === relative) {
      buf = b;
      return false;
    }
  });
  return buf;
};

Listener.prototype.on_stopped_changing = function (editor) {
  var p,
    text,
    id,
    buf,
    patches,
    md5_before,
    patch_text,
    self = this,
    buffer_path = editor.getPath();

  if (!floop.connected_ || !this.send_patch_for[buffer.floobits_id]) {
    return;
  }

  console.log("really changed");

  p = path.relative(this.base_path, buffer_path);
  id = this.paths_to_ids[p];
  if (!id) {
    return;
  }

  this.send_patch_for[buffer.floobits_id] = false;

  buf = this.bufs[id];
  if (!buf.buf) {
    // TODO: get buf
    return;
  }
  text = buffer.getText();
  patches = DMP.patch_make(buf.buf.toString(), text);
  patch_text = DMP.patch_toText(patches);

  buf.buf = new Buffer(text);
  md5_before = buf.md5;
  buf.md5 = utils.md5(buf.buf);
  if (md5_before === buf.md5){
    return;
  }

  floop.send_patch({
    id: id,
    md5_after: buf.md5,
    md5_before: md5_before,
    path: buf.path,
    patch: patch_text
  });
};

Listener.prototype.on_saved = function (editor) {
  console.log("saved");
  return editor;
};

Listener.prototype.on_changed_selection = function (editor) {
  return editor;
};

Listener.prototype.on_changed_cursor = function (editor) {
  return editor;
};

Listener.prototype.on_changed_path = function (editor) {
  return editor;
};

Listener.prototype.on_editor_created = function (editor) {
  return editor;
};

Listener.prototype.on_editor_destroyed = function (editor) {
  return editor;
};

Listener.prototype.on_buffer_created = function (buffer) {
  return buffer;
};

Listener.prototype.on_buffer_destroyed = function (buffer) {
  return buffer;
};

Listener.prototype.start = function () {
  var that = this;
  function addEditorListener(id, editor, type, editorEvent, actionName) {
    var action = that["on_" + actionName].bind(that, editor);
    that.disposables_[id][type].push(editor["on" + editorEvent](action));
  }

  that.observeTextEditors = atom.workspace.observeTextEditors(function (editor) {
    var buffer, path, id;

    // failing here causes atom to hang
    try {
      buffer = editor.getBuffer();
      id = ++that.editorID_;

      that.disposables_[id] = {buffer: [], editor: []};

      _.each(EDITOR_TO_FLOOBITS, function (a, f) {
        addEditorListener(id, editor, "editor", f, a);
      });

      that.disposables_[id].editor.push(editor.onDidDestroy(function () {
        that.onDestroy_(id, "editor", editor);
      }));

      
      path = editor.getPath();
      if (path) {
        if (!(path in that.atomEditors)) {
          that.atomEditors[path] = [];
        }
        that.atomEditors[path].push(editor);
      }
    

      if (buffer.floobits_id) {
        return;
      }
    
      path = buffer.getPath();
      if (path) {
        that.atomBuffers[path] = buffer;
      }
      // TODO: remove these from buffers
      buffer.floobits_id = id;

      _.each(BUFFER_TO_FLOOBITS, function (a, f) {
        addEditorListener(id, buffer, "buffer", f, a);
      });

      that.disposables_[id].buffer.push(editor.onDidDestroy(function () {
        that.onDestroy_(id, "buffer", buffer);
      }));
    } catch (e) {
      console.error(e);
    }
  });
};

var ListenerActions = flux.createActions({
  editorID_: 0,
  disposables_: {},
  observeTextEditors: null,
  start: function (bufs, users) {
    var self = this;
    this.bufs = bufs;
    this.users = users;
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
