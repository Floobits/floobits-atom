/** @jsx React.DOM */

"use strict";
const React = require('react-atom-fork');

module.exports = React.createClass({
  render: function () {
    return (
      <div className="floobits-status-bar">
        Connected to {this.props.owner}/{this.props.workspace} as {this.props.username}.
      </div>
    );
  }
});
