/* @flow weak */
/*global StringView */
"use strict";

var Buffer, Buffers,
  flux = require("flukes"),
  utils = require("../utils"),
  prefs = require("./userPref_model"),
  _ = require("lodash"),
  path = require("path"),
  floop = require("./floop"),
  editorAction = require("./editor_action"),
  bufferAction = require("./buffer_action"),
  // messageAction = require("./message_action"),
  FlooDMP = require("../floodmp").FlooDMP,
  dmp = new FlooDMP(),
  fields = flux.FieldTypes;

/**
 * @param {number} id
 * @param {string} owner
 * @param {string} workspace
 */
function guid(id, owner, workspace) {
  return owner + "/" + workspace + "/" + id;
}


/**
 * @param {Object} data
 * @param {number} id
 * @param {string} owner
 * @param {string} workspace
 * @constructor
 */

Buffer = flux.createModel({
  modelName: "Buffer",
  fieldTypes: {
    buf: fields.string,
    highlights: fields.array,
    id: fields.number,
    md5: fields.number,
    open: fields.bool,
    path: fields.string,
    visible: fields.bool,
    encoding: fields.string,
    populated: fields.bool,
  },
  getDefaultFields: function () {
    return {
      buf: null,
      encoding: "utf8",
    };
  },
});


Buffer.prototype.abs_path = function() {
  return utils.to_abs_path(fl.base_path, this.path);
};

Buffer.prototype.setGetBufTimeout = function () {
  var id = this.id;
  this.strike_timeout = setTimeout(function () {
    console.log("strikeout triggered because before md5s were different");
    floop.send_get_buf(id);
  }, 1100);
};

Buffer.prototype.setSaveBufTimeout = function () {
  var id = this.id;
  clearTimeout(this.saveTimeout);
  this.saveTimeout = setTimeout(function () {
    floop.send_save_buf({id: id});
  }, 2500);
};

Buffer.prototype.send_patch = function (newTextPointer) {
  var patches, patchInfo, newTxt;

  if (!this.populated) {
    return;
  }
  
  newTxt = newTextPointer[0];

  patches = dmp.patch_make(this.buf, newTxt);
  
  if (patches.length === 0) {
    return;
  }

  patchInfo = {
    md5_before: this.md5,
    md5_after: utils.md5(newTxt),
    id: this.id,
    patch: dmp.patch_toText(patches)
  };

  this.set({buf: newTxt, md5: patchInfo.md5}, {silent: true});
  prefs.pauseFollowMode(2000);
  floop.send_patch(patchInfo);
};

Buffer.prototype.patch = function (patch_obj) {
  var self = this,
    buf,
    clean_patch = true,
    newTextPointer,
    i,
    md5_before,
    md5_after,
    patches,
    r,
    result,
    text,
    following;

  try {
    patches = dmp.patch_fromText(patch_obj.patch);
  } catch (e) {
    throw new Error("Received Invalid bytes from workspace." + e.toString() + "Patch was: " + patch_obj.patch);
  }

  console.debug("applying", patch_obj.patch, "to", patch_obj.path);
  // this.sidebar.userlist.setClientPath(patch_obj.user_id, patch_obj.path, patch_obj.id);
  // self.showEditorIfFollowing(patch_obj.user_id);

  md5_before = utils.md5(this.buf);
  if (patch_obj.md5_before !== md5_before) {
    console.log("starting md5s don't match! ours:", md5_before, "patch's:", patch_obj.md5_before);
  }
  if (_.isEmpty(patches)) {
    console.log("Got an empty set of patches.");
    return;
  }
  try {
    result = dmp.patch_apply(patches, this.buf);
  } catch (e) {
    console.sError("Patch apply error on web.",
      {
        patch: patches,
        buf: this.buf,
        result: result,
        subject: "Patch Apply Failed ",
        error: e,
        message: { description: "Patch apply failed"},
      }
    );
    throw e; //Continue to throw since it's already broken anyway.
  }
  text = result[0];
  for (i = 0; i < result[1].length; i++) {
    if (result[1][i] !== true) {
      clean_patch = false;
      break;
    }
  }
  if (clean_patch === false) {
    // XXX: don't reset this. ask the server to merge/rebase/whatever
    console.error("Couldn't apply patch. Getting buffer from server...", result);
    // messageAction.log("Couldn't apply patch to buffer " + this.path + " Re-fetching buffer from server...");
    this.populated = false;
    clearTimeout(this.strike_timeout);
    floop.send_get_buf(this.id);
    return;
  }
  md5_after = utils.md5(text);

  if (patch_obj.md5_before === md5_before && patch_obj.md5_after !== md5_after) {
    // XXX: again, don't reset this. ask the server to merge/rebase/whatever
    console.log("md5's don't match! buffer is", md5_after, "but we expected", patch_obj.md5_after);
    this.populated = false;
    clearTimeout(this.strike_timeout);
    floop.send_get_buf(this.id);
    return;
  }
  newTextPointer = [text];

  if (this.buf === text) {
    clearTimeout(this.strike_timeout);
    if (patch_obj.md5_after !== md5_after) {
      this.setGetBufTimeout();
    }
  } else if (patch_obj.md5_before !== md5_before) {
    clearTimeout(this.strike_timeout);
    this.setGetBufTimeout();
  } else {
    console.log("replacing didn't match :( should be", text, "but was", this.buf);
    try {
      console.log(dmp.patch_toText(dmp.patch_make(this.buf, text)));
    } catch (e) {
      console.log("Error making patch of text --> this.buf:", e);
    }
  }
  return newTextPointer;
};

Buffers = flux.createCollection({
  modelName: "Buffers",
  model: Buffer,
  paths_to_ids: {},
  getBufferByPath: function (p) {
    var id = this.paths_to_ids[p];
    if (!id) {
      return;
    }
    return this.get(id);
  },
  findFluffer: function(obj) {
    var p = obj.getRealPathSync ? obj.getRealPathSync() : obj.getPath();
    if (!p) {
      return;
    }
    
    p = path.relative(fl.base_path, p);

    if (p.indexOf("..") !== -1) {
      return;
    }

    return this.getBufferByPath(p);
  },
  init: function () {
    this.ids_ = [];
  },
  on_patch: function (data) {
    var buf = this.get(data.id);
    if (!buf) {
      return;
    }
    // this.setup_buf(buf);
    if (!buf.populated) {
      console.log("buf isn't populated. fetching");
      floop.send_get_buf(buf.id);
      return;
    }
    if (buf.encoding === "base64") {
      console.log("Floobits can't handle binary patches at the moment. Re-fetching.");
      floop.send_get_buf(buf.id);
      return;
    }
    var newTextPointer = buf.patch(data);
    if (!newTextPointer) {
      return;
    }
    buf.set({buf: newTextPointer[0], silent: true});
    bufferAction.changed(buf);
  },
  on_saved: function (data) {
    var b = this.get(data.id);
    if (!data.populated) {
      return;
    }
    bufferAction.saved(b);
  },
  on_get_buf: function (data) {
    var b = this.get(data.id);
    data.populated = true;
    b.set(data, {silent: true});
    bufferAction.changed(b);
    clearTimeout(b.strike_timeout);
  },
  on_create_buf: function (buf) {
    this.add(buf);
    this.paths_to_ids[buf.path] = buf.id;
  },
  on_rename_buf: function (d) {
    var buf = this.get(d.id);
    var old_path = buf.path;
    delete this.paths_to_ids[old_path];
    buf.path = d.path;
    this.paths_to_ids[buf.path] = buf.id;
    bufferAction.rename(buf, old_path, d.path);
  },
  on_delete_buf: function (d) {
    var b = this.get(d.id);
    this.remove(b.id);
    delete this.paths_to_ids[d.path];
    bufferAction.remove(b, d.force);
  },
  add: function (d) {
    this.super_.prototype.add.call(this, d);
    this.paths_to_ids[d.path] = d.id;
    bufferAction.created(this.get(d.id));
  },
  start: function () {
    this.ids_.push(floop.onPATCH(this.on_patch, this));
    this.ids_.push(floop.onGET_BUF(this.on_get_buf, this));
    this.ids_.push(floop.onSAVED(this.on_saved, this));
    this.ids_.push(floop.onDELETE_BUF(this.on_delete_buf, this));
    this.ids_.push(floop.onCREATE_BUF(this.on_create_buf, this));
    this.ids_.push(floop.onRENAME_BUF(this.on_rename_buf, this));
  },
  stop: function () {
    _.each(this.ids_, function (id) {
      floop.off(id);
    });
  }
});

module.exports = {
  Buffer: Buffer,
  Buffers: Buffers,
};
