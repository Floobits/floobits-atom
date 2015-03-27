/** @jsx React.DOM */

"use strict";

const React = require('react-atom-fork');

module.exports = React.createClass({
  render: function () {
    return (
      <div>
        <div className="row">
          <h2 className="col-lg-12">{this.props.username} wants to edit this workspace</h2>
        </div>
        <div className="well">
          <div className="row">
            <div className="col-lg-12 btn-group">
              <button className="btn btn-warning">Grant Access</button>
              <button className="btn btn-primary">Deny Access</button>
              <button className="btn btn-default">Ignore</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
});