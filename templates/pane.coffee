{$, View} = require 'atom-space-pen-views'

class PaneView extends View
  focus: -> @input.focus()
  initialize: (@pane) =>
    pane.setView @
    @title = pane.title;
    @icon = pane.icon;
    this[0].appendChild(pane.inner);

    process.nextTick =>
      # Basically Lifted from Mark Hahn's web-browser https://github.com/mark-hahn/web-browser
      # thanks for figuring this out, Mark!
      @$tabFavicon = $ '<img class="tab-favicon" src="atom://floobits/resources/icon_64x64.png">'
      tabBarView   = $(atom.views.getView(atom.workspace.getActivePane())).find('.tab-bar').view()
      $tabView     = $ tabBarView.tabForItem @pane
      $tabView.append @$tabFavicon
      $tabView.find('.title').css paddingLeft: '2.7em'

  detached: ->
    console.log "detached"
    @pane.onDetached?()


  @content: (params) ->
    @div 'style': "overflow: auto;", "class": "native-key-bindings"

class Pane
  constructor: (@title, @icon, @inner, @onDetached) ->
  getViewClass: -> PaneView
  getView: -> @view
  setView: (@view) ->
  getTitle: () =>
    @title

module.exports = Pane
