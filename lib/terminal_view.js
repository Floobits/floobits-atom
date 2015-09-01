"use strict";

const TerminalView = Object.create(HTMLElement.prototype);

TerminalView.createdCallback = function () {
};

TerminalView.init = function (terminal) {
  this.terminal = terminal;
};

TerminalView.attachedCallback = function () {
  this.appendChild(this.terminal.div);
};

TerminalView.detachedCallback = function () {
  this.destroy();
};

TerminalView.destroy = function () {
  if (!this.pane) {
    return;
  }
  try {
    this.pane.destroy();
  } catch (e) {
    console.warn(e);
  }
  this.pane = null;
};

module.exports = document.registerElement("floobits-terminal_view", {prototype: TerminalView});