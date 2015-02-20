"use 6to5";

var request = require("request");
var floorc = require("./floorc");

var USER_AGENT = `Floobits Plugin 0.0.1 Atom-${process.version} ${process.platform} node-${process.versions.node}`;

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
      try {
        return cb(err, JSON.parse(body));
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
    return api_request(result, api_url, data, put, cb);
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
};

// function send_error (description=None, exception=None) {
//   G.ERROR_COUNT += 1
//   data = {
//   'jsondump': {
//   'error_count': G.ERROR_COUNT
//         },
//         'message': {},
//         'dir': G.COLAB_DIR,
//     }
//     stack = ''
//     if G.AGENT:
//         data['owner'] = getattr(G.AGENT, "owner", None)
//         data['username'] = getattr(G.AGENT, "username", None)
//         data['workspace'] = getattr(G.AGENT, "workspace", None)
//     if exception:
//         try:
//   stack = traceback.format_exc(exception)
//         except Exception:
//   stack = "Python is rtardd"
//         try:
//   description = str(exception)
//         except Exception:
//   description = "Python is rtadd"

//         data['message'] = {
//   'description': description,
//   'stack': stack
//         }
//     msg.log('Floobits plugin error! Sending exception report: ', data['message'])
//     if description:
//         data['message']['description'] = description
//     if G.ERRORS_SENT >= G.MAX_ERROR_REPORTS:
//         msg.warn('Already sent ', G.ERRORS_SENT, ' errors this session. Not sending any more.\n', description, exception, stack)
//         return
//       }
//     try:
//         # TODO: use G.AGENT.proto.host?
//         api_url = 'https://%s/api/log' % (G.DEFAULT_HOST)
//         r = api_request(G.DEFAULT_HOST, api_url, data)
//         G.ERRORS_SENT += 1
//         return r
//       }
//     except Exception as e:
//         print(e)


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
