/** @jsx React.DOM */
"use strict";

const React = require("react-atom-fork");
const flux = require("flukes");
const prefs = require("../common/userPref_model");

const floop = require("../common/floop");

const StatusBarView = React.createClass({
  mixins: [flux.createAutoBinder(["me"], [prefs])],
  getInitialState: function () {
    return {
      conn_status: "Connecting...",
    };
  },
  componentWillMount: function () {
    const that = this;
    floop.onROOM_INFO(function () {
      that.setState({conn_status: "Connected."});
    });
    floop.onDISCONNECT(function () {
      that.setState({conn_status: "Disconnected."});
    });
  },
  render: function () {
    let workspace = `${this.props.floourl.owner}/${this.props.floourl.workspace}`;
    let following_status;
    if (prefs.following) {
      following_status = " Following changes.";
    } else if (prefs.followUsers.length) {
      following_status = `Following ${prefs.followUsers.join(", ")}`;
    }
    return (
      <div className="floobits-status-bar">
        {this.props.me.id}@{workspace}: {this.state.conn_status}&nbsp;{following_status}
      </div>
    );
  }
});

module.exports = StatusBarView;
