"use strict";
const _ = require("lodash");
const Pane = require("../templates/pane");
const TerminalView = require("./terminal_view");
const editorAction = require("./common/editor_action");

function TerminalManager () {
  this.terminals = null;
  this.openTerminals = [];
}

TerminalManager.prototype.start = function(terminals) {
  this.terminals = terminals;
  const that = this;

  editorAction.onOPEN_TERM(that.addTerminal.bind(that));

  that.terminals.on(function () {
    that.terminals.forEach(function (t) {
      that.addTerminal(t);
    });
  });
};

TerminalManager.prototype.addTerminal = function(terminal) {
  const id = terminal.id;
  if (_.contains(this.openTerminals, id)) {
    return;
  }
  const view = new TerminalView();
  view.init(terminal);
  const pane = new Pane(`${terminal.username}-${terminal.title}`, "chevron-right", view, function () {
    const index = this.openTerminals.indexOf(id);
    if (index == -1) {
      return;
    }
    this.openTerminals.splice(index, 1);
  }.bind(this));
  atom.workspace.getActivePane().activateItem(pane);
  this.openTerminals.push(id);
};

module.exports = new TerminalManager();
