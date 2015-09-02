"use strict";
const _ = require("lodash");
const Pane = require("../templates/pane");
const TerminalView = require("./terminal_view");
const editorAction = require("./common/editor_action");

function TerminalManager () {
  this.terminals = null;
  this.openTerminals = {};
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

  if (id in this.openTerminals) {
    const pane = this.openTerminals[id];
    const view = pane.getView()[0];
    pane.activePane.activateItem(pane);
    view.focus();
    return;
  }
  const view = new TerminalView();
  view.init(terminal);
  const pane = new Pane(`${terminal.username}-${terminal.title}`, "chevron-right", view, function () {
    delete pane.activePane;
    delete this.openTerminals[id];
  }.bind(this));
  const activePane = atom.workspace.getActivePane();
  activePane.activateItem(pane);
  pane.activePane = activePane;
  this.openTerminals[id] = pane;
};

module.exports = new TerminalManager();
