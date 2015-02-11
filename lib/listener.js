/*jslint nomen: true, todo: true */
"use strict";

var flux = require("flukes"),
  _ = require('lodash'),
  path = require("path"),
  prefs = require("./common/userPref_model"),
  DMP = require("diff_match_patch"),
  util = require('util');

var floop = require("./common/floop"),
  utils = require("./utils");

var Listener = function (bufs, users) {
  this.bufs = bufs;
  this.users = users;
  this.editorID_ =  0;
  this.disposables_ =  {};
  this.observeTextEditors =  null;
  this.atomEditors = {};
  this.atomBuffers = {};
};

Listener.prototype.onDidChange = function (buffer, change) {
  console.log("changed");
  if (this.ignore_events) {
    return;
  }

  if (!buffer.floobits_id) {
    console.warn(buffer.getPath(), " is in project but not shared (and it changed).");
  }
  this.send_patch_for[buffer.floobits_id] = true;
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


Listener.prototype.onDidStopChanging = function (buffer) {
  var p,
    text,
    fluffer,
    patches,
    md5_before,
    patch_text;

  if (!floop.connected || !this.send_patch_for[fluffer.id]) {
    return;
  }

  var patchInfo, newTxt;

  fluffer = this.bufs.get(buffer.flufferID);

  if (!fluffer || !fluffer.populated) {
    return;
  }
  
  newTxt = buffer.getText();
  patches = DMP.patch_make(fluffer.buf, newTxt);
  
  if (patches.length === 0) {
    return;
  }

  patchInfo = {
    md5_before: fluffer.md5,
    md5_after: util.md5(newTxt),
    id: fluffer.id,
    patch: DMP.patch_toText(patches)
  };

  fluffer.set({buf: newTxt, md5: patchInfo.md5}, {silent: true});
  prefs.pauseFollowMode(2000);

  console.log("really changed");

  this.send_patch_for[fluffer.id] = false;

  floop.send_patch(patchInfo);
};

Listener.prototype.onDidSave = function (buffer) {
  var self = this,
    fluffer = this.bufs[buffer.flufferID];

  if (self.ignore_events || !fluffer || !fluffer.populated) {
    return;
  }

  floop.send_saved({id: fluffer.id});
};

Listener.prototype.onDidChangeSelectionRange = function (editor) {
  var range, start, end,
    fluffer = this.bufs[editor.flufferID],
    selections = editor.selections;

  if (selections.length <= 0) {
    return;
  }

  if (!fluffer || !fluffer.populated) {
    return;
  }

  floop.send_highlight({
    'id': fluffer.id,
    'ping': false,
    'summon': false,
    'following': false,
    'ranges': _.map(selections, function (selection){
      var range = selection.getBufferRange(),
        start = editor.buffer.characterIndexForPosition(range.start),
        end = editor.buffer.characterIndexForPosition(range.end);
      return [start, end];
    })
  });
};

Listener.prototype.onDidChangeCursorPosition = function (editor) {
  return editor;
};

Listener.prototype.onDidChangePath = function (editorOrBuffer) {
  var isEditor = editorOrBuffer.buffer,
    oldFluffer = this.bufs[editorOrBuffer.flufferID],
    fluffer = this.findFluffer(editorOrBuffer),
    oldPath, flufferID;

  if (oldFluffer) {
    oldPath = oldFluffer.path;
  }

  editorOrBuffer.flufferID = fluffer ? fluffer.id : -1;
  if (isEditor) {
    return;
  }

  if (oldPath) {
    // TODO: send event
    return;
  }
  if (fluffer) {
    // TODO: check to see if its shared 

  }
};

Listener.prototype.bindTo_ = function (obj, events) {
  var that = this,
    disposables = [],
    path = obj.getPath();

  // TODO: store the disposables somewhere ...

  _.each(events, function (eventName) {
    var d;

    function action () {
      var args = _.toArray(arguments);
      args.unshift(obj);
      that["on" + eventName].apply(that, args);
    }
    d = obj.on(eventName, action);
    disposables.push(d);
  });

  obj.onDidDestroy(function () {
    _.each(disposables, function (d) {
      d.dispose();
    });
    delete obj.flufferID;
  });
};

Listener.prototype.findFluffer = function(obj) {
  var p = path.relative(fl.base_path, obj.getPath());
  return this.bufs.getBufferByPath(p);
};

Listener.prototype.start = function () {
  var that = this;
  
  that.observeTextEditors = atom.workspace.observeTextEditors(function (editor) {
    var p, fluffer, buffer, id;

    that.bindTo_(editor, ["DidChangePath", "DidChangeSelectionRange", "DidChangeCursorPosition"]);
    
    // TODO: store reverse mapping
    // TODO: 
    fluffer = that.findFluffer(editor);

    id = fluffer ? fluffer.id : -1;
    editor.flufferID = id;

    buffer = editor.getBuffer();
    // editors to buffers is many to one
    if (_.has(buffer, "flufferID")) {
      return;
    }
    
    buffer.flufferID = id;

    that.bindTo_(buffer, ["DidChangePath", "DidSave", "DidStopChanging", "DidChange"]);
    if (!fluffer) {
      return;
    }
    fluffer.on(function (eventName, data) {
      console.log("buffer changed", eventName, data);
    });
  });
};

module.exports = Listener;
