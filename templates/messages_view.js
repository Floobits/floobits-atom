/** @jsx React.DOM */
"use strict";

const flux = require("flukes");
const React = require('react-atom-fork');
const _ = require("lodash");
const utils = require("../utils");
const floop = require("../common/floop");
const messageAction = require("../common/message_action");


const LogMessageView = React.createClass({
  render: function () {
    const message = this.props.message;
    let repeatCountHTML = "";
    if (this.props.repeatCount > 0) {
      repeatCountHTML = (
        <span className="message-log-repeat">x{this.props.repeatCount + 1}</span>
      );
    }
    return (
      <div className={"message alert alert-" + message.levelName} role="alert">
        <div className="message-content">
          <div className="message-timestamp">{message.prettyTime}</div>
          <div className="message-text"><img src="atom://floobits/resources/icon_64x64.png" className="floobits-square" />{message.msg} {repeatCountHTML} </div>
        </div>
      </div>
    );
  }
});

const UserMessageView = React.createClass({
  getInitialState: function () {
    return {
      ignoredURLs: [],
    };
  },
  ignoreURL: function (url, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const ignoredURLs = this.state.ignoredURLs;
    ignoredURLs.push(url);
    this.setState({ignoredURLs: ignoredURLs});
  },
  render: function () {
    var message = this.props.message,
      urlRegexp = /https?:\/\/\S+/g,
      userColor = utils.user_color(message.username),
      result,
      msgTxt = [],
      before,
      after,
      key = 0,
      prevIndex = 0;

    while (true) {
      result = urlRegexp.exec(message.msg);
      if (!result) {
        msgTxt.push(message.msg.slice(prevIndex));
        break;
      }
      before = message.msg.slice(prevIndex, result.index);
      prevIndex = result.index + result[0].length;
      after = message.msg.slice(prevIndex, urlRegexp.lastIndex);
      let imgOrTxt = result[0];
      if (this.state.ignoredURLs.indexOf(imgOrTxt) === -1 && utils.image_mime_from_extension(imgOrTxt)) {
        imgOrTxt = (
          <div className="messages-image-container">
            <i className="glyphicon glyphicon-remove messages-remove-image" onClick={this.ignoreURL.bind(this, imgOrTxt)}></i>
            <img src={imgOrTxt} />
          </div>);
      }

      msgTxt.push(
        <span key={key++}>
          {before}
          <a target="_blank" href={result[0]}>{imgOrTxt}</a>
          {after}
        </span>
      );
    }

    return (
      <div className="message">
        <div className="message-content">
          <div style={{}} className="message-timestamp">{message.prettyTime}</div>
          <div style={{}} className="message-text">
            <span className="message-username">
              <span className="user-color-square" style={{backgroundColor: userColor}}></span>
              {message.username || message.type}:&nbsp;
            </span>
            {msgTxt}
          </div>
        </div>
      </div>
    );
  }
});

const InteractiveMessageView = React.createClass({
  getInitialState: function () {
    return {
      clicked: null
    };
  },
  onClick: function (button) {
    if (this.state.clicked !== null) {
      return;
    }
    button.action();
    this.setState({clicked: button.id});
  },
  render: function () {
    var message = this.props.message,
      buttons = message.buttons || [];

    buttons = buttons.map(function (b) {
      var classes = "btn ",
        clicked = this.state.clicked;

      if (clicked === null || clicked === b.id) {
        classes += b.classNames.join(" ");
      }
      if (clicked === b.id) {
        classes += " dim";
      }
      return (
        <button key={b.id} className={classes} onClick={this.onClick.bind(this, b)}>{b.name}</button>
      );
    }, this);

    return (
      <div className="message">
        <div className="message-content">
          <div className="message-timestamp">{message.prettyTime}</div>
          <div className="message-text">
            {message.msg}
            {buttons.length &&
              <div className="buttons">{buttons}</div>
            }
          </div>
        </div>
      </div>
    );
  }
});

const MessagesView = React.createClass({
  mixins: [flux.createAutoBinder(["messages"])],
  handleMessage_: function (event) {
    event.preventDefault();
    const input = this.refs.newMessage.getDOMNode();
    const value = input.value;
    let ret = floop.send_msg({data: value});
    if (ret) {
      ret = ret.message || ret.toString();
      messageAction.error(ret, false);
      return;
    }
    input.value = "";
    messageAction.user(this.props.username, value, Date.now() / 1000);
  },
  componentDidMount: function () {
    // focus in chat but not editor proxy :(
    if (this.props.focus && this.refs.newMessage) {
      this.focus();
    }
  },
  getMessages: function () {
    const messages = [];
    let prevLogMessage = null;
    this.props.messages.forEach(function (message ) {
      if (message.type !== "log") {
        prevLogMessage = null;
        messages.push({message});
        return;
      }
      if (prevLogMessage === message.msg) {
        _.last(messages).repeatCount += 1;
        return;
      }
      messages.push({message, repeatCount: 0});
      prevLogMessage = message.msg;
    });
    return messages;
  },
  focus: function () {
    this.refs.newMessage.getDOMNode().focus();
  },
  render: function () {
    var nodes, chatInput = "";
    nodes = this.getMessages().map(function (messageObj) {
      const message = messageObj.message;
      switch (message.type) {
        case "user":
          return <UserMessageView message={message} key={message.id} />;
        case "log":
          return <LogMessageView repeatCount={messageObj.repeatCount} message={message} key={message.id} />;
        case "interactive":
          return <InteractiveMessageView message={message} key={message.id} />;
        default:
          console.error("Unknown message type:", message.type);
          break;
      }
    }, this);
    if (!this.props.hideChat) {
      chatInput = (
        <div className="chat-input-container">
          <form onSubmit={this.handleMessage_} className="native-key-bindings">
            <input type="text" ref="newMessage" defaultValue="" className="chat-input native-key-bindings" placeholder="type here to chat"/>
          </form>
        </div>
      );
    }

    return (
      <div className="native-key-bindings floobits-messages-container" style={
        {overflow: "auto", border: 0, padding: 10, left: 0, top: 0, margin: 0, width: "100%", height: "100%"}}
        onMouseUp={this.focus}
        >
        <div className="messages-container">
          {chatInput}
          <div className="messages-list">
            {nodes}
          </div>
        </div>
      </div>
    );
  }
});

module.exports = MessagesView;
