/* @flow weak */
/*global _, StringView, Terminal */
"use strict";

var Terminals, TerminalModel,
  floop = require("../floop"),
  editorAction = require("./editor_action"),
  flux = require("flukes");

TerminalModel = flux.createModel({
  modelName: "Terminal",
  fieldTypes: {
    id: flux.FieldTypes.number,
    term: flux.FieldTypes.object.ephemeral(),
    username: flux.FieldTypes.string,
    div: flux.FieldTypes.object.ephemeral(),
    title: flux.FieldTypes.string,
  }
});

Terminals = flux.createCollection({
  model: TerminalModel,
  modelName: "Terminals",
  users: null,
  getTerm_: function (id) {
    var term = this.get(id);
    return term && term.term;
  },
  init: function (args, args2) {
    this.users = args2.users;

    floop.onCREATE_TERM(function (term) {
      var user = this.users.getByConnectionID(term.owner);
      this.addTerminal(term.id, term.term_name, term.size[0], term.size[1], user.id);
    }, this);

    floop.onDELETE_TERM(function (data) {
      var term = this.getTerm_(data.id);
      if (!term) {
        return;
      }
      editorAction.close_term(term.id);
      term.destroy();
      this.remove(data.id);
    }, this);

    floop.onTERM_STDOUT(function (data) {
      var term = this.getTerm_(data.id);
      if (!term || !term.children) {
        return;
      }
      try {
        term.write(StringView.makeFromBase64(data.data, "UTF-8").toString());
      } catch (e) {
        console.warn(e);
      }
    }, this);

    floop.onUPDATE_TERM(function (data) {
      var term = this.getTerm_(data.id);
      console.log("update term", data);
      if (term && data.size) {
        term.resize(data.size[0], data.size[1]);
      }
    }, this);

    // XXX Clean this up.
    floop.onSYNC(function (terms) {
      console.log('Attempting to sync...');
      _.each(terms, function(data, id) {
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
    this.add({id: id, term: term, username: username, div: div, title: title});
  },
  onData: function (id, data) {
    floop.send_term_stdin({id: id, data: new StringView(data).toBase64()});
  }
});


module.exports = {
  Terminals: Terminals
};
