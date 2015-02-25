"use 6to5";

var request = require("request");
var floorc = require("./floorc");
var utils = require("../utils");

var USER_AGENT = `Floobits Plugin 0.0.1 Atom-${process.version} ${process.platform} node-${process.versions.node}`;

var ERRORS_SENT = 0;
var MAX_ERROR_REPORTS = 5;
var ERROR_COUNT = 0;

function api_request (host, url, data, method, cb) {
  var options;

  var host = floorc.auth[host];

  options = {
    auth: {
      user: host.username,
      pass: host.secret,
      sendImmediately: true
    }, 
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT
    }
  };

  if (data) {
    options.json = data;
  }

  try {
    request[method](url, options, function (err, res, body) {
      if (err) {
        return cb(err, res, body);
      }
      if (res.statusCode >= 300) {
        return cb(res.statusMessage || res.statusCode, res);
      }
      try {
        return cb(null, JSON.parse(body));
      } catch (e) {
        return cb(e, res, body);
      }
    });
  } catch (e) {
    return cb(e);
  }
}

module.exports = {
  create_workspace: function (host, post_data, cb) {
    var api_url = `https://${host}/api/workspace`;
    return api_request(host, api_url, post_data, "post", cb);
  },
  delete_workspace: function (host, owner, workspace, cb) {
    var api_url = `https://${host}/api/workspace/${owner}/${workspace}`;
    return api_request(host, api_url, null, 'DELETE', cb);
  },
  update_workspace: function (workspace_url, data, cb) {
    var result = utils.parse_url(workspace_url);
    var host = result.host;
    var api_url = `https://${host}/api/workspace/${owner}/${workspace}`;
    return api_request(result, api_url, data, "put", cb);
  },
  get_workspace_by_url: function (url, cb) {
    var result = utils.parse_url(url);
    var api_url = `https://${result.host}/api/workspace/${result.owner}/${result.workspace}`;
    return api_request(result.host, api_url, null, "get", cb);
  },
  get_workspace: function (host, owner, workspace, cb) {
    var api_url = `https://${host}/api/workspace/${owner}/${workspace}`;
    return api_request(host, api_url, null, "get", cb)
  },
  get_workspaces: function (host, cb) {
    var api_url = `https://${host}/api/workspaces/can/view`;
    return api_request(host, api_url, null, "get", cb);
  },
  get_orgs: function (host, cb) {
    var api_url = `https://${host}/api/orgs`;
    return api_request(host, api_url, null, "get", cb);
  },
  get_orgs_can_admin: function (host, cb) {
    var api_url = `https://${host}/api/orgs/can/admin`;
    return api_request(host, api_url, null, "get", cb);
  },
  send_error: function (description, error) {
    ERROR_COUNT += 1
    var data = {
      jsondump: {
        error_count: ERROR_COUNT
      },
      message: {},
      dir: fl.base_path,
    };

    var stack = '';

    if (error) {
      stack = error.stack;
      description = description || error.message;
    }

    data.message = {
      description: description,
      stack: stack
    };

    console.log('Floobits plugin error! Sending exception report: ', data.message);
    if (ERRORS_SENT >= MAX_ERROR_REPORTS) {
      console.warn('Already sent ', ERRORS_SENT, ' errors this session. Not sending any more.\n', description, exception, stack);
      return;
    }

    var floourl = require("../floobits").floourl;

    var host;

    if (floourl) {
      data.owner = floourl.owner;
      data.workspace = floourl.workspace;
      data.username = "????";
      host = floourl.host;
    } else {
      host = "floobits.com";
    }

    try {
      let api_url = `https://${host}/api/log`;
      ERRORS_SENT += 1
      api_request(host, api_url, data, "get", function (err) {
        if (err) {
          console.error(err);
        }
      });

    } catch (e) {
      console.error(e);
    }
  }
};



// function send_errors (f) {
//     @wraps(f)
//     def wrapped(*args, **kwargs):
//         try:
//   return f(*args, **kwargs)

//         except Exception as e:
//   send_error(None, e)
//   raise
//     return wrapped
//   }
