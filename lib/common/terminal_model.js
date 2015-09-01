"use strict";

const _ = require("lodash");
const flux = require("flukes");

const Socket = require("./floop");
const editorAction = require("./editor_action");
const Terminal = require("./extern/term");

const TerminalModel = flux.createModel({
  modelName: "Terminal",
  fieldTypes: {
    id: flux.FieldTypes.number,
    term: flux.FieldTypes.object.ephemeral(),
    username: flux.FieldTypes.string,
    div: flux.FieldTypes.object.ephemeral(),
    title: flux.FieldTypes.string,
    deleted: flux.FieldTypes.bool.ephemeral(),
  }
});

const Terminals = flux.createCollection({
  model: TerminalModel,
  modelName: "Terminals",
  users: null,
  getTerm_: function (id) {
    var term = this.get(id);
    return term && term.term;
  },
  init: function (args, args2) {
    this.users = args2.users;

    editorAction.onCLOSE_TERM(function (term) {
      if (!term.deleted) {
        return;
      }
      this.remove(term.id);
      term.term.destroy();
    }, this);

    Socket.onCREATE_TERM(function (term) {
      var user = this.users.getByConnectionID(term.owner);
      this.addTerminal(term.id, term.term_name, term.size[0], term.size[1], user.id);
    }, this);

    Socket.onDELETE_TERM(function (data) {
      const term = this.get(data.id);
      if (!term || !term.term) {
        return;
      }
      term.term.write("\r\n   *** TERMINAL CLOSED ***   \r\n");
      term.deleted = true;
    }, this);

    Socket.onTERM_STDOUT(function (data) {
      var term = this.getTerm_(data.id);
      if (!term || !term.children) {
        return;
      }
      try {
        term.write(new Buffer(data.data, "base64").toString("utf-8"));
      } catch (e) {
        console.warn(e);
      }
    }, this);

    Socket.onUPDATE_TERM(function (data) {
      var term = this.getTerm_(data.id);
      console.log("update term", data);
      if (term && data.size) {
        term.resize(data.size[0], data.size[1]);
      }
    }, this);

    // XXX Clean this up.
    Socket.onSYNC(function (terms) {
      console.log("Attempting to sync...");
      _.each(terms, function (data, id) {
        var term = this.getTerm_(id);
        if (!term) {
          return;
        }
        term.resize(data.cols, data.rows);
      }, this);
    }, this);
  },
  addTerminal: function (id, title, cols, rows, username) {
    var div, term;
    id = parseInt(id, 10);
    term = new Terminal({
      cols: cols,
      rows: rows,
      title: title,
      handler: this.onData.bind(this, id)
    });
    div = document.createElement("div");
    term.open(div);
    term.id = id;
    term.title = title;
    term.deleted = false;
    this.add({id: id, term: term, username: username, div: div, title: title});
  },
  onData: function (id, data) {
    Socket.send_term_stdin({id: id, data: new Buffer(data).toString("base64")});
  }
});


module.exports = {
  Terminals: Terminals
};
