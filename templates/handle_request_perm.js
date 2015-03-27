/** @jsx React.DOM */

"use strict";

const React = require('react-atom-fork');
const floop = require("../common/floop");
const permsEvent = {};

module.exports = React.createClass({
  destroy: function () {
    this.getDOMNode().parentNode.destroy();
  },
  grant: function() {
    permsEvent.action = "add";
    this.send();
  },
  deny: function() {
    permsEvent.action = "reject";
    this.send();
  },
  send: function() {
    floop.send_perms(permsEvent);
    this.destroy();
  },
  render: function() {
    permsEvent['user_id'] = this.props.userId;
    permsEvent['perms'] = this.props.perms;
    return (
      <div>
        <div className="row">
          <h2 className="col-lg-12">{this.props.username} wants to edit this workspace</h2>
        </div>
        <div className="well">
          <div className="row">
            <div className="col-lg-12 btn-group">
              <button tabIndex="0" className="btn btn-warning" onClick={this.grant}>Grant Access</button>
              <button tabIndex="10" className="btn btn-primary" onClick={this.deny}>Deny Access</button>
              <button tabIndex="20" className="btn btn-default" onClick={this.destroy}>Ignore</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
});