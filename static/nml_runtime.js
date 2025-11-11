(function(){
  function pathGet(obj, path){
    if(!path) return undefined;
    var cur = obj;
    var parts = path.split('.');
    for(var i=0;i<parts.length;i++){
      if(cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function pathSet(obj, path, value){
    var parts = path.split('.');
    var cur = obj;
    for(var i=0;i<parts.length-1;i++){
      var k = parts[i];
      if(typeof cur[k] !== 'object' || cur[k] === null){ cur[k] = {}; }
      cur = cur[k];
    }
    cur[parts[parts.length-1]] = value;
  }

  var state = {};
  function updateBindings(){
    var nodes = document.querySelectorAll('[data-nml-bind]');
    for(var i=0;i<nodes.length;i++){
      var el = nodes[i];
      var spec = el.getAttribute('data-nml-bind') || '';
      // format: "text:count" or "value:form.name"
      var parts = spec.split(':');
      var kind = (parts[0]||'').trim();
      var key = (parts.slice(1).join(':')||'').trim();
      var val = pathGet(state, key);
      if(kind === 'text'){
        el.textContent = val == null ? '' : String(val);
      } else if(kind === 'value'){
        if('value' in el){ el.value = val == null ? '' : String(val); }
      }
    }
  }

  function doAction(str){
    if(!str || typeof str !== 'string') return;
    try{
      var tokens = str.trim().split(/\s+/);
      var cmd = tokens[0];
      if(cmd === 'set'){
        // set path value
        var p = tokens[1];
        var v = tokens.slice(2).join(' ');
        // try to coerce numbers/booleans
        if(v === 'true') v = true; else if(v === 'false') v = false; else if(!isNaN(parseFloat(v))) v = parseFloat(v);
        pathSet(state, p, v);
      } else if(cmd === 'inc'){
        // inc path amount
        var p2 = tokens[1];
        var amt = parseFloat(tokens[2] || '1');
        var cur = pathGet(state, p2) || 0;
        pathSet(state, p2, Number(cur)+amt);
      } else if(cmd === 'toggle'){
        var p3 = tokens[1];
        var curv = !!pathGet(state, p3);
        pathSet(state, p3, !curv);
      }
      updateBindings();
    }catch(e){ /* noop */ }
  }

  // Expose a tiny API
  window.nml = doAction;
  window.nmlState = state;

  document.addEventListener('DOMContentLoaded', function(){
    try{
      var holder = document.querySelector('[data-nml-state]');
      if(holder){
        var raw = holder.getAttribute('data-nml-state');
        if(raw){
          var parsed = JSON.parse(raw);
          if(parsed && typeof parsed === 'object') state = parsed; // replace
          window.nmlState = state;
        }
      }
    }catch(e){ /* noop */ }
    updateBindings();
  });
})();
