/** @jsx React.DOM */
"use strict";

const React = require('react-atom-fork');
const utils = require("../common/utils");
const floop = require("../common/floop");
const flux = require("flukes");
const message_action = require("../common/message_action");

module.exports = React.createClass({
  mixins: [flux.createAutoBinder(['msgs'])],
  handleMessage_: function (event) {
    event.preventDefault();
    const input = this.refs.newMessage.getDOMNode();
    let txt = input.value;
    input.value = "";
    const ret = floop.send_msg({data: txt});
    if (ret) {
      const error = ret.message || ret.toString();
      console.error(error);
      txt = error;
    }
    message_action.user(this.props.username, txt, Date.now());
  },
  componentDidMount: function () {
    this.focus();
  },
  focus: function () {
    this.refs.newMessage.getDOMNode().focus();
  },
  render: function () {
    const msgs = this.props.msgs.map(function (msg) {
      const userColor = utils.user_color(msg.username);
      return (
        <div className="message">
          <div className="message-content">
            <div className="message-timestamp">{msg.prettyTime}</div>
            <div className="message-text">
              <span className="message-username">
                <span className="user-color-square" style={{backgroundColor: userColor}}></span>
                {msg.username}:&nbsp;
              </span>
              {msg.data}
            </div>
          </div>
        </div>
      );
    });
    return (
      <div className="native-key-bindings floobits-messages-container" style={
        {overflow: "auto", border: 0, padding: 10, left: 0, top: 0, margin: 0, width: "100%", height: "100%"}}
        onMouseUp={this.focus}
        >
        <div className="chat-input-container">
          <form onSubmit={this.handleMessage_}>
            <input type="text" ref="newMessage" defaultValue="" className="chat-input" placeholder="type here to chat"/>
          </form>
        </div>
        <div className="messages-list">
          {msgs}
        </div>
      </div>
    );
  }
});
