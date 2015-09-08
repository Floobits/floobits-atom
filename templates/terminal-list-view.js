/** @jsx React.DOM */
"use strict";

const React = require("react-atom-fork");
const flux = require("flukes");
const editorAction = require("../common/editor_action");

module.exports = React.createClass({
  mixins: [flux.createAutoBinder(["terminals"])],
  onMouseDown: function (tty, e) {
    editorAction.open_term(tty);
  },
  render: function () {
    return (
      <div className="header">
        <span className=""><img src="atom://floobits/resources/icon_64x64.png" />terminals</span>
        <ul onMouseDown={this.onMouseDown}>
          {this.props.terminals.map(function (t) {
            return <li onMouseDown={this.onMouseDown.bind(this, t.id)} >tty-{t.username}</li>;
          }.bind(this))}
        </ul>
      </div>
    );
  }
});
