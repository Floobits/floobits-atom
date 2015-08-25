/** @jsx React.DOM */
"use strict";

const React = require("react-atom-fork");
const flux = require("flukes");

const floop = require("../common/floop");

module.exports = React.createClass({
  mixins: [flux.createAutoBinder(["me"])],
  getInitialState: function () {
    return {
      conn_status: "Connecting..",
    }
  },
  componentWillMount: function () {
    const that = this;
    floop.onROOM_INFO(function () {
      that.setState({conn_status: "Connected"});
    });
    floop.onDISCONNECT(function () {
      that.setState({conn_status: "Disconnected"});
    });
  },
  render: function () {
    return (
      <div className="floobits-status-bar">
        {this.props.me.id}@{this.props.floourl.owner}/{this.props.floourl.workspace}: {this.state.conn_status}.
      </div>
    );
  }
});
