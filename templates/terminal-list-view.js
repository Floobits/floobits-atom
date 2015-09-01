/** @jsx React.DOM */
"use strict";

const React = require("react-atom-fork");
const flux = require("flukes");

module.exports = React.createClass({
  mixins: [flux.createAutoBinder(["terminals"])],
  getInitialState: function () {
    return {
      conn_status: "Connecting..",
    }
  },
  componentWillMount: function () {
    const that = this;

  },
  render: function () {
    return (
      <div className="full-menu list-tree has-collapsable-children focusable-panel">
        <div className="header list-item">
          <span className="name icon icon-chevron-right">terminals</span>
          <ol>
            {this.props.terminals.map(function (t) {
              return <li>tty-{t.username}</li>;
            })}
          </ol>
        </div>
      </div>
    );
  }
});
