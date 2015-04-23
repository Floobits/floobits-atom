"use strict";

var id = 0;
const _ = require("lodash");
const flux = require("flukes");

/**
 * @extends {flux.DataModel}
 * @constructor
 */
const Filetree = flux.createModel({
  modelName: "tree",
  fieldTypes: {
    id: flux.FieldTypes.number,
    tree: flux.FieldTypes.object,
  },
  getDefaultFields: function () {
    return {
      id: ++id,
    };
  },
  addBuf: function (buf) {
    var node = this.tree,
      paths = buf.path.split("/"),
      name = paths.pop();

    try {
      _.each(paths, function (p) {
        var n = node[p];
        if (!n) {
          n = {};
          node[p] = n;
        }
        node = n;
      });
      node[name] = buf.id;
    } catch (e) {
      console.error("Path conflict for", buf.path);
      return;
    }

    this.update();
  },
  removePath: function (bufPath) {
    var i, name,
      node = this.tree,
      paths = bufPath.split("/");

    name = paths.pop();
    for (i = 0; i < paths.length; i++) {
      node = node[paths[i]];
      if (!node) {
        console.error("Couldn't find filetree node for path", bufPath);
        return;
      }
    }
    delete node[name];
    if (!paths.length) {
      this.update();
      return;
    }
    if (_.size(node) === 0) {
      this.removePath(paths.join("/"));
      return;
    }
    this.update();
  }
});

Filetree.Event = {
  OPEN: "open"
};

module.exports = Filetree;
