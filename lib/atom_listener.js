/*jslint nomen: true, todo: true */
"use babel";
"use strict";

var flux = require("flukes"),
  fs = require("fs-plus"),
  _ = require('lodash'),
  path = require("path"),
  prefs = require("./common/userPref_model"),
  DMP = require("diff_match_patch"),
  editorAction = require('./common/editor_action'),
  bufferAction = require('./common/buffer_action'),
  AtomRange = require("atom").Range,
  atomUtils = require("./atom_utils"),
  CompositeDisposable = require('atom').CompositeDisposable,
  util = require('util');

var floop = require("./common/floop"),
  utils = require("./utils");

var AtomListener = function (bufs, users) {
  this.bufs = bufs;
  this.users = users;
  this.editorID_ =  0;
  this.atomEditors = {};
  this.atomBuffers = {};
  this.disposables = null;
  this.send_patch_for = {};
  this.highlights = {};
  this.highlightToSend = null;
  this.lastHighlightReceived = null;
};

AtomListener.prototype.onDidChange = function (buffer, change) {
  console.log("changed");
  if (this.ignore_events) {
    return;
  }

  if (!buffer.floobitsID) {
    console.warn(buffer.getPath(), " is in project but not shared (and it changed).");
  }
  this.send_patch_for[buffer.floobitsID] = true;
};

AtomListener.prototype.onDidStopChanging = function (buffer) {
  if (!floop.connected || !this.send_patch_for[buffer.floobitsID]) {
    return;
  }

  this.send_patch_for[buffer.floobitsID] = false;

  const fluffer = this.bufs.get(buffer.floobitsID);

  if (!fluffer || !fluffer.populated) {
    return;
  }

  console.log("sending patch");

  if (this.highlightToSend) {
    floop.send_highlight(this.highlightToSend);
    this.highlightToSend = null;
  }

  fluffer.send_patch([buffer.getText()]);
};

AtomListener.prototype.onDidSave = function (buffer) {
  var fluffer = this.bufs.get(buffer.floobitsID);

  if (this.ignore_events || !fluffer || !fluffer.populated) {
    return;
  }

  floop.send_saved({id: fluffer.id});
};

AtomListener.prototype.onDidChangeSelectionRange = function (editor) {
  if (this.ignore_events) {
    return;
  }

  const fluffer = this.bufs.findFluffer(editor);
  if (!fluffer || !fluffer.populated) {
    return;
  }

  const ranges = atomUtils.rangeFromEditor(editor);

  const highlight = {
    'id': fluffer.id,
    'ping': false,
    'summon': false,
    'following': false,
    'ranges': ranges,
  };

  if (this.send_patch_for[fluffer.id]) {
    this.highlightToSend = highlight;
  } else {
    floop.send_highlight(highlight);
  }
};

AtomListener.prototype.onDidChangePath = function (buffer) {
  var isEditor = buffer.buffer,
    oldFluffer = this.bufs.get(buffer.floobitsID),
    fluffer = this.bufs.findFluffer(buffer),
    oldPath, floobitsID;

  if (oldFluffer) {
    oldPath = oldFluffer.path;
  }

  buffer.floobitsID = fluffer ? fluffer.id : -1;
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


AtomListener.prototype.bindTo_ = function (obj, events) {
  var that = this,
    disposables = new CompositeDisposable();

  _.each(events, function (eventName) {
    var d;

    function action () {
      var args = _.toArray(arguments);
      args.unshift(obj);
      that[eventName].apply(that, args);
    }
    disposables.add(obj[eventName](action));
  });

  disposables.add(obj.onDidDestroy(function () {
    delete obj.floobitsID;

    if (that.disposables) {
      that.disposables.remove(disposables);
    }

    try {
      disposables.dispose();
    } catch (e) {
      console.error(e);
    }
  }));

  this.disposables.add(disposables);
};

AtomListener.prototype.on_floobits_highlight = function (data) {
  var fluffer, editors, highlights = this.highlights;

  if (!data || _.size(data.ranges) === 0) {
    return;
  }

  fluffer = this.bufs.get(data.id);

  if (!fluffer || !fluffer.populated) {
    return;
  }

  var markers = highlights[data.username];
  if (markers) {
    markers.forEach(function (m) {
      try {
        m.destroy();
      } catch (e) {
        console.log(e);
      }
    });
    delete highlights[data.username];
  }
  
  editors = this.atomEditors[data.id] || [];
  this.atomEditors[data.id] = _.filter(editors, function (e) {
    return e.isAlive();
  });

  let following = prefs.isFollowing(data.username);

  if (!editors || !editors.length) {
    if (following) {
      atom.workspace.open(fluffer.abs_path()).done(function (editor) {
        this.on_floobits_highlight(data);
      }.bind(this));
    }
    return;
  }

  highlights[data.username] = [];

  var klass = "floobits-highlight-dark_" + utils.user_color(data.username);

  var toActivate = [];
  _.each(editors, function (editor) {
    var buffer, offsetIndex;

    buffer = editor.buffer;
    if (!buffer) {
      return;
    }

    if (!buffer.isAlive()) {
      console.log("dead buffer?!");
      return;
    }

    _.map(data.ranges, function (range) {
      return atomUtils.offsetToBufferRange(buffer, range[0], range[1]);
      // startRow = offsetIndex.totalTo(range[0], 'characters').rows;
      // colStart = range[0] - offsetIndex.totalTo(startRow, "rows").characters;
      // endRow   = offsetIndex.totalTo(range[1], 'characters').rows;
      // colEnd   = range[1] - offsetIndex.totalTo(endRow, "rows").characters;
      // if (startRow === endRow && colStart === colEnd) {
      //   line = buffer.lineForRow(endRow);
      //   if (line && line.length == colEnd) {
      //     colStart -= 1;
      //   } else {
      //     colEnd += 1;
      //   }
      // }
      // return new AtomRange([startRow, colStart], [endRow, colEnd]);
    }).forEach(function (r) {
      var marker;
      marker = editor.markBufferRange(r, {invalidate: 'never'});
      editor.decorateMarker(marker, {type: "highlight", class: klass});
      editor.decorateMarker(marker, {type: "line-number", class: klass});
      if (following) {
        editor.scrollToBufferPosition(r.start);
        toActivate.push(editor.id);
      }
      highlights[data.username].push(marker);
    });
  });
  this.lastHighlightReceived = data;

  var pane = atom.workspace.getActivePane();
  if (!pane || !toActivate || !following) {
    return;
  }

  let position = 0;
  _.each(pane.items, function (item) {
    if (_.contains(toActivate, item.id)) {
      pane.activateItemAtIndex(position);
    }
    position += 1;
  });
};

AtomListener.prototype.observeTextEditors = function (editor) {
  var p, fluffer, buffer, id, that = this;

  // bad stuff happens if we throw here
  try {
    that.bindTo_(editor, ["onDidChangeSelectionRange"]);
    
    fluffer = that.bufs.findFluffer(editor);

    if (!fluffer) {
      id = -1;
    } else {
      id = fluffer.id;
    }

    if (!(id in that.atomEditors)) {
      that.atomEditors[id] = [];
    }

    that.atomEditors[id].push(editor);
    let d = editor.onDidDestroy(function () {
      let editors = that.atomEditors[id] || [];
      that.atomEditors = editors.filter(function (e) {
        return e.id !== editor.id;
      });
      that.disposables.remove(d);
    });

    that.disposables.add(d);
    
    buffer = editor.getBuffer();
    // editors to buffers is many to one
    if (_.has(buffer, "floobitsID")) {
      return;
    }
    
    buffer.floobitsID = id;
    // TODO: maybe check to see if one is there first?
    that.atomBuffers[id] = buffer;
    
    let dispose = buffer.onDidDestroy(function () {
      delete that.atomBuffers[buffer.floobitsID];
      that.disposables.remove(dispose);
    });

    that.disposables.add(dispose);

    that.bindTo_(buffer, ["onDidChangePath", "onDidSave", "onDidStopChanging", "onDidChange"]);  
  } catch (e) {
    console.error(e);
  }
  
};

AtomListener.prototype.stop = function () {
  _.each(this.highlights, function (markers) {
    markers.forEach(function (m) {
      try {
        m.destroy();
      } catch (e) {
        console.log(e);
      }
    });
  });
  this.highlights = {};
  this.disposables.dispose();
  this.disposables = null;
  editorAction.off();
  bufferAction.off();
};

AtomListener.prototype.on_fluffer_changed = function (b, charPointer, patches) {
  var buffer = this.atomBuffers[b.id];

  if (!b.populated) {
    return;
  }

  this.ignore_events = true;

  try {
    if (!buffer || !buffer.isAlive()) {
      console.log("writing", b.path);
      fs.writeFileSync(b.abs_path(), charPointer[0], {encoding: b.encoding});
    } else {
      if (!patches) {
        buffer.setText(charPointer[0]);
      } else {
        console.log("updating", b.path);
        const checkpoint = buffer.createCheckpoint();
        _.each(patches[2], function (patch) {
          const offset = patch[0];
          const length = patch[1];
          const range = atomUtils.offsetToBufferRange(buffer, offset, offset+length);
          buffer.setTextInRange(range, patch[2]);
        });
        buffer.groupChangesSinceCheckpoint(checkpoint);
        charPointer[0] = buffer.getText();
      }
      if (b.shouldSave) {
        buffer.save();
        b.shouldSave = false;
      }
    }
  } catch (e) {
    console.error(e);
  }

  this.ignore_events = false;
};

AtomListener.prototype.start = function () {
  var that = this, d;

  this.disposables = new CompositeDisposable();

  // TODO: unbind these
  editorAction.onJUMP_TO_USER(function (username) {
    let data;
    if (username === "floobits") {
      data = this.lastHighlightReceived;
    } else {
      data = this.highlights[username];
    }
    if (!data) {
      return;
    }
    this.on_floobits_highlight(data);
  }, this);

  editorAction.onHANDLE_CONFLICTS(function (newFiles, different, missing) {
    if (_.isEmpty(newFiles) && _.isEmpty(different) && _.isEmpty(missing)) {
      return;
    }
    const View = require("./build/conflicts");
    const view = View({newFiles: newFiles, different: different, missing: missing});
    const wrapper = require("./react_wrapper");
    const conflicts = wrapper.create_node('conflicts', view, 
      {width: "100%", height: "100%", overflow: "auto"}
    );
    
    const P = require('../templates/pane');
    const p = new P("Floobits Conflicts", "", conflicts);
    atom.workspace.getActivePane().activateItem(p);
  });

  this.disposables.add(atom.workspace.observeTextEditors(this.observeTextEditors.bind(this)));

  floop.onHIGHLIGHT(this.on_floobits_highlight.bind(this));
  bufferAction.onDELETED(function (b, force) {
    // TODO: unbind 
    delete that.atomBuffers[b.id];
    if (!force) {
      return;
    }
    that.ignore_events = true;
    try {
      fs.unlinkSync(b.abs_path());
    } catch (e) {
      console.error(e);
    }
    that.ignore_events = false;
  });
  bufferAction.onSAVED(function (b) {
    const buffer = that.atomBuffers[b.id];
    that.ignore_events = true;
    try {
      if (buffer && buffer.isAlive()) {
        buffer.save();
      } else {
        fs.writeFileSync(b.abs_path(), b.buf, {encoding: b.encoding});
      }
    } catch (e) {
      console.error(e);
    }
    that.ignore_events = false;
  });
  bufferAction.onCHANGED(function () {
    that.on_fluffer_changed.apply(that, arguments);
  });
};

module.exports = AtomListener;
