{View} = require 'atom'

class JoinWorkspace extends View
  focus: -> @input.focus()
  initialize: (params) => 
    @input.on 'keydown', (e) =>
      switch e.which 
        when 13
          process.nextTick =>
            @panel.destroy()
          params.on_url? @input.val()
        when 27 then @panel.destroy() # escape
        else return
    @input.on 'focus', () =>
      @input.val(@input.val());
    process.nextTick =>
      @panel = atom.workspace.addModalPanel(item: @)
      @input.focus()

  @content: (params) ->
    @div id: "asdfsadfasdf", =>
      @h3 "Url for Workspace: ", style: "text-align: center; width: 100%;"
      @input outlet: 'input', style: "width: 100%;", value: params.url

module.exports = JoinWorkspace