/** @jsx React.DOM */
/*global $, _, React */
/** @fileOverview The UI for the userlist. */
"use strict";

var Connection, UserView, UserlistView, ChatUserlistView, IsMeUserView, NotMeUserView,
  GravatarThumbnailView, ImageThumbnailView, VideoThumbnailView, ListViewMixin,
  React = require('react-atom-fork'),
  flux = require('flukes'),
  modal = require("../modal"),
  $ = require('atom-space-pen-views').$,
  // PermissionView = require("./permission_view"),
  perms = require("../common/permission_model"),
  editorAction = require("../common/editor_action"),
  webrtcAction = require("../common/webrtc_action"),
  utils = require("../utils");


// const ANONYMOUS_PNG = "/static/images/anonymous.png";
const ANONYMOUS_PNG = "atom://floobits/resources/anonymous.png";


Connection = React.createClass({
  componentName: "Connection",
  getInitialState: function () {
    return {
      showPopover: false,
    };
  },
  kick_: function () {
    editorAction.kick(this.props.connection.id);
  },
  render: function () {
    var connection = this.props.connection;

    return (
      <div className="user-conn">
        <span className="user-client-name">{connection.isMe ? "me" : connection.client }</span>
        <span className="pull-right">{connection.path}</span>
        { this.props.isAdmin &&
          <span className="btn-group pull-right" onClick={this.kick_}>
           <a href="#"><i className="floobits-eject-icon"></i> Kick</a>
          </span>
        }
      </div>
    );
  }
});

IsMeUserView = React.createClass({
  getInitialState: function () {
    return {
      sharing: false
    };
  },
  shareScreen: function (event) {
    var err;
    event.preventDefault();
    event.stopPropagation();
    if (this.state.sharing) {
      webrtcAction.stop_screen(this.props.connection.id);
      this.setState({sharing: false});
      return;
    }
    err = webrtcAction.start_screen();
    if (err instanceof Error) {
      return;
    }
    this.setState({sharing: true});
  },
  render: function () {
    return (
      <div>
        <div style={{display: "inline-block"}}>
          <a href="https://chrome.google.com/webstore/detail/floobits-screen-sharing/lmojaknpofhmdnbpanagbbeinbjmbodo"></a>
          <a href="#" onClick={this.shareScreen}>
            <i className="floobits-video-icon"></i> {this.state.sharing ? "Stop Screen Sharing" : "Share Screen" }
          </a>
        </div>
        <div style={{display: "inline-block", paddingTop: 8}}>
          <a href="/help/webrtc#screenshare" target="_blank" title="Screen Share Help"><i className="glyphicon glyphicon-question-sign"></i></a>
        </div>
      </div>
    );
  }
});

NotMeUserView = React.createClass({
  kick_: function () {
    this.props.user.connections.forEach(function (conn) {
      console.log("kicking", conn);
      editorAction.kick(conn.id);
    });
  },
  editPerms_: function () {
    modal.showModal(PermissionView, {user: this.props.user, me: this.props.me, title: "Edit Permissions for " + this.props.user.id});
  },
  followUser_: function () {
    editorAction.follow(this.props.user.id);
  },
  render: function () {
    var isAdmin = this.props.isAdmin;
    return (
      <div>
        <span className="user-client-name">{this.props.user.id}</span>
        <span className="pull-right">
          <a target="_blank" href={"/" + this.props.user.id + "/"}><i className="glyphicon glyphicon-info-sign"></i> Info</a>
        </span>
        {isAdmin &&
          <div onClick={this.kick_} className="pull-right" style={{clear: "both"}}>
            <a href="#"><i className="floobits-eject-icon"></i> Kick</a>
          </div>
        }
        {!this.props.isListView &&
        <div onClick={this.followUser_} className="pull-right" style={{clear: "both"}}>
          <a href="#"><i className="glyphicon glyphicon-magnet"></i> {this.props.isFollowing ? "Unfollow" : "Follow"}</a>
        </div>
        }
        {isAdmin &&
          <div onClick={this.editPerms_} className="pull-right" style={{clear: "both"}}>
            <a href="#"><i className="glyphicon glyphicon-cog"></i> Permissions</a>
          </div>
        }
      </div>
    );
  },
});

UserView = {
  mixins: [flux.createAutoBinder(['prefs'])],
  getInitialState: function () {
    return {
      opened: false
    };
  },
  followUser_: function () {
    editorAction.follow(this.props.user.id);
  },
  settingsClick: function () {
    $(this.refs.user.getDOMNode()).toggleClass("opened");
    this.state.opened = !!this.state.opened;
  },
  render: function () {
    var connectionNodes = [], user, isAdmin, me, isListView, isFollowing, inVideoChat = false;

    user = this.props.user;
    me = this.props.me;
    isAdmin = me.isAdmin;
    isListView = this.props.isListView;
    user.connections.forEach(function (connection) {
      if (!inVideoChat && connection.inVideoChat) {
        inVideoChat = true;
      }
      if (!connection.connected) {
        return;
      }
      connectionNodes.push(<Connection connection={connection} key={connection.id}
        me={me} username={user.username} isListView={this.props.isListView} isAdmin={isAdmin} />);
    }, this);

    isFollowing = this.props.prefs.followUsers.indexOf(user.id) !== -1;

    return (
      <div ref="user" className={"user" + (this.state.opened ? " opened" : "")}>
        <div>
          {!this.props.isListView &&
            <i title={isFollowing ? ("Stop following " + user.id) : ("Follow " + user.id + "'s changes")}
               className={"glyphicon user-indicator user-following" + (isFollowing ? " enabled" : "")}
               onClick={this.followUser_}></i>
          }
          {inVideoChat &&
            <i title={user.id + " is in video chat"}
              className="glyphicon user-indicator in-video"></i>
          }
          {this.body()}
        </div>
        <div ref="settings" className="user-info">
          <div className="stack-up">
            <div className="stack-up-content">{connectionNodes.length} connection{connectionNodes.length === 1 ? "" : "s"}</div>
            <hr/>
            <div className="stack-up-content">
              {connectionNodes}
            </div>
            <hr/>
            <div className="stack-up-content">
              {this.props.connection.isMe ?
                <IsMeUserView user={user} isAdmin={isAdmin} connection={this.props.connection} /> :
                <NotMeUserView user={user} isAdmin={isAdmin} isListView={isListView} isFollowing={isFollowing} />
              }
            </div>
            <hr style={{clear: "both"}}/>
          </div>
        </div>
        <div className="user-bar" onClick={this.settingsClick}>
          <span className={"user-color-square highlight_" + user.color} style={{backgroundColor: user.color}}></span>
          <span className="user-username">{user.id}</span>
          <i className="floobits-arrow-up-icon"></i>
        </div>
      </div>
    );
  }
};

GravatarThumbnailView = React.createClass({
  mixins: [UserView],
  onClick: function () {
    webrtcAction.start_video_chat(this.props.connection.id);
  },
  body: function () {
    var canEdit = perms.indexOf("patch") !== -1,
      src = this.props.user.gravatar;

    if (src) {
      src += "?s=228";
    } else {
      // No gravatar. Use placeholder.
      src = ANONYMOUS_PNG;
    }
    return (
      <img src={src} className="user-thumb" title={canEdit ? "Start video chat" : null} onClick={this.onClick} />
    );
  }
});

ImageThumbnailView = React.createClass({
  mixins: [UserView],
  render_image: function () {
    var context = this.refs.canvas.getDOMNode().getContext("2d");
    context.putImageData(this.props.connection.image, 0, 0);
  },
  componentDidMount: function () {
    this.render_image();
  },
  componentDidUpdate: function () {
    this.render_image();
  },
  onClick: function () {
    webrtcAction.start_video_chat(this.props.connection.id);
  },
  body: function () {
    var canEdit = perms.indexOf("patch") !== -1,
      className = "user-thumb" + (this.props.connection.isMe ? " user-my-conn": "");
    return (
      <canvas ref="canvas" className={className} width="228px" height="228px" title={canEdit ? "Start video chat" : null} onClick={this.onClick}></canvas>
    );
  }
});

VideoThumbnailView = React.createClass({
  mixins: [UserView],
  componentDidMount: function () {
    this.id = this.props.connection.visualizer.onVISUALIZE(function (volume) {
      this.refs.volume.getDOMNode().style.width = volume + "%";
    }, this);
  },
  componentWillUnmount: function () {
    var elem = this.refs["user-thumb-" + this.props.connection.id].getDOMNode(),
      fullscreenElement = utils.getFullscreenElement();

    this.props.connection.visualizer.off(this.id);

    // TODO: chrome has a bug that causes thumbnails to be position: static after full-screening
    if (utils.getFullscreenElement() === elem) {
      console.log("exiting full screen before unmounting");
      utils.exitFullscreen();
    }
  },
  onClick: function () {
    var elem = this.refs["user-thumb-" + this.props.connection.id].getDOMNode(),
      fullscreenElement = utils.getFullscreenElement();

    if (fullscreenElement === elem) {
      utils.exitFullscreen();
      return;
    }
    utils.requestFullscreen(elem);
  },
  stop: function () {
    if (this.props.screenShare) {
      return webrtcAction.stop_screen(this.props.connection.id);
    }
    webrtcAction.stop_video_chat(this.props.connection.id);
  },
  body: function () {
    var classNames = ["user-thumb"],
      poster = ANONYMOUS_PNG;

    if (this.props.user.gravatar) {
      poster = this.props.user.gravatar + "?s=228";
    }

    if (this.props.connection.isMe && !this.props.screenShare) {
      classNames.push("user-my-conn");
    }

    if (this.props.connection.audioOnly) {
      classNames.push("audio-only");
    }

    return (
      <div>
        <i className="user-indicator floobits-close-icon" title="Close" onClick={this.stop}></i>
        <div className="visualizer" ref="volume"></div>
        <video className={classNames.join(" ")}
               ref={"user-thumb-" + this.props.connection.id}
               onClick={this.onClick} src={this.props.src}
               autoPlay="autoplay"
               poster={poster}
               muted={this.props.connection.isMe ? "muted": null}>
        </video>
      </div>
    );
  }
});

ListViewMixin = {
  mixins: [flux.createAutoBinder(['users'])],
  /** @inheritDoc */
  render: function () {
    var thumbnailNodes = [], isListView, user, isAdmin, me, prefs;

    user = this.props.user;
    me = this.props.me;
    isListView = this.isListView;
    isAdmin = me.isAdmin;
    prefs = this.props.prefs;

    this.props.users.forEach(function (user) {
      var hasRendered = false;
      user.connections.sort();
      user.connections.forEach(function (connection) {
        var args;
        if (!connection.connected) {
          return;
        }

        args = {
          connection: connection,
          key: connection.id,
          user: user,
          me: me,
          isListView: isListView,
          prefs: prefs
        };
        if (connection.streamURL) {
          hasRendered = true;
          args.src = connection.streamURL;
          args.key += "video";
          // React.createElement
          thumbnailNodes.push(VideoThumbnailView(args));
        } else if (connection.image) {
          hasRendered = true;
          args.key += "image";
          thumbnailNodes.push(ImageThumbnailView(args));
        }

        if (!hasRendered) {
          hasRendered = true;
          args.key += "gravatar";
          thumbnailNodes.push(GravatarThumbnailView(args));
        }

        if (connection.screenStreamURL) {
          args.src = connection.screenStreamURL;
          args.key += "screen";
          args.screenShare = true;
          thumbnailNodes.push(VideoThumbnailView(args));
        }
      }, this);
    }, this);
    return (
      <div className="user-list">
        {thumbnailNodes}
      </div>
    );
  }
};

ChatUserlistView = React.createClass({
  mixins: [ListViewMixin],
  componentName: "ChatUserlistView",
  isListView: true,
});

UserlistView = React.createClass({
  componentName: "UserlistView",
  mixins: [ListViewMixin],
  isListView: false,
});

module.exports = {
  ChatUserlistView: ChatUserlistView,
  UserlistView: UserlistView,
};
